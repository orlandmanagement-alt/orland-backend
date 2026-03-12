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

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin", "audit_admin"])){
    return json(403, "forbidden", null);
  }

  const items = await readItems(env);
  return json(200, "ok", { items });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const action = String(body.action || "").trim().toLowerCase();
  const items = await readItems(env);
  const now = nowSec();

  if(action === "submit"){
    if(!hasRole(a.roles, ["super_admin", "admin", "access_admin"])){
      return json(403, "forbidden", null);
    }

    const item = {
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
      created_by: a.uid,
      status: "pending",
      review_type: String(body.review_type || "access_change"),
      target_user_id: body.target_user_id || null,
      target_role_id: body.target_role_id || null,
      title: String(body.title || "Access Review"),
      details: body.details || {},
      reviewer_user_id: null,
      reviewer_note: null
    };

    items.unshift(item);
    await writeItems(env, items);
    return json(200, "ok", { submitted: true, item });
  }

  if(action === "approve" || action === "reject"){
    if(!hasRole(a.roles, ["super_admin", "access_admin", "audit_admin"])){
      return json(403, "forbidden", null);
    }

    const id = String(body.id || "").trim();
    const note = String(body.note || "").trim() || null;
    const hit = items.find(x => String(x.id) === id);
    if(!hit) return json(404, "not_found", { message:"review_not_found" });
    if(String(hit.status) !== "pending"){
      return json(400, "invalid_input", { message:"review_not_pending" });
    }

    hit.status = action === "approve" ? "approved" : "rejected";
    hit.updated_at = now;
    hit.reviewer_user_id = a.uid;
    hit.reviewer_note = note;

    await writeItems(env, items);
    return json(200, "ok", { updated: true, item: hit });
  }

  return json(400, "invalid_input", { message:"invalid_action" });
}
