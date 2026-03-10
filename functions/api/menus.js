import { json, requireAuth, hasRole, readJson, nowSec } from "../_lib.js";

function s(v){
  return String(v || "").trim();
}

function n(v, d = 50){
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/,"");
  return p || "/";
}

async function getAllRoles(env){
  const r = await env.DB.prepare(`
    SELECT id, name
    FROM roles
    ORDER BY name ASC
  `).all();
  return r.results || [];
}

async function getRoleRowsByNames(env, names){
  const clean = [...new Set((names || []).map(x => String(x || "").trim()).filter(Boolean))];
  if(!clean.length) return [];

  const ph = clean.map(() => "?").join(",");
  const r = await env.DB.prepare(`
    SELECT id, name
    FROM roles
    WHERE name IN (${ph})
    ORDER BY name ASC
  `).bind(...clean).all();

  return r.results || [];
}

async function listMenus(env){
  const menusR = await env.DB.prepare(`
    SELECT
      m.id,
      m.code,
      m.label,
      m.path,
      m.parent_id,
      m.sort_order,
      m.icon,
      m.created_at,
      COALESCE((
        SELECT json_group_array(name)
        FROM (
          SELECT r.name AS name
          FROM role_menus rm
          JOIN roles r ON r.id = rm.role_id
          WHERE rm.menu_id = m.id
          ORDER BY r.name ASC
        )
      ), '[]') AS role_names_json
    FROM menus m
    ORDER BY m.sort_order ASC, m.created_at ASC
  `).all();

  return (menusR.results || []).map(row => {
    let role_names = [];
    try{
      role_names = JSON.parse(row.role_names_json || "[]");
      if(!Array.isArray(role_names)) role_names = [];
    }catch{
      role_names = [];
    }

    return {
      id: row.id,
      code: row.code || "",
      label: row.label || "",
      path: row.path || "/",
      parent_id: row.parent_id || null,
      sort_order: Number(row.sort_order ?? 50),
      icon: row.icon || "",
      created_at: Number(row.created_at ?? 0),
      role_names
    };
  });
}

