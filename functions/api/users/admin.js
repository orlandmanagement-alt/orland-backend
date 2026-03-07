import { json, readJson, requireAuth, normEmail, pbkdf2Hash, sha256Base64, randomB64, hasRole } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

export async function onRequestGet({ request, env }) {
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;
  if (!allowed(a)) return json(403, "forbidden", null);

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));

  const rows = await env.DB.prepare(`
    SELECT
      u.id, u.email_norm, u.display_name, u.status,
      u.created_at, u.updated_at,
      (SELECT MAX(created_at) FROM sessions s WHERE s.user_id=u.id) AS last_login_at
    FROM users u
    WHERE
      u.email_norm LIKE ? OR u.display_name LIKE ?
    ORDER BY u.created_at DESC
    LIMIT ?
  `).bind(`%${q}%`, `%${q}%`, limit).all();

  const ids = (rows.results || []).map(x=>x.id);
  const roleMap = new Map();
  if (ids.length){
    const ph = ids.map(()=>"?").join(",");
    const rr = await env.DB.prepare(`
      SELECT ur.user_id, r.name
      FROM user_roles ur
      JOIN roles r ON r.id=ur.role_id
      WHERE ur.user_id IN (${ph})
    `).bind(...ids).all();
    for (const x of (rr.results||[])){
      const arr = roleMap.get(x.user_id) || [];
      arr.push(x.name);
      roleMap.set(x.user_id, arr);
    }
  }

  const users = (rows.results || []).map(u=>({
    ...u,
    roles: roleMap.get(u.id) || []
  })).filter(u=>{
    const rs = new Set(u.roles);
    return rs.has("super_admin") || rs.has("admin") || rs.has("staff");
  });

  return json(200, "ok", { users });
}

export async function onRequestPost({ request, env }) {
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;
  if (!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const body = await readJson(request);
  const email = normEmail(body?.email);
  const display_name = String(body?.display_name || "").trim();
  const role = String(body?.role || "staff").trim();
  const password = String(body?.password || "");

  if (!email.includes("@") || password.length < 10) return json(400, "invalid_input", null);
  if (!["staff","admin"].includes(role) && !hasRole(a.roles, ["super_admin"])) return json(403, "forbidden", { message:"role_not_allowed" });

  const used = await env.DB.prepare("SELECT id FROM users WHERE email_norm=? LIMIT 1").bind(email).first();
  if (used) return json(409, "conflict", { message:"email_used" });

  const now = Math.floor(Date.now()/1000);
  const id = crypto.randomUUID();
  const salt = randomB64(16);
  const iter = Math.min(100000, Number(env.PBKDF2_ITER || 100000));
  const hash = await pbkdf2Hash(password, salt, iter);

  const pepper = env.HASH_PEPPER || "";
  const email_hash = pepper ? await sha256Base64(`${email}|${pepper}`) : email;

  await env.DB.prepare(`
    INSERT INTO users (id,email_norm,email_hash,display_name,status,created_at,updated_at,password_hash,password_salt,password_iter,password_algo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).bind(id,email,email_hash,display_name||null,"active",now,now,hash,salt,iter,"pbkdf2_sha256").run();

  const rid = await env.DB.prepare("SELECT id FROM roles WHERE name=? LIMIT 1").bind(role).first();
  if (!rid) return json(500, "server_error", { message:"role_missing_in_db" });

  await env.DB.prepare("INSERT INTO user_roles (user_id,role_id,created_at) VALUES (?,?,?)")
    .bind(id, rid.id, now).run();

  return json(200, "ok", { created:true, id });
}

export async function onRequestPut({ request, env }) {
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;
  if (!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const body = await readJson(request);
  const action = String(body?.action || "");
  const user_id = String(body?.user_id || "");
  if (!user_id) return json(400, "invalid_input", null);

  const now = Math.floor(Date.now()/1000);

  if (action === "disable" || action === "enable"){
    const status = action === "disable" ? "disabled" : "active";
    await env.DB.prepare("UPDATE users SET status=?, updated_at=? WHERE id=?").bind(status, now, user_id).run();
    return json(200, "ok", { updated:true });
  }

  if (action === "reset_password"){
    const new_password = String(body?.new_password || "");
    if (new_password.length < 10) return json(400, "invalid_input", null);

    const salt = randomB64(16);
    const iter = Math.min(100000, Number(env.PBKDF2_ITER || 100000));
    const hash = await pbkdf2Hash(new_password, salt, iter);

    await env.DB.prepare(`
      UPDATE users
      SET password_hash=?, password_salt=?, password_iter=?, password_algo=?, updated_at=?
      WHERE id=?
    `).bind(hash, salt, iter, "pbkdf2_sha256", now, user_id).run();

    return json(200, "ok", { updated:true });
  }

  if (action === "revoke_sessions"){
    await env.DB.prepare("UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL").bind(now, user_id).run();
    return json(200, "ok", { revoked:true });
  }

  return json(400, "invalid_input", { message:"unknown_action" });
}
