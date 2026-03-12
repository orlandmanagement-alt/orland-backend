import { json, readJson, requireAuth, hasRole, nowSec } from "../_lib.js";

const POLICY_KEY = "protected_menu_policy_v1";

function defaultPolicy(){
  return {
    enabled: 1,
    protected_menu_ids: [
      "m_core_dashboard",
      "m_core_access",
      "m_core_roles",
      "m_core_menus",
      "m_sys_security",
      "m_sec_center",
      "m_sec_sessions_admin",
      "m_sec_login_timeline",
      "m_sec_force_password",
      "m_sec_bootstrap_admin",
      "m_sec_mfa_policy",
      "m_sec_mfa_compliance",
      "m_sec_mfa_user_inspector",
      "m_sec_final_health"
    ],
    protected_paths: [
      "/dashboard",
      "/access-control",
      "/roles",
      "/menus",
      "/security",
      "/security/center",
      "/security/sessions",
      "/security/login-timeline",
      "/security/force-password-reset",
      "/security/bootstrap-admin",
      "/security/mfa-policy",
      "/security/mfa-compliance",
      "/security/mfa-user-inspector",
      "/security/final-health"
    ],
    deny_delete: 1,
    deny_path_change: 1,
    deny_parent_change: 1,
    deny_group_change: 1
  };
}

function uniqStrings(arr){
  return Array.from(new Set((Array.isArray(arr) ? arr : []).map(x => String(x || "").trim()).filter(Boolean)));
}

function normalizePolicy(v){
  const src = v && typeof v === "object" ? v : {};
  const d = defaultPolicy();
  return {
    enabled: src.enabled ? 1 : 0,
    protected_menu_ids: uniqStrings(src.protected_menu_ids ?? d.protected_menu_ids),
    protected_paths: uniqStrings(src.protected_paths ?? d.protected_paths),
    deny_delete: src.deny_delete ? 1 : 0,
    deny_path_change: src.deny_path_change ? 1 : 0,
    deny_parent_change: src.deny_parent_change ? 1 : 0,
    deny_group_change: src.deny_group_change ? 1 : 0
  };
}

async function readPolicy(env){
  const row = await env.DB.prepare(`
    SELECT v
    FROM system_settings
    WHERE k = ?
    LIMIT 1
  `).bind(POLICY_KEY).first();

  if(!row?.v) return defaultPolicy();

  try{
    return normalizePolicy(JSON.parse(row.v));
  }catch{
    return defaultPolicy();
  }
}

async function writePolicy(env, value){
  const policy = normalizePolicy(value);
  const now = nowSec();
  await env.DB.prepare(`
    INSERT INTO system_settings (k, v, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      updated_at = excluded.updated_at
  `).bind(POLICY_KEY, JSON.stringify(policy), now).run();

  return policy;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin", "security_admin"])){
    return json(403, "forbidden", null);
  }

  const value = await readPolicy(env);
  return json(200, "ok", { key: POLICY_KEY, value });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  const body = await readJson(request) || {};
  const saved = await writePolicy(env, body);
  return json(200, "ok", { saved: true, key: POLICY_KEY, value: saved });
}
