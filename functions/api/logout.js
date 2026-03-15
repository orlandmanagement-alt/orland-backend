import {
  json,
  parseCookies,
  revokeSessionBySid,
  cookie,
  inferCookieDomain
} from "../_lib.js";

export async function onRequestPost({ request, env }) {
  const sid = String(parseCookies(request).sid || "").trim();

  if (sid) {
    await revokeSessionBySid(env, sid);
  }

  const res = json(200, "ok", { logged_out: true });

  const cookieOpt = {
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax"
  };

  const domain = inferCookieDomain(request, env);
  if (domain) cookieOpt.domain = domain;

  res.headers.append("set-cookie", cookie("sid", "", cookieOpt));

  return res;
}
