import { json, requireAuth } from "../../_lib.js";

export async function onRequestGet({ request, env }) {
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;

  // only super_admin can view schema
  if (!(a.roles || []).includes("super_admin")) return json(403, "forbidden", { message: "super_admin_only" });

  const tables = await env.DB.prepare(
    "SELECT name, sql FROM sqlite_schema WHERE type='table' ORDER BY name ASC"
  ).all();

  // table_info for key tables
  async function info(name){
    try{
      const r = await env.DB.prepare(`PRAGMA table_info('${name}')`).all();
      return r.results || [];
    }catch{
      return [];
    }
  }

  return json(200, "ok", {
    tables: (tables.results || []).map(t => ({ name: t.name, sql: t.sql })),
    table_info: {
      users: await info("users"),
      roles: await info("roles"),
      user_roles: await info("user_roles"),
      menus: await info("menus"),
      role_menus: await info("role_menus"),
      sessions: await info("sessions"),
      audit_logs: await info("audit_logs"),
      ip_blocks: await info("ip_blocks"),
      hourly_metrics: await info("hourly_metrics"),
    }
  });
}
