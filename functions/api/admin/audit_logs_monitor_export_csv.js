import { requireAuth } from "../../_lib.js";

function canAccessAdmin(roles){
  const s = new Set((roles || []).map(String));
  return s.has("super_admin") || s.has("admin") || s.has("audit_admin") || s.has("security_admin") || s.has("staff");
}

function csvEscape(v){
  const s = String(v ?? "");
  if(/[",\n]/.test(s)){
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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
      id,
      actor_user_id,
      action,
      target_type,
      target_id,
      route,
      http_status,
      duration_ms,
      created_at
    FROM audit_logs
  `;
  const binds = [];

  if(q){
    sql += ` WHERE action LIKE ? OR route LIKE ? OR target_id LIKE ? `;
    binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  sql += ` ORDER BY created_at DESC LIMIT 1000 `;

  const r = await env.DB.prepare(sql).bind(...binds).all();
  const rows = r.results || [];

  const head = ["id","actor_user_id","action","target_type","target_id","route","http_status","duration_ms","created_at"].join(",");
  const body = rows.map(row => [
    row.id,
    row.actor_user_id,
    row.action,
    row.target_type,
    row.target_id,
    row.route,
    row.http_status,
    row.duration_ms,
    row.created_at
  ].map(csvEscape).join(","));

  return new Response([head, ...body].join("\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-logs-monitor.csv"`,
      "cache-control": "no-store"
    }
  });
}
