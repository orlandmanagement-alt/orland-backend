import { json, readJson, requireAuth, nowSec } from "../../_lib.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const evidence = body.evidence && typeof body.evidence === "object" ? body.evidence : {};
  const now = nowSec();

  const existing = await env.DB.prepare(`
    SELECT id, status
    FROM user_verifications
    WHERE user_id=? AND kind='kyc'
    ORDER BY created_at DESC
    LIMIT 1
  `).bind(a.user.id).first();

  if(existing){
    await env.DB.prepare(`
      UPDATE user_verifications
      SET status='pending',
          evidence_json=?,
          updated_at=?
      WHERE id=?
    `).bind(JSON.stringify(evidence), now, existing.id).run();

    await env.DB.prepare(`
      INSERT INTO audit_logs (
        id, actor_user_id, action, target_type, target_id, meta_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      a.user.id,
      "kyc_submitted",
      "user_verification",
      existing.id,
      JSON.stringify({ updated: true }),
      now
    ).run();

    return json(200, "ok", {
      submitted: true,
      id: existing.id,
      status: "pending",
      updated: true
    });
  }

  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO user_verifications (
      id, user_id, kind, status, evidence_json, reviewed_by_user_id, reviewed_at, created_at, updated_at
    ) VALUES (?, ?, 'kyc', 'pending', ?, NULL, NULL, ?, ?)
  `).bind(
    id,
    a.user.id,
    JSON.stringify(evidence),
    now,
    now
  ).run();

  await env.DB.prepare(`
    INSERT INTO audit_logs (
      id, actor_user_id, action, target_type, target_id, meta_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    a.user.id,
    "kyc_submitted",
    "user_verification",
    id,
    JSON.stringify({ created: true }),
    now
  ).run();

  return json(200, "ok", {
    submitted: true,
    id,
    status: "pending",
    created: true
  });
}
