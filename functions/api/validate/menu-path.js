import { json, requireAuth, hasRole } from "../../_lib.js";

function normPath(p){
  p = String(p || "").trim();
  if(!p) return "/";
  if(!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+/g, "/").replace(/\/+$/, "");
  return p || "/";
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const id = String(url.searchParams.get("id") || "").trim();
  const path = normPath(url.searchParams.get("path") || "/");

  const rows = await env.DB.prepare(`
    SELECT id, code, label, path
    FROM menus
    WHERE path = ?
    ORDER BY created_at ASC
  `).bind(path).all();

  const hits = (rows.results || []).filter(x => String(x.id || "") !== id);

  const warnings = [];
  if(path === "/"){
    warnings.push("Path root '/' sebaiknya tidak dipakai untuk menu dashboard internal.");
  }
  if(!/^\/[a-zA-Z0-9\-\/_]*$/.test(path)){
    warnings.push("Path berisi karakter yang tidak disarankan.");
  }
  if(path.includes("//")){
    warnings.push("Path mengandung slash ganda.");
  }

  return json(200, "ok", {
    valid: hits.length === 0,
    path,
    duplicate_count: hits.length,
    duplicates: hits.map(x => ({
      id: String(x.id || ""),
      code: String(x.code || ""),
      label: String(x.label || ""),
      path: String(x.path || "")
    })),
    warnings
  });
}
