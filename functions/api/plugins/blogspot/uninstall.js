import { ensureSetting, removeRoleMenusByPrefix, removeMenusByPrefix } from "../_plugin_common.js";

export async function run({ env, actor }){
  // SAFE uninstall:
  // - do NOT drop tables
  // - remove role_menus + menus (only plugin menus)
  // - disable plugin settings
  await removeRoleMenusByPrefix(env, "p_blogspot_");
  await removeMenusByPrefix(env, "p_blogspot_");

  await ensureSetting(env, "blogspot:enabled", "0", 0);
  await ensureSetting(env, "plugin:blogspot:uninstalled_at", String(Math.floor(Date.now()/1000)), 0);
  await ensureSetting(env, "plugin:blogspot:uninstalled_by", String(actor?.uid||""), 0);

  return { ok:true, removed_menu_prefix:"p_blogspot_" };
}
