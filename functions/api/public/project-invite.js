import { json, readJson, requireAuth } from "../../_lib.js";
import {
  ensureInviteTables,
  createTalentUser,
  getInviteLinkDetail,
  validateInviteRow,
  upsertInviteForTalent,
  upsertBooking,
  increaseInviteUsage
} from "../projects/_invite_common.js";

async function hasTalentRole(env, userId){
  const row = await env.DB.prepare(`
    SELECT 1 AS ok
    FROM user_roles ur
    JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=? AND r.name='talent'
    LIMIT 1
  `).bind(userId).first();
  return !!row;
}

export async function onRequestGet({ request, env }){
  await ensureInviteTables(env);

  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") || "").trim();
  if(!token) return json(400, "invalid_input", { message: "token" });

  const row = await getInviteLinkDetail(env, token);
  const invalid = validateInviteRow(row);

  if(invalid){
    return json(200, "ok", {
      valid: false,
      reason: invalid
    });
  }

  return json(200, "ok", {
    valid: true,
    invite: {
      id: row.id,
      token: row.token,
      title: row.title,
      message: row.message,
      role_label: row.role_label,
      require_approval: Number(row.require_approval || 0),
      auto_create_user: Number(row.auto_create_user || 0),
      max_uses: Number(row.max_uses || 0),
      used_count: Number(row.used_count || 0),
      expires_at: row.expires_at,
      project_id: row.project_id,
      project_title: row.project_title,
      project_status: row.project_status,
      project_type: row.project_type,
      location_text: row.location_text,
      project_role_id: row.project_role_id,
      role_name: row.role_name,
      role_type: row.role_type,
      qty_needed: row.qty_needed
    }
  });
}

export async function onRequestPost({ request, env }){
  await ensureInviteTables(env);

  const body = await readJson(request) || {};
  const action = String(body.action || "").trim();
  const token = String(body.token || "").trim();

  if(!token) return json(400, "invalid_input", { message: "token" });

  const row = await getInviteLinkDetail(env, token);
  const invalid = validateInviteRow(row);
  if(invalid) return json(400, "invalid_input", { message: invalid });

  if(action === "register"){
    if(Number(row.auto_create_user || 0) !== 1){
      return json(400, "invalid_input", { message: "auto_create_disabled" });
    }

    let user;
    try{
      user = await createTalentUser(env, {
        email: body.email,
        display_name: body.display_name,
        password: body.password,
        phone: body.phone,
        website: body.website,
        gender: body.gender,
        dob: body.dob,
        location: body.location
      });
    }catch(err){
      return json(400, "invalid_input", { message: String(err.message || err) });
    }

    const requireApproval = Number(row.require_approval || 0) === 1;
    const inviteStatus = requireApproval ? "pending" : "approved";
    const bookingStatus = requireApproval ? "pending" : "approved";

    const project_invite_id = await upsertInviteForTalent(
      env,
      row.project_role_id,
      user.user_id,
      inviteStatus,
      "registered via project invite"
    );

    await upsertBooking(
      env,
      row.project_role_id,
      user.user_id,
      bookingStatus,
      "source=project_invite"
    );

    await increaseInviteUsage(env, row.id);

    return json(200, "ok", {
      registered: true,
      user_id: user.user_id,
      approval_status: inviteStatus,
      booking_status: bookingStatus,
      project_invite_id
    });
  }

  if(action === "claim"){
    const a = await requireAuth(env, request);
    if(!a.ok) return a.res;

    const isTalent = await hasTalentRole(env, a.uid);
    if(!isTalent){
      return json(403, "forbidden", { message: "talent_only" });
    }

    const requireApproval = Number(row.require_approval || 0) === 1;
    const inviteStatus = requireApproval ? "pending" : "approved";
    const bookingStatus = requireApproval ? "pending" : "approved";

    const project_invite_id = await upsertInviteForTalent(
      env,
      row.project_role_id,
      a.uid,
      inviteStatus,
      "claimed via project invite"
    );

    await upsertBooking(
      env,
      row.project_role_id,
      a.uid,
      bookingStatus,
      "source=project_invite_claim"
    );

    await increaseInviteUsage(env, row.id);

    return json(200, "ok", {
      claimed: true,
      approval_status: inviteStatus,
      booking_status: bookingStatus,
      project_invite_id
    });
  }

  return json(400, "invalid_input", { message: "unknown_action" });
}
