import { json, readJson, requireAuth, hasRole, nowSec } from "../../_lib.js";

const RESERVED_IDS = new Set([
  "role_super_admin", "super_admin",
  "role_admin", "admin",
  "role_staff", "staff",
  "role_client", "client",
  "role_talent", "talent",
  "role_security_admin", "security_admin"
]);

async function hasDescriptionColumn(env){
  try{
    const r = await env.DB.prepare(`PRAGMA table_info(roles)`).all();
    const cols = (r.results || []).map(x => String(x.name || "").toLowerCase());
    return cols.includes("description");
  }catch{
    return false;
  }
}

async function findMenusByCodes(env, codes){
  const out = [];
  for(const code of (codes || [])){
    const row = await env.DB.prepare(`
      SELECT id, code
      FROM menus
      WHERE code = ?
      LIMIT 1
    `).bind(String(code || "")).first();
    if(row) out.push({ id: String(row.id || ""), code: String(row.code || "") });
  }
  return out;
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const mode = String(body.mode || "clone_role").trim().toLowerCase();

  const new_role_id = String(body.new_role_id || "").trim();
  const new_role_name = String(body.new_role_name || "").trim();
  const description = String(body.description || "").trim();
  const now = nowSec();

  if(!new_role_id || !new_role_name){
    return json(400, "invalid_input", { message:"new_role_id_and_name_required" });
  }

  if(!/^[a-zA-Z0-9_\-]+$/.test(new_role_id)){
    return json(400, "invalid_input", { message:"new_role_id_invalid" });
  }

  if(RESERVED_IDS.has(new_role_id) || RESERVED_IDS.has(new_role_name.toLowerCase())){
    return json(400, "protected_role", { message:"reserved_role_id_or_name" });
  }

  const exists = await env.DB.prepare(`
    SELECT id
    FROM roles
    WHERE id = ? OR lower(name) = lower(?)
    LIMIT 1
  `).bind(new_role_id, new_role_name).first();

  if(exists){
    return json(400, "invalid_input", { message:"role_id_or_name_exists" });
  }

  const withDesc = await hasDescriptionColumn(env);
  if(withDesc){
    await env.DB.prepare(`
      INSERT INTO roles (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(new_role_id, new_role_name, description, now).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO roles (id, name, created_at)
      VALUES (?, ?, ?)
    `).bind(new_role_id, new_role_name, now).run();
  }

  let linked = 0;

  if(mode === "clone_role"){
    const source_role_id = String(body.source_role_id || "").trim();
    if(!source_role_id){
      return json(400, "invalid_input", { message:"source_role_id_required" });
    }

    const src = await env.DB.prepare(`
      SELECT role_id, menu_id
      FROM role_menus
      WHERE role_id = ?
    `).bind(source_role_id).all();

    for(const row of (src.results || [])){
      await env.DB.prepare(`
        INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
        VALUES (?, ?, ?)
      `).bind(new_role_id, String(row.menu_id || ""), now).run();
      linked++;
    }
  }else if(mode === "template"){
    const menu_codes = Array.isArray(body.menu_codes) ? body.menu_codes : [];
    const menus = await findMenusByCodes(env, menu_codes);
    for(const menu of menus){
      await env.DB.prepare(`
        INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
        VALUES (?, ?, ?)
      `).bind(new_role_id, menu.id, now).run();
      linked++;
    }
  }else{
    return json(400, "invalid_input", { message:"invalid_mode" });
  }

  return json(200, "ok", {
    created: true,
    role_id: new_role_id,
    role_name: new_role_name,
    linked_menu_count: linked
  });
}
