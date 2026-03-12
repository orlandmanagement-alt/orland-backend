import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

const REVIEW_KEY = "access_reviews_v1";

function safeArray(v){
  if(Array.isArray(v)) return v;
  try{
    const x = JSON.parse(String(v || "[]"));
    return Array.isArray(x) ? x : [];
  }catch{
    return [];
  }
}

async function readItems(env){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k = ?
    LIMIT 1
  `).bind(REVIEW_KEY).first();

  return row?.v ? safeArray(row.v) : [];
}

async function writeItems(env, items){
  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      updated_at = excluded.updated_at
  `).bind(REVIEW_KEY, JSON.stringify(items), now).run();
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const id = String(body.id || "").trim();
  if(!id){
    return json(400, "invalid_input", { message:"review_id_required" });
  }

  const items = await readItems(env);
  const hit = items.find(x => String(x.id) === id);
  if(!hit){
    return json(404, "not_found", { message:"review_not_found" });
  }

  if(String(hit.status) !== "approved"){
    return json(400, "invalid_input", { message:"review_not_approved" });
  }

  if(hit.applied_at){
    return json(400, "invalid_input", { message:"review_already_applied" });
  }

  const details = hit.details || {};
  const requested_change = String(details.requested_change || "").trim().toLowerCase();
  const now = nowSec();

  if(requested_change === "assign_role"){
    const target_user_id = String(hit.target_user_id || "").trim();
    const target_role_id = String(hit.target_role_id || "").trim();

    if(!target_user_id || !target_role_id){
      return json(400, "invalid_input", { message:"target_user_or_role_missing" });
    }

    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
      VALUES (?, ?, ?)
    `).bind(target_user_id, target_role_id, now).run();

    hit.applied_at = now;
    hit.applied_by = a.uid;
    hit.apply_result = {
      change: "assign_role",
      target_user_id,
      target_role_id,
      applied: true
    };

    await writeItems(env, items);
    return json(200, "ok", { applied: true, item: hit });
  }

  if(requested_change === "remove_role"){
    const target_user_id = String(hit.target_user_id || "").trim();
    const target_role_id = String(hit.target_role_id || "").trim();

    if(!target_user_id || !target_role_id){
      return json(400, "invalid_input", { message:"target_user_or_role_missing" });
    }

    await env.DB.prepare(`
      DELETE FROM user_roles
      WHERE user_id = ? AND role_id = ?
    `).bind(target_user_id, target_role_id).run();

    hit.applied_at = now;
    hit.applied_by = a.uid;
    hit.apply_result = {
      change: "remove_role",
      target_user_id,
      target_role_id,
      applied: true
    };

    await writeItems(env, items);
    return json(200, "ok", { applied: true, item: hit });
  }

  return json(400, "invalid_input", { message:"unsupported_requested_change" });
}
