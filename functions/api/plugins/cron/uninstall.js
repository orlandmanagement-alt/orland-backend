import { ensureSetting, removeRoleMenusByPrefix, removeMenusByPrefix } from "../_plugin_common.js";

export async function run({ env, actor }){
  // SAFE uninstall: no drop
  await removeRoleMenusByPrefix(env, "p_cron_");
  await removeMenusByPrefix(env, "p_cron_");

  await ensureSetting(env, "cron:enabled", "0", 0);
  await ensureSetting(env, "plugin:cron:uninstalled_at", String(Math.floor(Date.now()/1000)), 0);
  await ensureSetting(env, "plugin:cron:uninstalled_by", String(actor?.uid||""), 0);

  return { ok:true, removed_menu_prefix:"p_cron_" };
}
