import { json, requireAuth, hasRole } from "../../_lib.js";

const LOGIN_TIMELINE_ACTIONS = [
  "login_success",
  "password_fail",
  "logout",
  "lockout",
  "blocked_ip",
  "session_revoke_self",
  "session_revoke_all_self",
  "session_revoke_others_self",
  "admin_revoke_session",
  "admin_revoke_all_sessions",
  "admin_rotate_session_version"
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

function toInt(v, d){
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin", "audit_admin"])){
    return json(403, "forbidden", null);
  }

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(200, toInt(url.searchParams.get("limit"), 50)));

  const rows = await env.DB.prepare(`
    SELECT
      id,
      actor_user_id,
      actor_identifier_hash,
      action,
      target_type,
      target_id,
      ip_hash,
      ua_hash,
      meta_json,
      created_at,
      route,
      http_status,
      duration_ms
    FROM audit_logs
    WHERE action IN (${LOGIN_TIMELINE_ACTIONS.map(()=>"?").join(",")})
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(...LOGIN_TIMELINE_ACTIONS, limit).all();

  let items = (rows.results || []).map(x => {
    const meta = safeJson(x.meta_json);
    return {
      id: String(x.id || ""),
      actor_user_id: x.actor_user_id || null,
      actor_identifier_hash: x.actor_identifier_hash || null,
      action: String(x.action || ""),
      target_type: x.target_type || null,
      target_id: x.target_id || null,
      ip_hash: x.ip_hash || null,
      ua_hash: x.ua_hash || null,
      meta,
      created_at: Number(x.created_at || 0),
      route: x.route || null,
      http_status: x.http_status == null ? null : Number(x.http_status),
      duration_ms: x.duration_ms == null ? null : Number(x.duration_ms)
    };
  });

  if(q){
    items = items.filter(x => {
      const hay = [
        x.id,
        x.actor_user_id,
        x.actor_identifier_hash,
        x.action,
        x.target_type,
        x.target_id,
        x.ip_hash,
        x.ua_hash,
        x.route,
        JSON.stringify(x.meta || {})
      ].join(" ").toLowerCase();

      return hay.includes(q);
    });
  }

  return json(200, "ok", {
    items,
    actions: LOGIN_TIMELINE_ACTIONS
  });
}
