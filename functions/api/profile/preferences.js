import { json, readJson, requireAuth, nowSec } from "../../_lib.js";

const ALLOWED_NAMESPACES = [
  "settings_center",
  "theme",
  "dashboard_layout",
  "pinned_menus",
  "table_prefs"
];

async function ensureTable(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS user_profile_settings (
      user_id TEXT NOT NULL,
      namespace TEXT NOT NULL,
      value_json TEXT NOT NULL DEFAULT '{}',
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, namespace)
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_user_profile_settings_updated_at
    ON user_profile_settings(updated_at DESC)
  `).run();
}

function isPlainObject(v){
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function normalizeNamespace(ns){
  return String(ns || "").trim().toLowerCase();
}

function normalizeValue(ns, value){
  const v = isPlainObject(value) ? value : {};

  if(ns === "settings_center"){
    return {
      favorites: Array.from(new Set((Array.isArray(v.favorites) ? v.favorites : []).map(x => String(x || "").trim()).filter(Boolean))).slice(0, 20),
      recents: Array.from(new Set((Array.isArray(v.recents) ? v.recents : []).map(x => String(x || "").trim()).filter(Boolean))).slice(0, 12)
    };
  }

  if(ns === "theme"){
    const mode = ["light","dark","system"].includes(String(v.mode || "")) ? String(v.mode) : "system";
    const density = ["compact","comfortable"].includes(String(v.density || "")) ? String(v.density) : "comfortable";
    return {
      mode,
      density
    };
  }

  if(ns === "dashboard_layout"){
    return {
      widgets: Array.isArray(v.widgets) ? v.widgets.slice(0, 50) : [],
      collapsed_sections: Array.isArray(v.collapsed_sections) ? v.collapsed_sections.map(x => String(x || "").trim()).filter(Boolean).slice(0, 50) : []
    };
  }

  if(ns === "pinned_menus"){
    return {
      items: Array.from(new Set((Array.isArray(v.items) ? v.items : []).map(x => String(x || "").trim()).filter(Boolean))).slice(0, 50)
    };
  }

  if(ns === "table_prefs"){
    return {
      tables: isPlainObject(v.tables) ? v.tables : {}
    };
  }

  return {};
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  await ensureTable(env);

  const url = new URL(request.url);
  const namespace = normalizeNamespace(url.searchParams.get("namespace"));

  if(namespace){
    if(!ALLOWED_NAMESPACES.includes(namespace)){
      return json(400, "invalid_input", { message: "invalid_namespace" });
    }

    const row = await env.DB.prepare(`
      SELECT value_json, updated_at
      FROM user_profile_settings
      WHERE user_id=? AND namespace=?
      LIMIT 1
    `).bind(a.user.id, namespace).first();

    let value = {};
    try{ value = JSON.parse(String(row?.value_json || "{}")); }catch{}

    return json(200, "ok", {
      namespace,
      value: normalizeValue(namespace, value),
      updated_at: Number(row?.updated_at || 0)
    });
  }

  const r = await env.DB.prepare(`
    SELECT namespace, value_json, updated_at
    FROM user_profile_settings
    WHERE user_id=?
      AND namespace IN (${ALLOWED_NAMESPACES.map(()=>"?").join(",")})
    ORDER BY namespace ASC
  `).bind(a.user.id, ...ALLOWED_NAMESPACES).all();

  const items = {};
  for(const row of (r.results || [])){
    const ns = normalizeNamespace(row.namespace);
    let value = {};
    try{ value = JSON.parse(String(row?.value_json || "{}")); }catch{}
    items[ns] = {
      value: normalizeValue(ns, value),
      updated_at: Number(row?.updated_at || 0)
    };
  }

  for(const ns of ALLOWED_NAMESPACES){
    if(!items[ns]){
      items[ns] = {
        value: normalizeValue(ns, {}),
        updated_at: 0
      };
    }
  }

  return json(200, "ok", {
    items
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  await ensureTable(env);

  const body = await readJson(request) || {};
  const namespace = normalizeNamespace(body.namespace);

  if(!ALLOWED_NAMESPACES.includes(namespace)){
    return json(400, "invalid_input", { message: "invalid_namespace" });
  }

  const value = normalizeValue(namespace, body.value || {});
  const ts = nowSec();

  await env.DB.prepare(`
    INSERT INTO user_profile_settings (user_id, namespace, value_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, namespace) DO UPDATE SET
      value_json=excluded.value_json,
      updated_at=excluded.updated_at
  `).bind(
    a.user.id,
    namespace,
    JSON.stringify(value),
    ts
  ).run();

  return json(200, "ok", {
    saved: true,
    namespace,
    value,
    updated_at: ts
  });
}
