import { json, readJson, requireAuth, hasRole, nowSec, sha256Base64, audit } from "../_lib.js";

function allowed(a){
  return hasRole(a.roles, ["super_admin","admin"]);
}

function normIpRaw(s){
  return String(s||"").trim();
}

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(ip + "|" + pepper);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const active = String(url.searchParams.get("active") || "1");
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "100")));

  let r;
  if(active === "1"){
    r = await env.DB.prepare(`
      SELECT id, ip_hash, reason, created_at, expires_at, revoked_at, actor_user_id
      FROM ip_blocks
      WHERE revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(nowSec(), limit).all();
  }else{
    r = await env.DB.prepare(`
      SELECT id, ip_hash, reason, created_at, expires_at, revoked_at, actor_user_id
      FROM ip_blocks
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(limit).all();
  }

  return json(200,"ok",{ items: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action || "block").trim();

  if(action === "block"){
    const ip_raw = normIpRaw(body.ip || body.ip_raw || "");
    const ttl_sec = Math.max(60, Number(body.ttl_sec || 86400));
    const reason = String(body.reason || "manual_block").trim();

    if(!ip_raw) return json(400,"invalid_input",{ message:"ip_required" });

    const ip_hash = await hashIp(env, ip_raw);
    const id = crypto.randomUUID();
    const now = nowSec();
    const expires_at = now + ttl_sec;

    await env.DB.prepare(`
      INSERT INTO ip_blocks (id, ip_hash, reason, created_at, expires_at, revoked_at, actor_user_id)
      VALUES (?,?,?,?,?,?,?)
    `).bind(id, ip_hash, reason, now, expires_at, null, a.uid).run();

    await audit(env, {
      actor_user_id: a.uid,
      action: "ip_block_create",
      route: "/api/ip-blocks",
      http_status: 200,
      meta: { reason, ttl_sec }
    });

    return json(200,"ok",{ blocked:true, id, ip_hash, expires_at });
  }

  if(action === "unblock"){
    const id = String(body.id || "").trim();
    if(!id) return json(400,"invalid_input",{ message:"id_required" });

    await env.DB.prepare(`
      UPDATE ip_blocks
      SET revoked_at=?
      WHERE id=? AND revoked_at IS NULL
    `).bind(nowSec(), id).run();

    await audit(env, {
      actor_user_id: a.uid,
      action: "ip_block_revoke",
      route: "/api/ip-blocks",
      http_status: 200,
      meta: { id }
    });

    return json(200,"ok",{ unblocked:true, id });
  }

  if(action === "purge"){
    const now = nowSec();
    const r = await env.DB.prepare(`
      DELETE FROM ip_blocks
      WHERE (expires_at IS NOT NULL AND expires_at <= ?)
         OR revoked_at IS NOT NULL
    `).bind(now).run();

    await audit(env, {
      actor_user_id: a.uid,
      action: "ip_block_purge",
      route: "/api/ip-blocks",
      http_status: 200,
      meta: { now }
    });

    return json(200,"ok",{ purged:true, meta:r.meta || null });
  }

  return json(400,"invalid_input",{ message:"unknown_action" });
}