async function handleCreateOrUpdate(env, body, mode){
  const id = s(body.id);
  const code = s(body.code);
  const label = s(body.label);
  const path = normPath(body.path || "/");
  const parent_id = s(body.parent_id || "") || null;
  const sort_order = n(body.sort_order, 50);
  const icon = s(body.icon || "") || null;

  if(!id || !code || !label){
    return json(400, "invalid_input", {
      error: "id_code_label_required"
    });
  }

  if(id === code){
    return json(400, "invalid_input", {
      error: "menu_id_must_differ_from_code"
    });
  }

  if(parent_id && parent_id === id){
    return json(400, "invalid_input", {
      error: "parent_id_must_differ_from_id"
    });
  }

  if(parent_id){
    const parent = await env.DB.prepare(`
      SELECT id FROM menus WHERE id = ?
    `).bind(parent_id).first();

    if(!parent){
      return json(400, "invalid_input", {
        error: "parent_not_found"
      });
    }
  }

  let roleNames = Array.isArray(body.roles)
    ? body.roles.map(x => String(x || "").trim()).filter(Boolean)
    : [];

  if(!roleNames.length){
    const allRoles = await getAllRoles(env);
    roleNames = allRoles.map(x => x.name);
  }

  const roleRows = await getRoleRowsByNames(env, roleNames);
  const now = nowSec();

  if(mode === "update"){
    const existing = await env.DB.prepare(`
      SELECT id FROM menus WHERE id = ?
    `).bind(id).first();

    if(!existing){
      return json(404, "not_found", {
        error: "menu_not_found"
      });
    }

    const dupCode = await env.DB.prepare(`
      SELECT id
      FROM menus
      WHERE code = ? AND id <> ?
      LIMIT 1
    `).bind(code, id).first();

    if(dupCode){
      return json(409, "invalid_input", {
        error: "menu_code_already_exists"
      });
    }

    const dupPath = await env.DB.prepare(`
      SELECT id
      FROM menus
      WHERE path = ? AND id <> ?
      LIMIT 1
    `).bind(path, id).first();

    if(dupPath){
      return json(409, "invalid_input", {
        error: "menu_path_already_exists"
      });
    }

    await env.DB.prepare(`
      UPDATE menus
      SET code = ?, label = ?, path = ?, parent_id = ?, sort_order = ?, icon = ?
      WHERE id = ?
    `).bind(code, label, path, parent_id, sort_order, icon, id).run();

    await env.DB.prepare(`
      DELETE FROM role_menus
      WHERE menu_id = ?
    `).bind(id).run();

    for(const role of roleRows){
      await env.DB.prepare(`
        INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
        VALUES (?, ?, ?)
      `).bind(role.id, id, now).run();
    }

    return json(200, "ok", {
      saved: true,
      action: "update",
      id,
      roles: roleRows.map(x => x.name)
    });
  }

  const existing = await env.DB.prepare(`
    SELECT id FROM menus WHERE id = ?
  `).bind(id).first();

  if(existing){
    return json(409, "invalid_input", {
      error: "menu_id_already_exists"
    });
  }

  const dupCode = await env.DB.prepare(`
    SELECT id
    FROM menus
    WHERE code = ?
    LIMIT 1
  `).bind(code).first();

  if(dupCode){
    return json(409, "invalid_input", {
      error: "menu_code_already_exists"
    });
  }

  const dupPath = await env.DB.prepare(`
    SELECT id
    FROM menus
    WHERE path = ?
    LIMIT 1
  `).bind(path).first();

  if(dupPath){
    return json(409, "invalid_input", {
      error: "menu_path_already_exists"
    });
  }

  await env.DB.prepare(`
    INSERT INTO menus (
      id, code, label, path, parent_id, sort_order, icon, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, code, label, path, parent_id, sort_order, icon, now).run();

  for(const role of roleRows){
    await env.DB.prepare(`
      INSERT OR IGNORE INTO role_menus (role_id, menu_id, created_at)
      VALUES (?, ?, ?)
    `).bind(role.id, id, now).run();
  }

  return json(200, "ok", {
    saved: true,
    action: "create",
    id,
    roles: roleRows.map(x => x.name)
  });
}

async function handleDelete(env, body){
  const id = s(body.id);

  if(!id){
    return json(400, "invalid_input", {
      error: "id_required"
    });
  }

  const menu = await env.DB.prepare(`
    SELECT id, code, label
    FROM menus
    WHERE id = ?
  `).bind(id).first();

  if(!menu){
    return json(404, "not_found", {
      error: "menu_not_found"
    });
  }

  const child = await env.DB.prepare(`
    SELECT id, label
    FROM menus
    WHERE parent_id = ?
    ORDER BY sort_order ASC, created_at ASC
    LIMIT 1
  `).bind(id).first();

  if(child){
    return json(409, "invalid_input", {
      error: "menu_has_children",
      child
    });
  }

  await env.DB.prepare(`
    DELETE FROM role_menus
    WHERE menu_id = ?
  `).bind(id).run();

  await env.DB.prepare(`
    DELETE FROM menus
    WHERE id = ?
  `).bind(id).run();

  return json(200, "ok", {
    deleted: {
      id: menu.id,
      code: menu.code,
      label: menu.label
    }
  });
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const roles = await getAllRoles(env);
  const menus = await listMenus(env);

  return json(200, "ok", {
    roles,
    menus
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const action = s(body.action || body.mode || "create").toLowerCase();

  if(action === "create"){
    return await handleCreateOrUpdate(env, body, "create");
  }

  if(action === "update" || action === "edit"){
    return await handleCreateOrUpdate(env, body, "update");
  }

  if(action === "delete"){
    return await handleDelete(env, body);
  }

  return json(400, "invalid_input", {
    error: "invalid_action"
  });
}
