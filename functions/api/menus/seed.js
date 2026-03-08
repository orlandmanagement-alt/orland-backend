import { json, requireAuth } from "../../_lib.js";

export async function onRequestPost({ request, env }) {
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;
  if (!(a.roles || []).includes("super_admin")) return json(403, "forbidden", { message: "super_admin_only" });

  // run the same seed inline (kept here to avoid file reads in Pages runtime)
  // If you prefer, you can paste SQL into D1 console from db/seed-menus.sql
  const now = Math.floor(Date.now()/1000);

  // Ensure roles
  await env.DB.prepare(
    "INSERT INTO roles (id,name,created_at) SELECT lower(hex(randomblob(16))), 'super_admin', ? WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='super_admin')"
  ).bind(now).run();
  await env.DB.prepare(
    "INSERT INTO roles (id,name,created_at) SELECT lower(hex(randomblob(16))), 'admin', ? WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='admin')"
  ).bind(now).run();
  await env.DB.prepare(
    "INSERT INTO roles (id,name,created_at) SELECT lower(hex(randomblob(16))), 'staff', ? WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name='staff')"
  ).bind(now).run();

  // Upsert menus (stable IDs)
  const menus = [
    ["menu_dashboard","dashboard","Dashboard","/dashboard",null,10,"fa-solid fa-gauge-high"],
    ["menu_users","users","User Manager","/users",null,20,"fa-solid fa-users-gear"],
    ["menu_users_admin","users_admin","Admin Users","/users/admin","menu_users",21,"fa-solid fa-user-shield"],
    ["menu_users_client","users_client","Client Users","/users/client","menu_users",22,"fa-solid fa-building"],
    ["menu_users_talent","users_talent","Talent Directory","/users/talent","menu_users",23,"fa-solid fa-star"],
    ["menu_users_tenant","users_tenant","Tenant Mapping","/users/tenant","menu_users",24,"fa-solid fa-sitemap"],
    ["menu_projects","projects","Projects / Jobs","/projects",null,30,"fa-solid fa-briefcase"],

    ["menu_integrations","integrations","Integrations","/integrations",null,40,"fa-solid fa-plug"],
    ["menu_blogspot","blogspot","Blogspot CMS","/blogspot","menu_integrations",41,"fa-brands fa-blogger"],
    ["menu_blogspot_settings","blogspot_settings","API Settings","/blogspot/settings","menu_blogspot",42,"fa-solid fa-key"],
    ["menu_blogspot_posts","blogspot_posts","Manage Posts","/blogspot/posts","menu_blogspot",43,"fa-solid fa-newspaper"],
    ["menu_blogspot_pages","blogspot_pages","Static Pages","/blogspot/pages","menu_blogspot",44,"fa-solid fa-file-lines"],
    ["menu_blogspot_widgets","blogspot_widgets","Widgets / Home","/blogspot/widgets","menu_blogspot",45,"fa-solid fa-puzzle-piece"],

    ["menu_security","security","Security","/security",null,60,"fa-solid fa-shield-halved"],
    ["menu_audit","audit","Audit Logs","/audit",null,61,"fa-solid fa-clipboard-list"],
    ["menu_ipblocks","ipblocks","IP Blocks","/ipblocks",null,62,"fa-solid fa-ban"],

    ["menu_ops","ops","OPS Management","/ops",null,70,"fa-solid fa-satellite-dish"],
    ["menu_ops_incidents","ops_incidents","Incidents & Alerts","/ops/incidents","menu_ops",71,"fa-solid fa-triangle-exclamation"],
    ["menu_ops_oncall","ops_oncall","On-Call Schedule","/ops/oncall","menu_ops",72,"fa-solid fa-user-clock"],

    ["menu_data","data","Data Management","/data",null,80,"fa-solid fa-database"],
    ["menu_data_export","data_export","Export Data","/data/export","menu_data",81,"fa-solid fa-file-export"],
    ["menu_data_import","data_import","Import Data","/data/import","menu_data",82,"fa-solid fa-file-import"],

    ["menu_config","config","Configuration","/config",null,90,"fa-solid fa-sliders"],
    ["menu_config_banned","config_banned","Banned User / IP","/config/banned","menu_config",91,"fa-solid fa-user-lock"],
    ["menu_config_otp","config_otp","OTP Settings","/config/otp","menu_config",92,"fa-solid fa-message"],
    ["menu_config_verify","config_verify","Verification","/config/verify","menu_config",93,"fa-solid fa-id-card"],

    ["menu_profile","profile","My Profile","/profile",null,999,"fa-solid fa-id-badge"],
  ];

  const stmt = env.DB.prepare(
    `INSERT OR REPLACE INTO menus (id,code,label,path,parent_id,sort_order,icon,created_at)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  for (const m of menus) {
    await stmt.bind(m[0], m[1], m[2], m[3], m[4], m[5], m[6], now).run();
  }

  // role ids
  const r_sa = await env.DB.prepare("SELECT id FROM roles WHERE name='super_admin' LIMIT 1").first();
  const r_ad = await env.DB.prepare("SELECT id FROM roles WHERE name='admin' LIMIT 1").first();
  const r_st = await env.DB.prepare("SELECT id FROM roles WHERE name='staff' LIMIT 1").first();

  if (!r_sa?.id || !r_ad?.id || !r_st?.id) return json(500, "server_error", { message: "roles_missing_after_seed" });

  // Super admin: all menus
  await env.DB.prepare(
    `INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
     SELECT ?, id, ? FROM menus`
  ).bind(r_sa.id, now).run();

  // Admin: all except otp/verify (default)
  await env.DB.prepare(
    `INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
     SELECT ?, id, ? FROM menus
     WHERE id NOT IN ('menu_config_otp','menu_config_verify')`
  ).bind(r_ad.id, now).run();

  // Staff: limited
  await env.DB.prepare(
    `INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
     SELECT ?, id, ? FROM menus
     WHERE id IN ('menu_dashboard','menu_users','menu_users_admin','menu_users_talent','menu_projects','menu_security','menu_profile')`
  ).bind(r_st.id, now).run();

  return json(200, "ok", { seeded: true, menus: menus.length });
}
