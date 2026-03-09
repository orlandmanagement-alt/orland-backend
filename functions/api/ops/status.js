import { json, requireAuth, hasRole } from "../../_lib.js";

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403,"forbidden",null);

  const one = async (q)=> (await env.DB.prepare(q).first())?.c || 0;

  const users = await one("SELECT COUNT(*) AS c FROM users");
  const roles = await one("SELECT COUNT(*) AS c FROM roles");
  const menus = await one("SELECT COUNT(*) AS c FROM menus");
  const ip_blocks_active = await one("SELECT COUNT(*) AS c FROM ip_blocks WHERE revoked_at IS NULL AND expires_at > strftime('%s','now')");

  return json(200,"ok",{
    users, roles, menus, ip_blocks_active,
    now: Math.floor(Date.now()/1000)
  });
}
