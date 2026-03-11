import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

async function setConfig(env, k, v){
  await env.DB.prepare(`
    INSERT INTO blogspot_sync_config (k, v, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v=excluded.v,
      updated_at=excluded.updated_at
  `).bind(k, String(v ?? ""), nowSec()).run();
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

  return json(200, "ok", {
    enabled: (await getConfig(env, "enabled"))?.v || "0",
    auto_sync_enabled: (await getConfig(env, "auto_sync_enabled"))?.v || "0",
    sync_interval_min: (await getConfig(env, "sync_interval_min"))?.v || "15",
    sync_posts_enabled: (await getConfig(env, "sync_posts_enabled"))?.v || "1",
    sync_pages_enabled: (await getConfig(env, "sync_pages_enabled"))?.v || "1",
    sync_direction: (await getConfig(env, "sync_direction"))?.v || "bidirectional"
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const body = await readJson(request) || {};

  await setConfig(env, "enabled", body.enabled ? "1" : "0");
  await setConfig(env, "auto_sync_enabled", body.auto_sync_enabled ? "1" : "0");
  await setConfig(env, "sync_interval_min", Math.max(1, Number(body.sync_interval_min || 15)));
  await setConfig(env, "sync_posts_enabled", body.sync_posts_enabled === false ? "0" : "1");
  await setConfig(env, "sync_pages_enabled", body.sync_pages_enabled === false ? "0" : "1");

  const dir = String(body.sync_direction || "bidirectional");
  await setConfig(
    env,
    "sync_direction",
    ["pull", "push", "bidirectional"].includes(dir) ? dir : "bidirectional"
  );

  return json(200, "ok", { saved: true });
}
