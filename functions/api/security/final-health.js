import { json, requireAuth, hasRole } from "../../_lib.js";

const REQUIRED_TABLES = {
  users: [
    "id","email_norm","display_name","status",
    "password_hash","password_salt","password_iter","password_algo",
    "session_version","must_change_password",
    "mfa_enabled","mfa_type","mfa_secret","recovery_codes_json",
    "locked_until","lock_reason",
    "pw_fail_count","pw_fail_last_at",
    "created_at","updated_at"
  ],
  sessions: [
    "id","user_id","token_hash",
    "created_at","expires_at","revoked_at",
    "ip_hash","ua_hash","role_snapshot","ip_prefix_hash",
    "last_seen_at","roles_json","session_version","revoke_reason"
  ],
  roles: ["id","name","created_at"],
  user_roles: ["user_id","role_id","created_at"],
  role_menus: ["role_id","menu_id","created_at"],
  menus: ["id","code","label","path","parent_id","sort_order","icon","created_at","group_key"],
  system_settings: ["k","v","updated_at"],
  audit_logs: ["id","actor_user_id","action","meta_json","created_at","route","http_status"],
  ip_blocks: ["id","ip_hash","reason","created_at","expires_at","revoked_at","actor_user_id"],
  request_counters: ["k","count","window_start","updated_at"]
};

async function tableColumns(env, table){
  try{
    const r = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    return (r.results || []).map(x => String(x.name || ""));
  }catch{
    return [];
  }
}

async function countRows(env, table){
  try{
    const r = await env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table}`).first();
    return Number(r?.total || 0);
  }catch{
    return null;
  }
}

function diffRequired(actual, required){
  const s = new Set((actual || []).map(String));
  return (required || []).filter(x => !s.has(String(x)));
}

async function sampleSettings(env){
  const keys = [
    "global_verification_policy_v1",
    "mfa_policy_v1",
    "bootstrap_superadmin_lock_v1"
  ];

  const out = {};
  for(const k of keys){
    try{
      const row = await env.DB.prepare(`
        SELECT v
        FROM system_settings
        WHERE k = ?
        LIMIT 1
      `).bind(k).first();
      out[k] = row?.v ?? null;
    }catch{
      out[k] = null;
    }
  }
  return out;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "security_admin", "audit_admin"])){
    return json(403, "forbidden", null);
  }

  const tables = {};
  let ok = true;

  for(const [table, required] of Object.entries(REQUIRED_TABLES)){
    const cols = await tableColumns(env, table);
    const missing = diffRequired(cols, required);
    const row_count = await countRows(env, table);

    tables[table] = {
      exists: cols.length > 0,
      column_count: cols.length,
      row_count,
      missing_columns: missing,
      ok: cols.length > 0 && missing.length === 0
    };

    if(!(cols.length > 0 && missing.length === 0)){
      ok = false;
    }
  }

  const counts = {
    users: tables.users?.row_count,
    sessions: tables.sessions?.row_count,
    roles: tables.roles?.row_count,
    menus: tables.menus?.row_count,
    audit_logs: tables.audit_logs?.row_count,
    ip_blocks: tables.ip_blocks?.row_count
  };

  let bootstrap_locked = null;
  try{
    bootstrap_locked = String((await sampleSettings(env)).bootstrap_superadmin_lock_v1 || "") === "1";
  }catch{}

  const settings = await sampleSettings(env);

  const checks = {
    roles_seed_present: Number(counts.roles || 0) > 0,
    menus_seed_present: Number(counts.menus || 0) > 0,
    bootstrap_locked,
    verification_policy_present: settings.global_verification_policy_v1 != null,
    mfa_policy_present: settings.mfa_policy_v1 != null
  };

  if(!checks.roles_seed_present || !checks.menus_seed_present){
    ok = false;
  }

  return json(200, "ok", {
    health_ok: ok,
    actor: {
      id: a.user?.id || a.uid,
      email_norm: a.user?.email_norm || null,
      roles: a.roles || []
    },
    counts,
    checks,
    settings_preview: {
      global_verification_policy_v1: settings.global_verification_policy_v1 ? "present" : "missing",
      mfa_policy_v1: settings.mfa_policy_v1 ? "present" : "missing",
      bootstrap_superadmin_lock_v1: settings.bootstrap_superadmin_lock_v1
    },
    tables
  });
}
