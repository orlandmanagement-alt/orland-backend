import { nowSec, sha256Base64 } from "../../_lib.js";

const POLICY_KEY = "mfa_policy_v1";

export function defaultPolicy(){
  return {
    enabled: 0,
    allow_user_opt_in: 0,
    require_for_super_admin: 0,
    require_for_security_admin: 0,
    require_for_admin: 0,
    allowed_types: ["app"],
    recovery_codes_enabled: 0
  };
}

export async function readMfaPolicy(env){
  try{
    const row = await env.DB.prepare(`
      SELECT v
      FROM system_settings
      WHERE k = ?
      LIMIT 1
    `).bind(POLICY_KEY).first();

    if(!row?.v) return defaultPolicy();
    const v = JSON.parse(row.v);
    return v && typeof v === "object" ? v : defaultPolicy();
  }catch{
    return defaultPolicy();
  }
}

export function mfaRequiredByRoles(roles, policy){
  const s = new Set((roles || []).map(String));
  if(s.has("super_admin") && Number(policy.require_for_super_admin || 0) === 1) return true;
  if(s.has("security_admin") && Number(policy.require_for_security_admin || 0) === 1) return true;
  if(s.has("admin") && Number(policy.require_for_admin || 0) === 1) return true;
  return false;
}

export function normalizeBase32(input){
  return String(input || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
}

export function base32ToBytes(input){
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = normalizeBase32(input);
  let bits = 0;
  let value = 0;
  const out = [];

  for(const ch of clean){
    const idx = alphabet.indexOf(ch);
    if(idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if(bits >= 8){
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(out);
}

export async function hmacSha1(keyBytes, msgBytes){
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return new Uint8Array(sig);
}

export function hotpCounterBytes(counter){
  const buf = new Uint8Array(8);
  let c = Number(counter);
  for(let i = 7; i >= 0; i--){
    buf[i] = c & 0xff;
    c = Math.floor(c / 256);
  }
  return buf;
}

export async function totpCode(secretBase32, ts = nowSec(), step = 30, digits = 6){
  const secret = base32ToBytes(secretBase32);
  const counter = Math.floor(Number(ts || 0) / step);
  const hmac = await hmacSha1(secret, hotpCounterBytes(counter));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return String(bin % mod).padStart(digits, "0");
}

export async function verifyTotp(secretBase32, code, opt = {}){
  const digits = Number(opt.digits || 6);
  const step = Number(opt.step || 30);
  const window = Number(opt.window || 1);
  const now = Number(opt.now || nowSec());
  const want = String(code || "").trim();

  if(!/^\d{6,8}$/.test(want)) return false;

  for(let w = -window; w <= window; w++){
    const ts = now + (w * step);
    const gen = await totpCode(secretBase32, ts, step, digits);
    if(gen === want) return true;
  }
  return false;
}

export function generateBase32Secret(bytes = 20){
  const u8 = crypto.getRandomValues(new Uint8Array(bytes));
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let out = "";

  for(const b of u8){
    value = (value << 8) | b;
    bits += 8;
    while(bits >= 5){
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if(bits > 0){
    out += alphabet[(value << (5 - bits)) & 31];
  }
  return out;
}

export function generateRecoveryCodes(){
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const out = [];
  for(let i = 0; i < 8; i++){
    let s = "";
    for(let j = 0; j < 10; j++){
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    out.push(s);
  }
  return out;
}

export async function hashRecoveryCodes(codes){
  const out = [];
  for(const code of (codes || [])){
    out.push(await sha256Base64(String(code)));
  }
  return out;
}

export function safeJsonArray(v){
  if(Array.isArray(v)) return v;
  if(v == null || v === "") return [];
  try{
    const x = JSON.parse(String(v));
    return Array.isArray(x) ? x : [];
  }catch{
    return [];
  }
}

export function otpauthUrl({ issuer, account, secret }){
  const label = encodeURIComponent(`${issuer}:${account}`);
  const iss = encodeURIComponent(issuer);
  const sec = encodeURIComponent(secret);
  return `otpauth://totp/${label}?secret=${sec}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`;
}

export async function signPendingLoginToken(env, payload){
  const body = JSON.stringify(payload || {});
  const sig = await sha256Base64(body + "|" + String(env.HASH_PEPPER || ""));
  return btoa(body) + "." + sig;
}

export async function verifyPendingLoginToken(env, token){
  try{
    const s = String(token || "");
    const i = s.lastIndexOf(".");
    if(i <= 0) return null;
    const bodyB64 = s.slice(0, i);
    const sig = s.slice(i + 1);
    const body = atob(bodyB64);
    const expect = await sha256Base64(body + "|" + String(env.HASH_PEPPER || ""));
    if(sig !== expect) return null;
    const payload = JSON.parse(body);
    if(!payload || typeof payload !== "object") return null;
    if(Number(payload.exp || 0) < nowSec()) return null;
    return payload;
  }catch{
    return null;
  }
}
