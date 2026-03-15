import { requireAuth, nowSec } from "../../_lib.js";

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
  const activeOnly = String(url.searchParams.get("active_only") || "1") === "1";

  let sql = `
    SELECT
      id,
      ip_hash,
      reason,
      expires_at,
      revoked_at,
      created_at,
      created_by_user_id
    FROM ip_blocks
  `;
  const binds = [];

  if(activeOnly){
    sql += ` WHERE revoked_at IS NULL AND expires_at > ? `;
    binds.push(nowSec());
  }

  sql += ` ORDER BY created_at DESC LIMIT 1000 `;

  const r = await env.DB.prepare(sql).bind(...binds).all();
  const rows = r.results || [];

  const head = ["id","ip_hash","reason","expires_at","revoked_at","created_at","created_by_user_id"].join(",");
  const body = rows.map(row => [
    row.id,
    row.ip_hash,
    row.reason,
    row.expires_at,
    row.revoked_at,
    row.created_at,
    row.created_by_user_id
  ].map(csvEscape).join(","));

  return new Response([head, ...body].join("\n"), {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="ip-blocks-monitor.csv"`,
      "cache-control": "no-store"
    }
  });
}
