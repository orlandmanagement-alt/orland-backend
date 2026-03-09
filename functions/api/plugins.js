import { json, readJson, requireAuth, hasRole } from "../_lib.js";

function allowed(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  // minimal static list (catalog.json exists in public/plugins/)
  return json(200,"ok",{ plugins:[
    { name:"blogspot", installable:true, status:"not_installed" },
    { name:"cron", installable:true, status:"not_installed" }
  ]});
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const op = String(url.searchParams.get("op")||"").trim();
  const b = await readJson(request) || {};
  const action = String(b.action||b.op||op||"").trim();
  const name = String(b.name||"").trim();

  // accept legacy endpoints too
  if(!action) return json(400,"invalid_input",{message:"unknown_action"});
  if(!name) return json(400,"invalid_input",{message:"name_required"});

  if(action==="install" || action==="uninstall" || action==="reconcile"){
    // stub ok: nanti kita sambungkan ke plugin engine
    return json(200,"ok",{ name, action, note:"stub_ok" });
  }
  return json(400,"invalid_input",{message:"unknown_action"});
}
