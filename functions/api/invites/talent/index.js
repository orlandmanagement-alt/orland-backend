import { json, readJson, requireAuth, hasRole, nowSec, normEmail, sha256Base64, randomB64 } from "../../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function allowedWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

function tokenB64(){
  // short safe token for URL
  return randomB64(24).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}

async function ensureRole(env, name){
  let r = await env.DB.prepare("SELECT id FROM roles WHERE name=? LIMIT 1").bind(name).first();
  if(r) return r.id;
  const id = "role_" + name;
  await env.DB.prepare("INSERT OR IGNORE INTO roles (id,name,created_at) VALUES (?,?,?)").bind(id,name,nowSec()).run();
  return id;
}

/**
 * Invites table exists in your DB:
 * invites(id,email_hash,role,expires_at,used_at,used_by_user_id,created_by_user_id,created_at,tenant_id)
 *
 * We store invite token in invites.id (safe URL token)
 * email_hash = sha256(email|HASH_PEPPER)
 */
export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));
  const only_active = (url.searchParams.get("active")||"1") === "1";

  const r = await env.DB.prepare(`
    SELECT
      id, role, expires_at, used_at, used_by_user_id, created_by_user_id, created_at, tenant_id
    FROM invites
    WHERE ( ? = 0 OR (used_at IS NULL AND expires_at > ?) )
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(only_active?1:0, nowSec(), limit).all();

  return json(200,"ok",{ invites: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowedWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const email = normEmail(body.email);
  const role = String(body.role||"talent").trim();
  const ttl_hours = Math.min(168, Math.max(1, Number(body.ttl_hours||"72"))); // 1h..7d

  if(!email.includes("@")) return json(400,"invalid_input",{message:"email"});
  if(role !== "talent") return json(400,"invalid_input",{message:"role_only_talent"});

  // ensure role exists
  await ensureRole(env, "talent");

  const pepper = env.HASH_PEPPER || "";
  if(!pepper) return json(500,"server_error",{message:"missing_env_HASH_PEPPER"});
  const email_hash = await sha256Base64(email + "|" + pepper);

  const now = nowSec();
  const id = tokenB64();
  const expires_at = now + (ttl_hours * 3600);

  await env.DB.prepare(`
    INSERT INTO invites (id,email_hash,role,expires_at,used_at,used_by_user_id,created_by_user_id,created_at,tenant_id)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(id, email_hash, "talent", expires_at, null, null, a.uid, now, null).run();

  const base = new URL(request.url).origin;
  const invite_url = base + "/talent/register?invite=" + encodeURIComponent(id);

  return json(200,"ok",{ created:true, id, expires_at, invite_url });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowedWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action||"");
  const id = String(body.id||"").trim();
  if(!id) return json(400,"invalid_input",{message:"id"});

  if(action === "revoke"){
    await env.DB.prepare(`
      UPDATE invites
      SET expires_at=?, used_at=COALESCE(used_at, ?)
      WHERE id=? AND used_at IS NULL
    `).bind(nowSec()-1, nowSec(), id).run();
    return json(200,"ok",{ revoked:true });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}
