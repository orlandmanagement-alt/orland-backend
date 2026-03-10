import { json, requireAuth, hasRole } from "../../_lib.js";

async function getState(env, k){
  const row = await env.DB.prepare(
    "SELECT v, updated_at FROM blogspot_sync_state WHERE k=? LIMIT 1"
  ).bind(k).first();
  return row || null;
}

async function getConfig(env, k){
  const row = await env.DB.prepare(
    "SELECT v, updated_at FROM blogspot_sync_config WHERE k=? LIMIT 1"
  ).bind(k).first();
  return row || null;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin","staff"])) return json(403, "forbidden", null);

  const data = {
    state: {
      last_run_at: (await getState(env, "last_run_at"))?.v || "0",
      last_success_at: (await getState(env, "last_success_at"))?.v || "0",
      last_status: (await getState(env, "last_status"))?.v || "idle",
      last_message: (await getState(env, "last_message"))?.v || ""
    },
    config: {
      enabled: (await getConfig(env, "enabled"))?.v || "0",
      auto_sync_enabled: (await getConfig(env, "auto_sync_enabled"))?.v || "0",
      sync_interval_min: (await getConfig(env, "sync_interval_min"))?.v || "15",
      sync_posts_enabled: (await getConfig(env, "sync_posts_enabled"))?.v || "1",
      sync_pages_enabled: (await getConfig(env, "sync_pages_enabled"))?.v || "1",
      sync_direction: (await getConfig(env, "sync_direction"))?.v || "bidirectional"
    }
  };

  return json(200, "ok", data);
}
