import {
  json, readJson, pbkdf2Hash, timingSafeEqual, normEmail,
  getRolesForUser, createSession, requireEnv, cookie
} from "../_lib.js";

export async function onRequestPost({ request, env }) {
  // env check minimal
  const miss = requireEnv(env, ["HASH_PEPPER"]);
  if (miss.length) return json(500, "server_error", { message: "missing_env", missing: miss });

  const body = await readJson(request);
  const email = normEmail(body?.email);
  const password = String(body?.password || "");

  if (!email.includes("@") || password.length < 6) return json(400, "invalid_input", null);

  const u = await env.DB.prepare(
    "SELECT id,email_norm,display_name,status,password_hash,password_salt,password_iter FROM users WHERE email_norm=? LIMIT 1"
  ).bind(email).first();

  if (!u) return json(403, "user_belum_terdaftar", null);
  if (String(u.status) !== "active") return json(403, "forbidden", null);
  if (!u.password_hash || !u.password_salt) return json(403, "password_invalid", { message: "password_not_set" });

  // IMPORTANT: iter capped in pbkdf2Hash too, but we cap again just in case
  const iter = Math.min(100000, Number(u.password_iter || env.PBKDF2_ITER || 100000));
  const calc = await pbkdf2Hash(password, u.password_salt, iter);
  if (!timingSafeEqual(calc, u.password_hash)) return json(403, "password_invalid", null);

  const roles = await getRolesForUser(env, u.id);

  // Dashboard admin only (sesuai request kamu)
  const allowed = roles.includes("super_admin") || roles.includes("admin") || roles.includes("staff");
  if (!allowed) return json(403, "forbidden", { message: "role_not_allowed_for_dashboard" });

  // SID cookie = sessions.id
  const sess = await createSession(env, u.id, roles);

  const res = json(200, "ok", {
    id: u.id,
    email_norm: u.email_norm,
    display_name: u.display_name,
    roles,
    exp: sess.exp
  });

  // IMPORTANT: cookie value MUST be sess.sid
  res.headers.append("set-cookie", cookie("sid", sess.sid, { maxAge: sess.ttl }));
  return res;
}
