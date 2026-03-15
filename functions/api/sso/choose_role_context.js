import {
  json,
  requireAuth
} from "../../_lib.js";

function buildPortalRoles(roles){
  const set = new Set((roles || []).map(String));
  const items = [];

  if(
    set.has("super_admin") ||
    set.has("admin") ||
    set.has("staff") ||
    set.has("security_admin") ||
    set.has("audit_admin") ||
    set.has("ops_admin") ||
    set.has("access_admin")
  ){
    items.push({
      role_key: "dashboard",
      label: "Admin Dashboard",
      source_roles: Array.from(set).filter(x =>
        ["super_admin","admin","staff","security_admin","audit_admin","ops_admin","access_admin"].includes(x)
      )
    });
  }

  if(set.has("client")){
    items.push({
      role_key: "client",
      label: "Client Portal",
      source_roles: ["client"]
    });
  }

  if(set.has("talent")){
    items.push({
      role_key: "talent",
      label: "Talent Portal",
      source_roles: ["talent"]
    });
  }

  return items;
}

export async function onRequestGet({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  const items = buildPortalRoles(auth.roles || []);

  return json(200, "ok", {
    user: {
      id: auth.user?.id || auth.uid,
      email_norm: auth.user?.email_norm || "",
      display_name: auth.user?.display_name || ""
    },
    roles: auth.roles || [],
    portal_roles: items,
    multi_role: items.length > 1
  });
}
