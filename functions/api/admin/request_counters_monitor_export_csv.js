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
      k,
      count,
      window_start,
      updated_at
    FROM request_counters
  `;
  const binds = [];

  if(q){
    sql += ` WHERE k LIKE ? `;
    binds.push(`%${q}%`);
  }

  sql += ` ORDER BY updated_at DESC LIMIT 1000 `;

  const r = await env.DB.prepare(sql).bind(...binds).all();
  const rows = r.results || [];

  const head = ["k","count","window_start","updated_at"].join(",");
  const body = rows.map(row => [
    row.k,
    row.count,
    row.window_start,
    row.updated_at
  ].map(csvEscape).join(","));

  return new Response([head, ...body].join("\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="request-counters-monitor.csv"`,
      "cache-control": "no-store"
    }
  });
}
