import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function asText(v){ return String(v ?? "").trim(); }
function asInt(v){
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.trunc(n);
}
function clamp(n,a,b){ return Math.max(a, Math.min(b, n)); }

function calcProfilePct(p){
  let ok = 0, total = 5;
  if (p.gender) ok++;
  if (p.dob) ok++;
  if (p.height_cm != null && p.height_cm > 0) ok++;
  if (p.location) ok++;
  if (Array.isArray(p.categories) && p.categories.length) ok++;
  return Math.round((ok/total) * 100);
}
function calcScore(pct, categories){
  const catBonus = clamp((Array.isArray(categories) ? categories.length : 0) * 2, 0, 20);
  const proBonus = pct >= 90 ? 30 : (pct >= 75 ? 10 : 0);
  return clamp(Math.round(pct + catBonus + proBonus), 0, 200);
}

function parseCsv(text){
  // CSV simpel: header wajib. Support koma. Quote basic.
  // header minimal: email OR user_id
  const lines = String(text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length < 2) return [];
  const head = splitCsvLine(lines[0]).map(x=>x.trim());
  const out = [];
  for(let i=1;i<lines.length;i++){
    const cols = splitCsvLine(lines[i]);
    const obj = {};
    for(let j=0;j<head.length;j++){
      obj[head[j]] = cols[j] ?? "";
    }
    out.push(obj);
  }
  return out;

  function splitCsvLine(line){
    const s = String(line||"");
    const res = [];
    let cur = "", q=false;
    for(let i=0;i<s.length;i++){
      const c = s[i];
      if(c === '"' ){
        if(q && s[i+1] === '"'){ cur += '"'; i++; }
        else q = !q;
      } else if(c === "," && !q){
        res.push(cur); cur="";
      } else cur += c;
    }
    res.push(cur);
    return res;
  }
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403,"forbidden",null);

  const ct = (request.headers.get("content-type")||"").toLowerCase();
  let rows = [];

  if(ct.includes("text/csv")){
    const text = await request.text().catch(()=> "");
    rows = parseCsv(text);
  } else {
    const body = await readJson(request) || {};
    rows = Array.isArray(body.rows) ? body.rows : (Array.isArray(body) ? body : []);
  }

  if(!Array.isArray(rows) || !rows.length) return json(400,"invalid_input",{ message:"empty_rows" });

  const now = nowSec();
  let ok=0, skipped=0, failed=0;
  const errors = [];

  for(const r of rows){
    try{
      const user_id_in = asText(r.user_id);
      const email_in = asText(r.email || r.email_norm);

      let user = null;
      if(user_id_in){
        user = await env.DB.prepare("SELECT id,email_norm FROM users WHERE id=? LIMIT 1").bind(user_id_in).first();
      } else if(email_in){
        user = await env.DB.prepare("SELECT id,email_norm FROM users WHERE email_norm=? LIMIT 1").bind(email_in.toLowerCase()).first();
      }
      if(!user){ skipped++; continue; }

      // ensure user is talent
      const chk = await env.DB.prepare(`
        SELECT 1 AS ok
        FROM user_roles ur JOIN roles ro ON ro.id=ur.role_id
        WHERE ur.user_id=? AND ro.name='talent'
        LIMIT 1
      `).bind(user.id).first();
      if(!chk){ skipped++; continue; }

      const gender = asText(r.gender) || null;
      const dob = asText(r.dob) || null;
      const height_cm = asInt(r.height_cm);
      const location = asText(r.location) || null;

      let categories = r.categories;
      if(Array.isArray(categories)) {
        categories = categories.map(x=>asText(x)).filter(Boolean);
      } else {
        const s = asText(categories);
        categories = s ? s.split(",").map(x=>x.trim()).filter(Boolean) : [];
      }
      categories = categories.slice(0, 30);

      const profile_pct = calcProfilePct({ gender, dob, height_cm, location, categories });
      const score = calcScore(profile_pct, categories);

      await env.DB.prepare(`
        INSERT INTO talent_profiles
          (user_id, gender, dob, height_cm, location, categories_json, score, profile_pct, updated_at, created_at)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          gender=excluded.gender,
          dob=excluded.dob,
          height_cm=excluded.height_cm,
          location=excluded.location,
          categories_json=excluded.categories_json,
          score=excluded.score,
          profile_pct=excluded.profile_pct,
          updated_at=excluded.updated_at
      `).bind(
        user.id,
        gender,
        dob,
        (height_cm==null ? null : height_cm),
        location,
        JSON.stringify(categories),
        score,
        profile_pct,
        now,
        now
      ).run();

      // optional mark completion
      try{
        await env.DB.prepare(`UPDATE users SET profile_completed=?, updated_at=? WHERE id=?`)
          .bind(profile_pct >= 90 ? 1 : 0, now, user.id).run();
      }catch{}

      ok++;
    }catch(e){
      failed++;
      errors.push(String(e?.message||e));
      if(errors.length > 20) break;
    }
  }

  return json(200,"ok",{ ok, skipped, failed, sample_errors: errors });
}
