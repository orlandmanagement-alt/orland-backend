import { json, readJson, requireAuth, hasRole, sha256Base64 } from "../../../_lib.js";

function canManage(a){
  return hasRole(a.roles, ["super_admin","admin"]);
}
function s(v){ return String(v||"").trim(); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")||"50")));
  const q = s(url.searchParams.get("q")).toLowerCase();

  const now = Math.floor(Date.now()/1000);

  // NOTE: invites table schema in your DB: (id,email_hash,role,expires_at,used_at,used_by_user_id,created_by_user_id,created_at,tenant_id)
  // We can't show real email (hash only). We'll show status based on time/used_at.
  const wh = [];
  const args = [];
  wh.push("role='talent'");
  if(q){
    wh.push("(LOWER(id) LIKE ? OR LOWER(email_hash) LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }

  const whereSql = "WHERE " + wh.join(" AND ");

  const r = await env.DB.prepare(`
    SELECT id, email_hash, role, expires_at, used_at, used_by_user_id, created_by_user_id, created_at
    FROM invites
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(...args, limit).all();

  const rows = (r.results||[]).map(x=>{
    const expired = Number(x.expires_at||0) < now;
    const used = x.used_at != null;
    return {
      id: x.id,
      email_hash: x.email_hash,
      role: x.role,
      created_at: x.created_at,
      expires_at: x.expires_at,
      used_at: x.used_at,
      used_by_user_id: x.used_by_user_id,
      created_by_user_id: x.created_by_user_id,
      status: used ? "used" : (expired ? "expired" : "active"),
    };
  });

  return json(200,"ok",{ rows, now });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const email = s(body.email).toLowerCase();
  const ttl_hours = Math.max(1, Math.min(24*30, Number(body.ttl_hours||"72"))); // default 72h, max 30d

  if(!email.includes("@")) return json(400,"invalid_input",{message:"email_invalid"});

  const now = Math.floor(Date.now()/1000);
  const expires_at = now + (ttl_hours * 3600);
  const id = crypto.randomUUID();

  const pepper = env.HASH_PEPPER || "";
  const email_hash = await sha256Base64(`${email}|${pepper}`);

  await env.DB.prepare(`
    INSERT INTO invites (id,email_hash,role,expires_at,used_at,used_by_user_id,created_by_user_id,created_at,tenant_id)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).bind(
    id, email_hash, "talent", expires_at, null, null, a.uid, now, null
  ).run();

  // Link for UI
  const link = `${new URL(request.url).origin}/setup?invite=${encodeURIComponent(id)}`;

  return json(200,"ok",{ created:true, invite_id:id, expires_at, link, email_hash });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canManage(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = s(body.action);
  const id = s(body.id);

  if(!id) return json(400,"invalid_input",{message:"missing_id"});

  const now = Math.floor(Date.now()/1000);

  if(action === "revoke"){
    // best-effort revoke: expire immediately (keep used_at NULL)
    await env.DB.prepare(`UPDATE invites SET expires_at=? WHERE id=?`).bind(now-1, id).run();
    return json(200,"ok",{ revoked:true });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}
