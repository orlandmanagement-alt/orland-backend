import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function canRead(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }
function canWrite(a){ return hasRole(a.roles, ["super_admin","admin"]); }

const TABLE = "oncall_groups";
const PK = "id";
const COLS = ["name","rotation","timezone","week_start"];

function pickBody(body){
  const out = {};
  for(const k of COLS){
    if(body && Object.prototype.hasOwnProperty.call(body,k)){
      out[k] = body[k];
    }
  }
  return out;
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canRead(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q")||"").trim().toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")||"50")));

  // simple search on first column
  const firstCol = COLS[0];
  const like = q ? `%${q}%` : null;

  const sql = like
    ? `SELECT * FROM ${TABLE} WHERE ${firstCol} LIKE ? ORDER BY created_at DESC LIMIT ?`
    : `SELECT * FROM ${TABLE} ORDER BY created_at DESC LIMIT ?`;

  const r = like
    ? await env.DB.prepare(sql).bind(like, limit).all()
    : await env.DB.prepare(sql).bind(limit).all();

  return json(200,"ok",{ rows: r.results || [] });
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const now = nowSec();

  const id = body[PK] ? String(body[PK]) : crypto.randomUUID();
  const payload = pickBody(body);

  // ensure required fields not empty (basic)
  // (you can harden per module)
  const keys = Object.keys(payload);
  if(!keys.length) return json(400,"invalid_input",{ message:"no_fields" });

  // upsert: try update first, else insert
  const setParts = keys.map(k=>`${k}=?`).join(",");
  const setVals = keys.map(k=>payload[k]);

  // if exists
  const ex = await env.DB.prepare(`SELECT 1 AS ok FROM ${TABLE} WHERE ${PK}=? LIMIT 1`).bind(id).first();

  if(ex){
    await env.DB.prepare(`UPDATE ${TABLE} SET ${setParts}, updated_at=? WHERE ${PK}=?`)
      .bind(...setVals, now, id).run();
    return json(200,"ok",{ updated:true, id });
  }

  // insert
  const insCols = [PK, ...keys, "created_at", "updated_at"];
  const ph = insCols.map(()=>"?").join(",");
  const vals = [id, ...setVals, now, now];

  await env.DB.prepare(`INSERT INTO ${TABLE} (${insCols.join(",")}) VALUES (${ph})`).bind(...vals).run();
  return json(200,"ok",{ created:true, id });
}

export async function onRequestPut({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!canWrite(a)) return json(403,"forbidden",null);

  const body = await readJson(request) || {};
  const id = String(body[PK]||"");
  if(!id) return json(400,"invalid_input",{ message:"missing_pk" });

  const payload = pickBody(body);
  const keys = Object.keys(payload);
  if(!keys.length) return json(400,"invalid_input",{ message:"no_fields" });

  const now = nowSec();
  const setParts = keys.map(k=>`${k}=?`).join(",");
  const setVals = keys.map(k=>payload[k]);

  await env.DB.prepare(`UPDATE ${TABLE} SET ${setParts}, updated_at=? WHERE ${PK}=?`)
    .bind(...setVals, now, id).run();

  return json(200,"ok",{ updated:true, id });
}

export async function onRequestDelete({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin"])) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const id = String(url.searchParams.get(PK) || "");
  if(!id) return json(400,"invalid_input",{ message:"missing_pk" });

  await env.DB.prepare(`DELETE FROM ${TABLE} WHERE ${PK}=?`).bind(id).run();
  return json(200,"ok",{ deleted:true, id });
}
