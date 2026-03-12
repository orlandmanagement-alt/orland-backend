import { requireBlogspotAccess, makeId } from "./_service.js";

export async function requireArchiveAccess(env, request){
  return await requireBlogspotAccess(env, request, true);
}

export function nowSec(){
  return Math.floor(Date.now() / 1000);
}

export function periodKeyFromRange(rangeFrom, rangeTo){
  const ts = Number(rangeTo || rangeFrom || nowSec()) * 1000;
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function archiveNo(periodKey, seq){
  return `BSA-${String(periodKey || "0000-00").replace("-", "")}-${String(seq).padStart(4, "0")}`;
}

export function sealNo(periodKey){
  return `BSS-${String(periodKey || "0000-00").replace("-", "")}`;
}

export function stableJson(v){
  return JSON.stringify(sortDeep(v));
}

function sortDeep(v){
  if(Array.isArray(v)) return v.map(sortDeep);
  if(v && typeof v === "object"){
    const out = {};
    for(const k of Object.keys(v).sort()){
      out[k] = sortDeep(v[k]);
    }
    return out;
  }
  return v;
}

export function hexFromBytes(bytes){
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr).map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(input){
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(input ?? ""))
  );
  return hexFromBytes(new Uint8Array(buf));
}

export async function hmacSha256Hex(secret, payload){
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret || "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(payload ?? ""))
  );

  return hexFromBytes(new Uint8Array(sig));
}

export async function nextArchiveSeq(env, periodKey){
  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM blogspot_archive_registry
    WHERE period_key=?
  `).bind(periodKey).first();

  return Number(row?.total || 0) + 1;
}

export async function addArchiveLog(env, row){
  try{
    await env.DB.prepare(`
      INSERT INTO blogspot_sync_logs (
        id, direction, kind, local_id, remote_id,
        action, status, message, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      makeId("bslog"),
      String(row.direction || "system"),
      String(row.kind || "system"),
      row.local_id || null,
      row.remote_id || null,
      String(row.action || "archive"),
      String(row.status || "ok"),
      String(row.message || ""),
      JSON.stringify(row.payload_json || {}),
      nowSec()
    ).run();
  }catch{}
}
