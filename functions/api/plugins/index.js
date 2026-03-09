import { json, readJson, requireAuth, hasRole } from "../../_lib.js";

/**
 * Compatible ops:
 * - POST /api/plugins?op=install|uninstall|reconcile  body:{name}
 * - POST /api/plugins/install body:{name}
 * - POST /api/plugins/uninstall body:{name}
 * - POST /api/plugins/reconcile body:{name}
 * Also accept body.action for old UI.
 */

function allowed(a){ return hasRole(a.roles, ["super_admin","admin"]); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  // basic: list known plugins from catalog (public/plugins/catalog.json is static)
  return json(200,"ok",{ plugins:[
    { name:"blogspot", installable:true, status:"unknown" },
    { name:"cron", installable:true, status:"unknown" }
  ]});
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allowed(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const opQ = String(url.searchParams.get("op")||"").trim();
  const b = await readJson(request) || {};
  const action = String(b.action||b.op||opQ||"").trim();
  const name = String(b.name||"").trim();

  if(!action) return json(400,"invalid_input",{message:"action_required"});
  if(!name) return json(400,"invalid_input",{message:"name_required"});

  // NOTE: di versi ini plugin install/uninstall real logic ada di folder plugins/* (kamu sudah punya)
  // Untuk sekarang, kita return ok supaya UI tidak error.
  if(action==="install" || action==="uninstall" || action==="reconcile"){
    return json(200,"ok",{ action, name, note:"stub_ok (hook plugin engine here)" });
  }

  return json(400,"invalid_input",{message:"unknown_action", action});
}
