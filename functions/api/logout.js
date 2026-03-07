import { json, parseCookies, cookie, revokeSessionBySid } from "../_lib.js";

export async function onRequestPost({ request, env }) {
  const c = parseCookies(request);
  const sid = c.sid || "";

  if (sid) {
    await revokeSessionBySid(env, sid);
  }

  const res = json(200, "ok", { logged_out: true });
  // delete cookie
  res.headers.append("set-cookie", cookie("sid", "", { maxAge: 0 }));
  return res;
}
