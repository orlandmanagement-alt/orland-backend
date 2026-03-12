import { json, requireAuth, hasRole } from "../../_lib.js";

const TEMPLATES = [
  {
    id: "tpl_access_admin",
    name: "Access Admin Template",
    role_name: "access_admin",
    description: "Kelola roles, menu builder, registry, dan simulasi akses.",
    suggested_menu_codes: [
      "roles",
      "menus",
      "rbac",
      "registry_audit",
      "dashboard"
    ]
  },
  {
    id: "tpl_security_admin",
    name: "Security Admin Template",
    role_name: "security_admin",
    description: "Kelola security center, session control, MFA, policy, compliance.",
    suggested_menu_codes: [
      "security_center",
      "security_sessions_admin",
      "security_login_timeline",
      "security_force_password",
      "security_mfa_policy",
      "security_mfa_enrollment",
      "security_mfa_challenge",
      "security_mfa_recovery",
      "security_mfa_recovery_audit",
      "security_mfa_compliance",
      "security_mfa_user_inspector",
      "security_final_health",
      "dashboard"
    ]
  },
  {
    id: "tpl_audit_admin",
    name: "Audit Admin Template",
    role_name: "audit_admin",
    description: "Akses baca audit, timeline, compliance, dan health.",
    suggested_menu_codes: [
      "audit",
      "verification_dashboard",
      "security_login_timeline",
      "security_mfa_recovery_audit",
      "security_mfa_compliance",
      "security_final_health",
      "registry_audit",
      "dashboard"
    ]
  },
  {
    id: "tpl_ops_admin",
    name: "Ops Admin Template",
    role_name: "ops_admin",
    description: "Kelola operational module, incident, on-call, dan dashboard.",
    suggested_menu_codes: [
      "dashboard",
      "ops",
      "ops_incidents",
      "ops_oncall"
    ]
  },
  {
    id: "tpl_content_admin",
    name: "Content Admin Template",
    role_name: "content_admin",
    description: "Kelola Blogspot dan modul content.",
    suggested_menu_codes: [
      "dashboard",
      "blogspot",
      "cfg_blogspot",
      "blogspot_posts",
      "blogspot_pages",
      "blogspot_widgets",
      "blogspot_sync"
    ]
  }
];

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  if(!hasRole(a.roles, ["super_admin", "admin", "access_admin"])){
    return json(403, "forbidden", null);
  }

  return json(200, "ok", {
    items: TEMPLATES
  });
}
