import { nowSec } from "../../../_lib.js";

export function stableJsonStringify(v){
  const seen = new WeakSet();

  const normalize = (x)=>{
    if(x === null || typeof x !== "object") return x;
    if(seen.has(x)) return null;
    seen.add(x);

    if(Array.isArray(x)) return x.map(normalize);

    const out = {};
    for(const k of Object.keys(x).sort()){
      out[k] = normalize(x[k]);
    }
    return out;
  };

  return JSON.stringify(normalize(v));
}

export async function sha256Hex(input){
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(input || ""))
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getLastLedgerHash(env){
  const row = await env.DB.prepare(`
    SELECT entry_hash
    FROM blogspot_audit_ledger
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).first();

  return row ? String(row.entry_hash || "") : "";
}

export async function appendLedgerEvent(env, {
  site_id = null,
  event_type,
  item_kind = null,
  item_id = null,
  actor_user_id = null,
  payload = {}
} = {}){
  const id = crypto.randomUUID();
  const created_at = nowSec();
  const prev_hash = await getLastLedgerHash(env);

  const canonical = stableJsonStringify({
    id,
    site_id: site_id || null,
    event_type: String(event_type || ""),
    item_kind: item_kind || null,
    item_id: item_id || null,
    actor_user_id: actor_user_id || null,
    payload,
    prev_hash,
    created_at
  });

  const entry_hash = await sha256Hex(canonical);

  await env.DB.prepare(`
    INSERT INTO blogspot_audit_ledger (
      id, site_id, event_type, item_kind, item_id,
      actor_user_id, payload_json, prev_hash, entry_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    site_id || null,
    String(event_type || ""),
    item_kind || null,
    item_id || null,
    actor_user_id || null,
    stableJsonStringify(payload || {}),
    prev_hash || null,
    entry_hash,
    created_at
  ).run();

  return {
    id,
    prev_hash,
    entry_hash,
    created_at
  };
}

export async function verifyLedger(env, limit = 1000){
  const r = await env.DB.prepare(`
    SELECT
      id, site_id, event_type, item_kind, item_id,
      actor_user_id, payload_json, prev_hash, entry_hash, created_at
    FROM blogspot_audit_ledger
    ORDER BY created_at ASC, id ASC
    LIMIT ?
  `).bind(Math.max(1, Math.min(10000, Number(limit || 1000)))).all();

  const rows = r.results || [];
  let prev = "";
  const broken = [];

  for(const row of rows){
    const payload = (() => {
      try{ return JSON.parse(String(row.payload_json || "{}")); }
      catch{ return {}; }
    })();

    const canonical = stableJsonStringify({
      id: String(row.id || ""),
      site_id: row.site_id || null,
      event_type: String(row.event_type || ""),
      item_kind: row.item_kind || null,
      item_id: row.item_id || null,
      actor_user_id: row.actor_user_id || null,
      payload,
      prev_hash: prev || "",
      created_at: Number(row.created_at || 0)
    });

    const expected = await sha256Hex(canonical);
    const actualPrev = String(row.prev_hash || "");
    const actualHash = String(row.entry_hash || "");

    if(actualPrev !== (prev || "") || actualHash !== expected){
      broken.push({
        id: String(row.id || ""),
        expected_prev_hash: prev || "",
        actual_prev_hash: actualPrev,
        expected_entry_hash: expected,
        actual_entry_hash: actualHash
      });
    }

    prev = actualHash;
  }

  return {
    total: rows.length,
    ok: broken.length === 0,
    broken
  };
}
