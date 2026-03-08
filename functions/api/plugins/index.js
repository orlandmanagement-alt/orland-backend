import { json, requireAuth, hasRole, readJson, nowSec } from "../../_lib.js";
import { CATALOG } from "./_catalog.js";

async function isInstalled(env, name){
  const k = `plugin:${name}:installed`;
  const r = await env.DB.prepare("SELECT v FROM system_settings WHERE k=? LIMIT 1").bind(k).first();
  return r ? String(r.v) === "1" : false;
}
async function setInstalled(env, name, on){
  const k = `plugin:${name}:installed`;
  const v = on ? "1" : "0";
  const now = nowSec();
  await env.DB.prepare(
    "INSERT INTO system_settings (k,v,is_secret,updated_at) VALUES (?,?,0,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, updated_at=excluded.updated_at"
  ).bind(k, v, now).run();
}
async function callPlugin(env, name, fn){
  const p = CATALOG.find(x=>x.name===name);
  if(!p) return { ok:false, err: json(404,"not_found",{message:"plugin_not_found"}) };
  try{
    const mod = await import(`./${name}/${fn}.js`);
    if(!mod || typeof mod.run !== "function") return { ok:false, err: json(500,"server_error",{message:"invalid_plugin_handler"}) };
    return { ok:true, mod };
  }catch(e){
    return { ok:false, err: json(500,"server_error",{message:"load_plugin_failed", detail:String(e?.message||e)}) };
  }
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const list = [];
  for(const p of CATALOG){
    const installed = await isInstalled(env, p.name);
    list.push({ ...p, installed });
  }
  return json(200,"ok",{ plugins:list });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const action = String(body.action||"").trim();
  const name = String(body.name||"").trim();

  if(!name) return json(400,"invalid_input",{message:"missing_name"});

  if(action === "install"){
    const loader = await callPlugin(env, name, "install");
    if(!loader.ok) return loader.err;

    const out = await loader.mod.run({ env, actor: { uid:a.uid, roles:a.roles } });
    await setInstalled(env, name, true);
    return json(200,"ok",{ installed:true, name, out });
  }

  if(action === "uninstall"){
    const loader = await callPlugin(env, name, "uninstall");
    if(!loader.ok) return loader.err;

    const out = await loader.mod.run({ env, actor: { uid:a.uid, roles:a.roles } });
    await setInstalled(env, name, false);
    return json(200,"ok",{ uninstalled:true, name, out });
  }

  if(action === "reconcile"){
    const loader = await callPlugin(env, name, "reconcile");
    if(!loader.ok) return loader.err;

    const out = await loader.mod.run({ env, actor: { uid:a.uid, roles:a.roles } });
    return json(200,"ok",{ reconciled:true, name, out });
  }

  return json(400,"invalid_input",{message:"unknown_action"});
}
