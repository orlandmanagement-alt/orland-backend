import { json, parseCookies, revokeSessionBySid, cookie } from "../../_lib.js";

export async function onRequestPost({ request, env }) {
  const c = parseCookies(request);
  const sid = c.sid || "";

  if (sid) {
    await revokeSessionBySid(env, sid);
  }

  const res = json(200, "ok", { logged_out: true });
  res.headers.append("set-cookie", cookie("sid", "deleted", { maxAge: 0 }));
  return res;
}
