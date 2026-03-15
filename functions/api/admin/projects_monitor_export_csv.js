import { requireAuth } from "../../_lib.js";

function canAccessAdmin(roles){
  const set = new Set((roles || []).map(String));
  return (
    set.has("super_admin") ||
    set.has("admin") ||
    set.has("staff") ||
    set.has("ops_admin") ||
    set.has("audit_admin")
  );
}

function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n]/.test(s)){
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows){
  const headers = [
    "id",
    "title",
    "status",
    "project_type",
    "location_text",
    "organization_name",
    "owner_name",
    "created_at",
    "updated_at"
  ];

  const lines = [headers.join(",")];
  for(const row of rows){
    lines.push([
      row.id,
      row.title,
      row.status,
      row.project_type,
      row.location_text,
      row.organization_name,
      row.owner_name,
      row.created_at,
      row.updated_at
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessAdmin(auth.roles || [])){
    return new Response("forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();

  let sql = `
    SELECT
      p.id,
      p.title,
      p.status,
      p.project_type,
      p.location_text,
      o.name AS organization_name,
      u.display_name AS owner_name,
      p.created_at,
      p.updated_at
    FROM projects p
    LEFT JOIN organizations o ON o.id = p.organization_id
    LEFT JOIN users u ON u.id = p.owner_user_id
  `;
  const binds = [];

  if(q){
    sql += ` WHERE p.title LIKE ? OR p.id LIKE ? `;
    binds.push(`%${q}%`, `%${q}%`);
  }

  sql += ` ORDER BY p.created_at DESC LIMIT 1000 `;

  const r = await env.DB.prepare(sql).bind(...binds).all();
  const csv = toCsv(r.results || []);

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="projects-monitor.csv"`,
      "cache-control": "no-store"
    }
  });
}
