import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin"]); } // import is dangerous: super_admin only

function pickArr(obj, k){
  const a = obj?.tables?.[k];
  return Array.isArray(a) ? a : [];
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const body = await readJson(request);
  if(!body || typeof body !== "object") return json(400,"invalid_input",{message:"json"});

  const roles = pickArr(body,"roles");
  const menus = pickArr(body,"menus");
  const role_menus = pickArr(body,"role_menus");
  const user_roles = pickArr(body,"user_roles");
  const system_settings = pickArr(body,"system_settings");
  const alert_rules = pickArr(body,"alert_rules");

  const now = nowSec();

  // roles
  for(const r of roles){
    if(!r?.id || !r?.name) continue;
    await env.DB.prepare(`
      INSERT OR IGNORE INTO roles (id,name,created_at) VALUES (?,?,?)
    `).bind(String(r.id), String(r.name), Number(r.created_at||now)).run();
  }

  // menus
  for(const m of menus){
    if(!m?.id || !m?.code || !m?.label || !m?.path) continue;
    await env.DB.prepare(`
      INSERT OR IGNORE INTO menus (id,code,label,path,parent_id,sort_order,icon,created_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      String(m.id),
      String(m.code),
      String(m.label),
      String(m.path),
      m.parent_id ? String(m.parent_id) : null,
      Number(m.sort_order ?? 50),
      m.icon ? String(m.icon) : null,
      Number(m.created_at||now)
    ).run();
  }

  // role_menus
  for(const rm of role_menus){
    if(!rm?.role_id || !rm?.menu_id) continue;
    await env.DB.prepare(`
      INSERT OR IGNORE INTO role_menus (role_id,menu_id,created_at) VALUES (?,?,?)
    `).bind(String(rm.role_id), String(rm.menu_id), Number(rm.created_at||now)).run();
  }

  // user_roles (optional)
  for(const ur of user_roles){
    if(!ur?.user_id || !ur?.role_id) continue;
    await env.DB.prepare(`
      INSERT OR IGNORE INTO user_roles (user_id,role_id,created_at) VALUES (?,?,?)
    `).bind(String(ur.user_id), String(ur.role_id), Number(ur.created_at||now)).run();
  }

  // system_settings (upsert)
  for(const s of system_settings){
    if(!s?.k) continue;
    await env.DB.prepare(`
      INSERT INTO system_settings (k,v,is_secret,updated_at)
      VALUES (?,?,?,?)
      ON CONFLICT(k) DO UPDATE SET
        v=excluded.v,
        is_secret=excluded.is_secret,
        updated_at=excluded.updated_at
    `).bind(String(s.k), String(s.v||""), Number(s.is_secret||0), Number(s.updated_at||now)).run();
  }

  // alert_rules (insert ignore; admin can edit later)
  for(const ar of alert_rules){
    if(!ar?.id || !ar?.metric) continue;
    await env.DB.prepare(`
      INSERT OR IGNORE INTO alert_rules
        (id,enabled,metric,window_minutes,threshold,severity,cooldown_minutes,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(
      String(ar.id),
      Number(ar.enabled ?? 1) ? 1 : 0,
      String(ar.metric),
      Number(ar.window_minutes||60),
      Number(ar.threshold||1),
      String(ar.severity||"medium"),
      Number(ar.cooldown_minutes||60),
      Number(ar.created_at||now),
      Number(ar.updated_at||now)
    ).run();
  }

  return json(200,"ok",{ imported:true, counts:{
    roles: roles.length,
    menus: menus.length,
    role_menus: role_menus.length,
    user_roles: user_roles.length,
    system_settings: system_settings.length,
    alert_rules: alert_rules.length
  }});
}
