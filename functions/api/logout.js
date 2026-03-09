import { json, parseCookies, revokeSessionBySid, cookie } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  const c = parseCookies(request);
  const sid = c.sid || "";
  if (sid) await revokeSessionBySid(env, sid);

  const res = json(200, "ok", { logged_out: true });

  // Clear cookie (host-only) + safest flags
  // We set Max-Age=0 and also an expired cookie variant for some browsers.
  res.headers.append("set-cookie", cookie("sid", "deleted", { maxAge: 0 }));
  res.headers.append("set-cookie", cookie("sid", "", { maxAge: 0, sameSite: "Lax" }));
  return res;
}
