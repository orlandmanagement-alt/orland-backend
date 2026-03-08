import { requireAuth, hasRole } from "../../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function esc(v){
  const s = String(v ?? "");
  if(/[,"\n]/.test(s)) return `"${s.replaceAll('"','""')}"`;
  return s;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return new Response("forbidden",{status:403});

  const url = new URL(request.url);
  const q = (url.searchParams.get("q")||"").trim();
  const action = (url.searchParams.get("action")||"").trim();
  const actor = (url.searchParams.get("actor")||"").trim();
  const status = (url.searchParams.get("status")||"").trim();
  const from = Number(url.searchParams.get("from")||"0");
  const to = Number(url.searchParams.get("to")||"0");
  const limit = Math.min(5000, Math.max(100, Number(url.searchParams.get("limit")||"1000")));

  const where = [];
  const bind = [];

  if(q){
    where.push("(COALESCE(action,'') LIKE ? OR COALESCE(route,'') LIKE ? OR COALESCE(target_id,'') LIKE ? OR COALESCE(meta_json,'') LIKE ?)");
    bind.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`);
  }
  if(action){ where.push("COALESCE(action,'') LIKE ?"); bind.push(`%${action}%`); }
  if(actor){ where.push("COALESCE(actor_user_id,'') LIKE ?"); bind.push(`%${actor}%`); }
  if(status){ where.push("CAST(COALESCE(http_status,0) AS TEXT) LIKE ?"); bind.push(`%${status}%`); }
  if(from>0){ where.push("created_at >= ?"); bind.push(from); }
  if(to>0){ where.push("created_at <= ?"); bind.push(to); }

  const sql = `
    SELECT
      COALESCE(actor_user_id,'') AS actor_user_id,
      COALESCE(action,'') AS action,
      COALESCE(route, COALESCE(target_id,'')) AS route,
      COALESCE(http_status, 0) AS http_status,
      COALESCE(duration_ms, 0) AS duration_ms,
      COALESCE(ip_hash,'') AS ip_hash,
      COALESCE(ua_hash,'') AS ua_hash,
      COALESCE(meta_json,'{}') AS meta_json,
      created_at
    FROM audit_logs
    ${where.length ? "WHERE "+where.join(" AND ") : ""}
    ORDER BY created_at DESC
    LIMIT ?
  `;
  bind.push(limit);

  const r = await env.DB.prepare(sql).bind(...bind).all();
  const rows = r.results || [];

  let csv = "created_at,actor_user_id,action,route,http_status,duration_ms,ip_hash,ua_hash,meta_json\n";
  for(const x of rows){
    csv += [
      esc(x.created_at),
      esc(x.actor_user_id),
      esc(x.action),
      esc(x.route),
      esc(x.http_status),
      esc(x.duration_ms),
      esc(x.ip_hash),
      esc(x.ua_hash),
      esc(x.meta_json)
    ].join(",") + "\n";
  }

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "cache-control": "no-store",
      "content-disposition": "attachment; filename=audit_export.csv"
    }
  });
}
