import {
  json,
  requireAuth
} from "../../_lib.js";

function resolveTarget(env, role){

  if(role === "dashboard"){
    return String(env.SSO_DEFAULT_REDIRECT_ADMIN || "https://dashboard.orlandmanagement.com");
  }

  if(role === "client"){
    return String(env.SSO_DEFAULT_REDIRECT_CLIENT || "https://client.orlandmanagement.com");
  }

  if(role === "talent"){
    return String(env.SSO_DEFAULT_REDIRECT_TALENT || "https://talent.orlandmanagement.com");
  }

  return String(env.SSO_DEFAULT_REDIRECT_DENIED || "https://sso.orlandmanagement.com/app/pages/sso/access-denied.html");
}

export async function onRequestGet({ request, env }){

  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const roles = (a.roles || []).map(String);

  const portalRoles = [];

  if(
    roles.includes("super_admin") ||
    roles.includes("admin") ||
    roles.includes("staff") ||
    roles.includes("security_admin") ||
    roles.includes("audit_admin") ||
    roles.includes("ops_admin") ||
    roles.includes("access_admin")
  ){
    portalRoles.push({
      role_key: "dashboard",
      label: "Admin Dashboard"
    });
  }

  if(roles.includes("client")){
    portalRoles.push({
      role_key: "client",
      label: "Client Portal"
    });
  }

  if(roles.includes("talent")){
    portalRoles.push({
      role_key: "talent",
      label: "Talent Portal"
    });
  }

  const url = new URL(request.url);
  const role = String(url.searchParams.get("role") || "").trim();

  if(role){
    const target = resolveTarget(env, role);
    return json(200, "ok", {
      mode: "redirect",
      role,
      target_url: target
    });
  }

  if(portalRoles.length === 1){
    const target = resolveTarget(env, portalRoles[0].role_key);
    return json(200, "ok", {
      mode: "redirect",
      role: portalRoles[0].role_key,
      target_url: target
    });
  }

  return json(200, "ok", {
    mode: "choose_role",
    roles: portalRoles
  });
}
