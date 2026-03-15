import {
  json,
  readJson,
  pbkdf2Hash,
  timingSafeEqual,
  normEmail,
  getRolesForUser,
  createSession,
  cookie,
  audit,
  portalAccessFromRoles,
  canAccessPortal,
  defaultPortalFromRoles,
  portalRedirectUrl,
  inferCookieDomain
} from "../../_lib.js";

export async function onRequestPost({ request, env }) {
  const body = await readJson(request);

  const email = normEmail(body?.email);
  const password = String(body?.password || "");
  const requestedPortal = String(body?.portal || "").trim().toLowerCase();
  const nextPath = String(body?.next || "/").trim();

  if (!email.includes("@") || password.length < 1) {
    return json(400, "invalid_input", null);
  }

  const u = await env.DB.prepare(`
    SELECT
      id,
      email_norm,
      display_name,
      status,
      password_hash,
      password_salt,
      password_iter
    FROM users
    WHERE email_norm = ?
    LIMIT 1
  `).bind(email).first();

  if (!u) {
    return json(403, "invalid_credentials", null);
  }

  if (String(u.status || "") !== "active") {
    return json(403, "forbidden", { message: "user_inactive" });
  }

  if (!u.password_hash || !u.password_salt) {
    return json(403, "password_invalid", { message: "password_not_set" });
  }

  const iter = Math.min(100000, Number(u.password_iter || env.PBKDF2_ITER || 100000));
  const calc = await pbkdf2Hash(password, u.password_salt, iter);

  if (!timingSafeEqual(calc, u.password_hash)) {
    return json(403, "invalid_credentials", null);
  }

  const roles = await getRolesForUser(env, u.id);
  const portals = portalAccessFromRoles(roles);

  const targetPortal = requestedPortal || defaultPortalFromRoles(roles);

  if (!targetPortal) {
    return json(403, "forbidden", { message: "no_portal_access" });
  }

  if (requestedPortal && !canAccessPortal(roles, requestedPortal)) {
    return json(403, "forbidden", {
      message: "role_not_allowed_for_portal",
      portal: requestedPortal
    });
  }

  const sess = await createSession(env, u.id, roles);

  const res = json(200, "ok", {
    id: u.id,
    email_norm: u.email_norm,
    display_name: u.display_name,
    roles,
    portals,
    portal: targetPortal,
    redirect_url: portalRedirectUrl(env, targetPortal, nextPath),
    exp: sess.exp
  });

  const cookieOpt = {
    maxAge: sess.ttl,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax"
  };

  const domain = inferCookieDomain(request, env);
  if (domain) cookieOpt.domain = domain;

  res.headers.append("set-cookie", cookie("sid", sess.sid, cookieOpt));

  try {
    await audit(env, {
      actor_user_id: u.id,
      action: "auth.sso.login.ok",
      route: "POST /api/sso/login",
      http_status: 200,
      meta: { roles, portal: targetPortal }
    });
  } catch {}

  return res;
}
