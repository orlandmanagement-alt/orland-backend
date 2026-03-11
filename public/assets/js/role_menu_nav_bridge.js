export function navSetRoleMenuContext(ctx = {}){
  try{
    sessionStorage.setItem("orland_nav_ctx_v1", JSON.stringify({
      role_id: String(ctx.role_id || ""),
      role_name: String(ctx.role_name || ""),
      menu_id: String(ctx.menu_id || ""),
      menu_label: String(ctx.menu_label || ""),
      open_usage: !!ctx.open_usage,
      ts: Date.now()
    }));
  }catch{}
}

export function navGetRoleMenuContext(){
  try{
    const raw = sessionStorage.getItem("orland_nav_ctx_v1");
    if(!raw) return null;
    const x = JSON.parse(raw);
    return {
      role_id: String(x?.role_id || ""),
      role_name: String(x?.role_name || ""),
      menu_id: String(x?.menu_id || ""),
      menu_label: String(x?.menu_label || ""),
      open_usage: !!x?.open_usage,
      ts: Number(x?.ts || 0)
    };
  }catch{
    return null;
  }
}

export function navClearRoleMenuContext(){
  try{
    sessionStorage.removeItem("orland_nav_ctx_v1");
  }catch{}
}

export function navSetReturnToRoleUsage(roleId, roleName){
  try{
    sessionStorage.setItem("orland_return_role_id", String(roleId || ""));
    sessionStorage.setItem("orland_return_role_name", String(roleName || ""));
    sessionStorage.setItem("orland_return_open_usage", "1");
  }catch{}
}

export function navConsumeReturnToRoleUsage(){
  try{
    const roleId = String(sessionStorage.getItem("orland_return_role_id") || "").trim();
    const roleName = String(sessionStorage.getItem("orland_return_role_name") || "").trim();
    const openUsage = String(sessionStorage.getItem("orland_return_open_usage") || "") === "1";
    if(!roleId || !openUsage) return null;

    sessionStorage.removeItem("orland_return_role_id");
    sessionStorage.removeItem("orland_return_role_name");
    sessionStorage.removeItem("orland_return_open_usage");

    return { roleId, roleName };
  }catch{
    return null;
  }
}

export function navSetMenuJumpTarget(roleId, roleName, menuId, menuLabel){
  try{
    sessionStorage.setItem("orland_jump_menu_id", String(menuId || ""));
    sessionStorage.setItem("orland_return_role_id", String(roleId || ""));
    sessionStorage.setItem("orland_return_role_name", String(roleName || ""));
    sessionStorage.setItem("orland_return_menu_label", String(menuLabel || ""));
    sessionStorage.setItem("orland_return_open_usage", "1");
    navSetRoleMenuContext({
      role_id: roleId,
      role_name: roleName,
      menu_id: menuId,
      menu_label: menuLabel,
      open_usage: true
    });
  }catch{}
}

export function navConsumeMenuJumpTarget(){
  try{
    const menuId = String(sessionStorage.getItem("orland_jump_menu_id") || "").trim();
    const roleId = String(sessionStorage.getItem("orland_return_role_id") || "").trim();
    const roleName = String(sessionStorage.getItem("orland_return_role_name") || "").trim();
    const menuLabel = String(sessionStorage.getItem("orland_return_menu_label") || "").trim();

    if(!menuId) return null;

    sessionStorage.removeItem("orland_jump_menu_id");

    return {
      menuId,
      roleId,
      roleName,
      menuLabel
    };
  }catch{
    return null;
  }
}

export function navGoModule(Orland, name){
  try{
    if(typeof Orland?.openModule === "function"){
      Orland.openModule(name);
      return true;
    }
  }catch{}

  try{
    if(typeof Orland?.navigate === "function"){
      Orland.navigate(name);
      return true;
    }
  }catch{}

  try{
    if(typeof Orland?.go === "function"){
      Orland.go(name);
      return true;
    }
  }catch{}

  try{
    location.hash = "#/" + String(name || "");
    return true;
  }catch{}

  return false;
}
