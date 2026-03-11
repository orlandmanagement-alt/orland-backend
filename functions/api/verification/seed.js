import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function getUsers(env, limit=3){
  const r = await env.DB.prepare(`
    SELECT id, email_norm, display_name
    FROM users
    ORDER BY created_at ASC, id ASC
    LIMIT ?
  `).bind(limit).all();

  return r.results || [];
}

async function upsertUserSecurity(env, userId, enabled, ts){
  await env.DB.prepare(`
    INSERT INTO user_security (user_id, email_2fa_enabled, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      email_2fa_enabled=excluded.email_2fa_enabled,
      updated_at=excluded.updated_at
  `).bind(userId, enabled ? 1 : 0, ts).run();
}

async function updateUserFlags(env, userId, row, ts){
  const phoneVerified = row.phone_verified ? 1 : 0;
  const emailVerified = row.email_verified ? 1 : 0;
  const phone = String(row.phone_e164 || "").trim() || null;

  await env.DB.prepare(`
    UPDATE users
    SET phone_e164=?,
        phone_verified=?,
        phone_verified_at=?,
        email_verified=?,
        email_verified_at=?,
        updated_at=?
    WHERE id=?
  `).bind(
    phone,
    phoneVerified,
    phoneVerified ? ts : null,
    emailVerified,
    emailVerified ? ts : null,
    ts,
    userId
  ).run();
}

async function insertVerification(env, item, ts){
  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO user_verifications (
      id, user_id, kind, status, evidence_json, reviewed_by_user_id, reviewed_at, created_at, updated_at
    ) VALUES (?, ?, 'kyc', ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    item.user_id,
    item.status,
    JSON.stringify(item.evidence || {}),
    item.reviewed_by_user_id || null,
    item.reviewed_at || null,
    ts,
    ts
  ).run();
  return id;
}

async function insertAudit(env, actorUserId, action, targetType, targetId, meta, ts){
  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    actorUserId || null,
    action,
    targetType,
    targetId || null,
    JSON.stringify(meta || {}),
    ts
  ).run();
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  if(String(body.confirm || "") !== "SEED_VERIFICATION_V1"){
    return json(400, "invalid_input", {
      message: "confirm_required",
      expected: "SEED_VERIFICATION_V1"
    });
  }

  const users = await getUsers(env, 3);
  if(users.length < 1){
    return json(400, "invalid_input", { message: "seed_requires_existing_users" });
  }

  const ts = nowSec();
  const actor = a.user?.id || null;

  const u1 = users[0];
  const u2 = users[1] || users[0];
  const u3 = users[2] || users[0];

  await updateUserFlags(env, u1.id, {
    phone_e164: "+620000000001",
    phone_verified: 1,
    email_verified: 1
  }, ts);
  await upsertUserSecurity(env, u1.id, 1, ts);

  await updateUserFlags(env, u2.id, {
    phone_e164: "+620000000002",
    phone_verified: 0,
    email_verified: 1
  }, ts);
  await upsertUserSecurity(env, u2.id, 0, ts);

  await updateUserFlags(env, u3.id, {
    phone_e164: "+620000000003",
    phone_verified: 1,
    email_verified: 0
  }, ts);
  await upsertUserSecurity(env, u3.id, 0, ts);

  const kycPendingId = await insertVerification(env, {
    user_id: u1.id,
    status: "pending",
    evidence: {
      doc_type: "ktp",
      note: "seed pending",
      full_name: u1.display_name || u1.email_norm || u1.id
    }
  }, ts);

  const kycApprovedId = await insertVerification(env, {
    user_id: u2.id,
    status: "approved",
    reviewed_by_user_id: actor,
    reviewed_at: ts,
    evidence: {
      doc_type: "ktp",
      note: "seed approved",
      full_name: u2.display_name || u2.email_norm || u2.id
    }
  }, ts);

  const kycRejectedId = await insertVerification(env, {
    user_id: u3.id,
    status: "rejected",
    reviewed_by_user_id: actor,
    reviewed_at: ts,
    evidence: {
      doc_type: "ktp",
      note: "seed rejected",
      full_name: u3.display_name || u3.email_norm || u3.id
    }
  }, ts);

  await insertAudit(env, u1.id, "verification_phone_completed", "user", u1.id, { seed: true }, ts);
  await insertAudit(env, u1.id, "verification_email_completed", "user", u1.id, { seed: true }, ts);
  await insertAudit(env, u1.id, "two_step_enabled", "user", u1.id, { seed: true }, ts);
  await insertAudit(env, u1.id, "kyc_submitted", "user_verification", kycPendingId, { seed: true }, ts);

  await insertAudit(env, actor, "kyc_approved", "user_verification", kycApprovedId, {
    seed: true,
    user_id: u2.id,
    status_to: "approved"
  }, ts);

  await insertAudit(env, actor, "kyc_rejected", "user_verification", kycRejectedId, {
    seed: true,
    user_id: u3.id,
    status_to: "rejected"
  }, ts);

  await insertAudit(env, u2.id, "verification_phone_otp_requested", "user", u2.id, {
    seed: true,
    mode: "internal_otp_v1"
  }, ts);

  await insertAudit(env, u3.id, "verification_policy_block", "user", u3.id, {
    seed: true,
    scope: "talent",
    required_actions: ["verify_email", "enable_two_step"]
  }, ts);

  return json(200, "ok", {
    seeded: true,
    users_used: users.map(x => ({
      id: x.id,
      email_norm: x.email_norm || "",
      display_name: x.display_name || ""
    })),
    verifications: {
      pending: kycPendingId,
      approved: kycApprovedId,
      rejected: kycRejectedId
    }
  });
}
