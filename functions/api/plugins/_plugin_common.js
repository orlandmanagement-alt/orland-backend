import { nowSec } from "../../_lib.js";

export async function ensureSetting(env, k, v, is_secret=0){
  const now = nowSec();
  await env.DB.prepare(
    "INSERT INTO system_settings (k,v,is_secret,updated_at) VALUES (?,?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, is_secret=excluded.is_secret, updated_at=excluded.updated_at"
  ).bind(k, String(v ?? ""), Number(is_secret||0), now).run();
}

export async function getSetting(env, k){
  const r = await env.DB.prepare("SELECT v,is_secret FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
  return r ? { v: String(r.v||""), is_secret: Number(r.is_secret||0) } : null;
}

export async function ensureTable(env, sql){
  // D1 supports CREATE TABLE IF NOT EXISTS
  await env.DB.exec(sql);
}

export async function ensureIndex(env, sql){
  // D1 supports CREATE INDEX IF NOT EXISTS
  await env.DB.exec(sql);
}

export async function removeRoleMenusByPrefix(env, menuIdPrefix){
  // remove role_menus for menus.id startswith prefix
  await env.DB.prepare(
    "DELETE FROM role_menus WHERE menu_id IN (SELECT id FROM menus WHERE id LIKE ?)"
  ).bind(`${menuIdPrefix}%`).run();
}

export async function removeMenusByPrefix(env, menuIdPrefix){
  await env.DB.prepare("DELETE FROM menus WHERE id LIKE ?").bind(`${menuIdPrefix}%`).run();
}

export async function seedMenus(env, rows){
  // rows: [{id,code,label,path,parent_id,sort_order,icon}]
  const now = nowSec();
  for(const m of rows){
    await env.DB.prepare(
      "INSERT OR IGNORE INTO menus (id,code,label,path,parent_id,sort_order,icon,created_at) VALUES (?,?,?,?,?,?,?,?)"
    ).bind(
      m.id, m.code, m.label, m.path, m.parent_id||null,
      Number(m.sort_order||50), m.icon||null, now
    ).run();
  }
}

export async function seedRoleMenus(env, roleIds, menuIds){
  // roleIds: ['role_admin', ...] or actual roles.id
  const now = nowSec();
  for(const rid of roleIds){
    for(const mid of menuIds){
      await env.DB.prepare(
        "INSERT OR IGNORE INTO role_menus (role_id,menu_id,created_at) VALUES (?,?,?)"
      ).bind(rid, mid, now).run();
    }
  }
}

export async function ensureRoleId(env, name, fallbackId){
  // prefer existing roles row; if missing create minimal
  let r = await env.DB.prepare("SELECT id FROM roles WHERE name=? LIMIT 1").bind(name).first();
  if(r?.id) return String(r.id);

  // create with fallbackId if provided (so stable), else uuid
  const id = fallbackId || crypto.randomUUID();
  await env.DB.prepare("INSERT OR IGNORE INTO roles (id,name,created_at) VALUES (?,?,?)")
    .bind(id, name, nowSec()).run();
  return id;
}
