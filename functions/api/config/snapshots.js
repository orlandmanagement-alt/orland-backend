import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

const PREFIX = "cfg_snapshot:";

async function hasSystemSettingsIsSecret(env){
  try{
    const r = await env.DB.prepare(`PRAGMA table_info(system_settings)`).all();
    const cols = (r.results || []).map(x => String(x.name || "").toLowerCase());
    return cols.includes("is_secret");
  }catch{
    return false;
  }
}

async function readAll(env, sql){
  const r = await env.DB.prepare(sql).all();
  return r.results || [];
}

async function createSnapshotPayload(env, meta = {}){
  const withSecret = await hasSystemSettingsIsSecret(env);

  const menus = await readAll(env, `
    SELECT id, code, label, path, parent_id, sort_order, icon, created_at, group_key
    FROM menus
    ORDER BY sort_order ASC, created_at ASC
  `);

  const roles = await readAll(env, `
    SELECT *
    FROM roles
    ORDER BY created_at ASC
  `);

  const role_menus = await readAll(env, `
    SELECT *
    FROM role_menus
    ORDER BY created_at ASC
  `);

  const user_roles = await readAll(env, `
    SELECT *
    FROM user_roles
    ORDER BY created_at ASC
  `);

  const system_settings = withSecret
    ? await readAll(env, `
      SELECT k, v, is_secret, updated_at
      FROM system_settings
      ORDER BY k ASC
    `)
    : await readAll(env, `
      SELECT k, v, updated_at
      FROM system_settings
      ORDER BY k ASC
    `);

  return {
    created_at: nowSec(),
    meta: {
      label: String(meta.label || "").trim() || "manual snapshot",
      actor_user_id: meta.actor_user_id || null
    },
    data: {
      menus,
      roles,
      role_menus,
      user_roles,
      system_settings
    }
  };
}

async function listSnapshots(env){
  const r = await env.DB.prepare(`
    SELECT k, v, updated_at
    FROM system_settings
    WHERE k LIKE ?
    ORDER BY updated_at DESC, k DESC
  `).bind(PREFIX + "%").all();

  return (r.results || []).map(x => {
    let parsed = null;
    try{ parsed = JSON.parse(String(x.v || "{}")); }catch{}
    return {
      key: String(x.k || ""),
      updated_at: Number(x.updated_at || 0),
      created_at: Number(parsed?.created_at || 0),
      label: String(parsed?.meta?.label || ""),
      actor_user_id: parsed?.meta?.actor_user_id || null
    };
  });
}

async function saveSnapshot(env, payload){
  const ts = nowSec();
  const key = PREFIX + ts + ":" + Math.random().toString(36).slice(2, 8);
  const value = JSON.stringify(payload);

  const withSecret = await hasSystemSettingsIsSecret(env);
  if(withSecret){
    await env.DB.prepare(`
      INSERT INTO system_settings (k, v, is_secret, updated_at)
      VALUES (?, ?, 0, ?)
      ON CONFLICT(k) DO UPDATE SET
        v = excluded.v,
        is_secret = excluded.is_secret,
        updated_at = excluded.updated_at
    `).bind(key, value, ts).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO system_settings (k, v, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(k) DO UPDATE SET
        v = excluded.v,
        updated_at = excluded.updated_at
    `).bind(key, value, ts).run();
  }

  return { key, updated_at: ts };
}

async function restoreSnapshot(env, key){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k = ?
    LIMIT 1
  `).bind(key).first();

  if(!row?.v){
    throw new Error("snapshot_not_found");
  }

  const parsed = JSON.parse(String(row.v || "{}"));
  const data = parsed?.data || {};

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM role_menus`),
    env.DB.prepare(`DELETE FROM user_roles`),
    env.DB.prepare(`DELETE FROM menus`)
  ]);

  for(const item of (data.roles || [])){
    const keys = Object.keys(item || {});
    const cols = keys.join(", ");
    const qs = keys.map(()=>"?").join(", ");
    await env.DB.prepare(`INSERT OR REPLACE INTO roles (${cols}) VALUES (${qs})`)
      .bind(...keys.map(k => item[k]))
      .run();
  }

  for(const item of (data.menus || [])){
    const keys = Object.keys(item || {});
    const cols = keys.join(", ");
    const qs = keys.map(()=>"?").join(", ");
    await env.DB.prepare(`INSERT OR REPLACE INTO menus (${cols}) VALUES (${qs})`)
      .bind(...keys.map(k => item[k]))
      .run();
  }

  for(const item of (data.role_menus || [])){
    const keys = Object.keys(item || {});
    const cols = keys.join(", ");
    const qs = keys.map(()=>"?").join(", ");
    await env.DB.prepare(`INSERT OR REPLACE INTO role_menus (${cols}) VALUES (${qs})`)
      .bind(...keys.map(k => item[k]))
      .run();
  }

  for(const item of (data.user_roles || [])){
    const keys = Object.keys(item || {});
    const cols = keys.join(", ");
    const qs = keys.map(()=>"?").join(", ");
    await env.DB.prepare(`INSERT OR REPLACE INTO user_roles (${cols}) VALUES (${qs})`)
      .bind(...keys.map(k => item[k]))
      .run();
  }

  const withSecret = await hasSystemSettingsIsSecret(env);
  for(const item of (data.system_settings || [])){
    if(String(item.k || "").startsWith(PREFIX)) continue;

    if(withSecret && Object.prototype.hasOwnProperty.call(item, "is_secret")){
      await env.DB.prepare(`
        INSERT INTO system_settings (k, v, is_secret, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(k) DO UPDATE SET
          v = excluded.v,
          is_secret = excluded.is_secret,
          updated_at = excluded.updated_at
      `).bind(
        item.k,
        item.v,
        Number(item.is_secret || 0),
        Number(item.updated_at || nowSec())
      ).run();
    }else{
      await env.DB.prepare(`
        INSERT INTO system_settings (k, v, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(k) DO UPDATE SET
          v = excluded.v,
          updated_at = excluded.updated_at
      `).bind(
        item.k,
        item.v,
        Number(item.updated_at || nowSec())
      ).run();
    }
  }
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin", "audit_admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const items = await listSnapshots(env);
  return json(200, "ok", { items });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const action = String(body.action || "").trim().toLowerCase();

  if(action === "create"){
    const payload = await createSnapshotPayload(env, {
      label: body.label,
      actor_user_id: a.uid
    });
    const saved = await saveSnapshot(env, payload);
    return json(200, "ok", {
      created: true,
      key: saved.key,
      updated_at: saved.updated_at
    });
  }

  if(action === "restore"){
    const key = String(body.key || "").trim();
    if(!key) return json(400, "invalid_input", { message:"snapshot_key_required" });

    try{
      await restoreSnapshot(env, key);
      return json(200, "ok", { restored: true, key });
    }catch(e){
      return json(400, "invalid_input", { message: String(e?.message || e) });
    }
  }

  if(action === "delete"){
    const key = String(body.key || "").trim();
    if(!key) return json(400, "invalid_input", { message:"snapshot_key_required" });

    await env.DB.prepare(`
      DELETE FROM system_settings
      WHERE k = ?
    `).bind(key).run();

    return json(200, "ok", { deleted: true, key });
  }

  return json(400, "invalid_input", { message:"invalid_action" });
}
