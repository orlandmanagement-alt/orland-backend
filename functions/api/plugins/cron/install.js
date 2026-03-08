import { ensureSetting, ensureTable, ensureIndex, seedMenus, seedRoleMenus, ensureRoleId } from "../_plugin_common.js";

export async function run({ env, actor }){
  // Create minimal cron jobs table (safe)
  await ensureTable(env, `
CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  schedule TEXT NOT NULL,
  handler TEXT NOT NULL,
  config_json TEXT NOT NULL DEFAULT '{}',
  last_run_at INTEGER,
  last_status TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);
  await ensureIndex(env, `CREATE INDEX IF NOT EXISTS idx_cron_jobs_enabled ON cron_jobs(enabled, updated_at);`);

  // Default job example (disabled)
  const now = Math.floor(Date.now()/1000);
  await env.DB.prepare(`
    INSERT OR IGNORE INTO cron_jobs (id,code,enabled,schedule,handler,config_json,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind("cron_health","health_check",0,"*/15 * * * *","health_check","{}",now,now).run();

  // Settings
  await ensureSetting(env, "cron:enabled", "0", 0);
  await ensureSetting(env, "cron:mode", "manual", 0); // manual|scheduled (future)
  await ensureSetting(env, "plugin:cron:installed_at", String(now), 0);
  await ensureSetting(env, "plugin:cron:installed_by", String(actor?.uid||""), 0);

  // Optional menu under OPS (prefix p_cron_)
  const menus = [
    { id:"p_cron_maintenance", code:"ops_maintenance", label:"Maintenance", path:"/ops/maintenance", parent_id:null, sort_order:85, icon:"fa-solid fa-screwdriver-wrench" }
  ];
  await seedMenus(env, menus);

  const rSuper = await ensureRoleId(env, "super_admin", "role_super_admin");
  const rAdmin = await ensureRoleId(env, "admin", "role_admin");
  await seedRoleMenus(env, [rSuper, rAdmin], menus.map(x=>x.id));

  return { ok:true, tables:["cron_jobs"], menus_seeded: menus.length };
}
