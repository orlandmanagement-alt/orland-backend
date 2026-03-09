import { ensureSetting, ensureTable, ensureIndex, seedMenus, seedRoleMenus, ensureRoleId } from "../_plugin_common.js";

// IMPORTANT: in plugin folder -> _lib would be "../../../_lib.js" if needed. We don't need it here.

export async function run({ env, actor }){
  // 1) Tables
  await ensureTable(env, `
CREATE TABLE IF NOT EXISTS integration_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);
  await ensureIndex(env, `CREATE INDEX IF NOT EXISTS idx_integration_provider ON integration_accounts(provider, status);`);

  await ensureTable(env, `
CREATE TABLE IF NOT EXISTS cms_items (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT,
  content_html TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);
  await ensureIndex(env, `CREATE INDEX IF NOT EXISTS idx_cms_items_kind ON cms_items(account_id, kind, status, updated_at);`);
  await ensureIndex(env, `CREATE UNIQUE INDEX IF NOT EXISTS idx_cms_items_ext ON cms_items(account_id, kind, slug);`);

  await ensureTable(env, `
CREATE TABLE IF NOT EXISTS cms_widgets (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  widget TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`);
  await ensureIndex(env, `CREATE UNIQUE INDEX IF NOT EXISTS idx_cms_widgets_key ON cms_widgets(account_id, widget);`);

  // 2) Seed global integration account (single scope: system/global via fixed id)
  // Use stable id: blogspot_global
  const now = Math.floor(Date.now()/1000);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO integration_accounts (id,provider,status,config_json,created_at,updated_at) VALUES (?,?,?,?,?,?)"
  ).bind("blogspot_global","blogspot","inactive","{}",now,now).run();

  // 3) Store simple settings keys in system_settings (so UI can read/write)
  await ensureSetting(env, "blogspot:account_id", "blogspot_global", 0);
  await ensureSetting(env, "blogspot:mode", "manual", 0); // manual|cron
  await ensureSetting(env, "blogspot:enabled", "0", 0);

  // 4) Seed menus (optional, id prefix "p_blog_")
  const menus = [
    { id:"p_blogspot_root", code:"blogspot", label:"Blogspot CMS", path:"/integrations/blogspot", parent_id:null, sort_order:60, icon:"fa-brands fa-blogger" },
    { id:"p_blogspot_settings", code:"blogspot_settings", label:"API Settings", path:"/integrations/blogspot/settings", parent_id:"p_blogspot_root", sort_order:61, icon:"fa-solid fa-key" },
    { id:"p_blogspot_posts", code:"blogspot_posts", label:"Manage Posts", path:"/integrations/blogspot/posts", parent_id:"p_blogspot_root", sort_order:62, icon:"fa-solid fa-pen-nib" },
    { id:"p_blogspot_pages", code:"blogspot_pages", label:"Static Pages", path:"/integrations/blogspot/pages", parent_id:"p_blogspot_root", sort_order:63, icon:"fa-solid fa-file-lines" },
    { id:"p_blogspot_widgets", code:"blogspot_widgets", label:"Widgets / Home", path:"/integrations/blogspot/widgets", parent_id:"p_blogspot_root", sort_order:64, icon:"fa-solid fa-grip" }
  ];
  await seedMenus(env, menus);

  // 5) Attach menus to roles (super_admin/admin only by default)
  const rSuper = await ensureRoleId(env, "super_admin", "role_super_admin");
  const rAdmin = await ensureRoleId(env, "admin", "role_admin");
  await seedRoleMenus(env, [rSuper, rAdmin], menus.map(x=>x.id));

  // 6) Mark installed (handled by /api/plugins/index.js), but also put a marker
  await ensureSetting(env, "plugin:blogspot:installed_at", String(now), 0);
  await ensureSetting(env, "plugin:blogspot:installed_by", String(actor?.uid||""), 0);

  return { ok:true, tables:["integration_accounts","cms_items","cms_widgets"], menus_seeded: menus.length };
}
