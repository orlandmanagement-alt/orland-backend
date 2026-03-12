import { json, requireAuth, hasRole } from "../../../_lib.js";

const ACTIONS = [
  "recovery_codes_generated",
  "mfa_login_recovery_verified",
  "mfa_enroll_verified",
  "mfa_disabled"
];

function safeJson(v){
  if(v == null || v === "") return {};
  try{
    const x = JSON.parse(String(v));
    return x && typeof x === "object" ? x : {};
  }catch{
    return {};
  }
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin", "audit_admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || 50)));
  const user_id = String(url.searchParams.get("user_id") || "").trim();

  let sql = `
    SELECT id, actor_user_id, action, meta_json, created_at, route, http_status
    FROM audit_logs
    WHERE action IN (${ACTIONS.map(()=>"?").join(",")})
  `;
  const bind = [...ACTIONS];

  if(user_id){
    sql += ` AND actor_user_id = ? `;
    bind.push(user_id);
  }

  sql += ` ORDER BY created_at DESC LIMIT ? `;
  bind.push(limit);

  const r = await env.DB.prepare(sql).bind(...bind).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      id: String(x.id || ""),
      actor_user_id: x.actor_user_id || null,
      action: String(x.action || ""),
      meta: safeJson(x.meta_json),
      created_at: Number(x.created_at || 0),
      route: x.route || null,
      http_status: x.http_status == null ? null : Number(x.http_status)
    })),
    actions: ACTIONS
  });
}
