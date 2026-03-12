import { json, readJson } from "../../../_lib.js";
import { requireBlogspotAccess, getSyncConfigValue } from "./_service.js";

async function setConfig(env, k, v){
  await env.DB.prepare(`
    INSERT INTO blogspot_sync_config (k, v, updated_at)
    VALUES (?, ?, strftime('%s','now'))
    ON CONFLICT(k) DO UPDATE SET
      v=excluded.v,
      updated_at=excluded.updated_at
  `).bind(k, String(v ?? "")).run();
}

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  return json(200, "ok", {
    write_lock_enabled: await getSyncConfigValue(env, "write_lock_enabled", "0"),
    maintenance_mode: await getSyncConfigValue(env, "maintenance_mode", "0"),
    maintenance_notice: await getSyncConfigValue(env, "maintenance_notice", "Production maintenance mode is active. Review changes carefully."),
    delete_confirm_phrase: await getSyncConfigValue(env, "delete_confirm_phrase", "DELETE REMOTE BLOGSPOT"),
    published_change_confirm: await getSyncConfigValue(env, "published_change_confirm", "CONFIRM PUBLISHED CHANGE"),
    remote_delete_requires_approval: await getSyncConfigValue(env, "remote_delete_requires_approval", "1")
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};

  await setConfig(env, "write_lock_enabled", body.write_lock_enabled ? "1" : "0");
  await setConfig(env, "maintenance_mode", body.maintenance_mode ? "1" : "0");
  await setConfig(env, "maintenance_notice", String(body.maintenance_notice || "Production maintenance mode is active. Review changes carefully."));
  await setConfig(env, "delete_confirm_phrase", String(body.delete_confirm_phrase || "DELETE REMOTE BLOGSPOT"));
  await setConfig(env, "published_change_confirm", String(body.published_change_confirm || "CONFIRM PUBLISHED CHANGE"));
  await setConfig(env, "remote_delete_requires_approval", body.remote_delete_requires_approval === false ? "0" : "1");

  return json(200, "ok", { saved:true });
}
