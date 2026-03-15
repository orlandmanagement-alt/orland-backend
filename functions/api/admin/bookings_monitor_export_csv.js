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
    "project_id",
    "project_title",
    "project_role_id",
    "role_name",
    "talent_user_id",
    "talent_name",
    "status",
    "notes",
    "created_at",
    "updated_at"
  ];

  const lines = [headers.join(",")];
  for(const row of rows){
    lines.push([
      row.id,
      row.project_id,
      row.project_title,
      row.project_role_id,
      row.role_name,
      row.talent_user_id,
      row.talent_name,
      row.status,
      row.notes,
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
      b.id,
      b.project_role_id,
      b.talent_user_id,
      b.status,
      b.notes,
      b.created_at,
      b.updated_at,
      pr.role_name,
      p.id AS project_id,
      p.title AS project_title,
      u.display_name AS talent_name
    FROM project_bookings b
    LEFT JOIN project_roles pr ON pr.id = b.project_role_id
    LEFT JOIN projects p ON p.id = pr.project_id
    LEFT JOIN users u ON u.id = b.talent_user_id
  `;
  const binds = [];

  if(q){
    sql += ` WHERE p.title LIKE ? OR u.display_name LIKE ? OR b.id LIKE ? `;
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ` ORDER BY b.created_at DESC LIMIT 1000 `;

  const r = await env.DB.prepare(sql).bind(...binds).all();
  const csv = toCsv(r.results || []);

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="bookings-monitor.csv"`,
      "cache-control": "no-store"
    }
  });
}
