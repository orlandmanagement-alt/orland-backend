import { json, readJson, requireAuth, hasRole, nowSec } from "../../../_lib.js";

function safeParse(s, fallback){
  try{ return JSON.parse(s); }catch{ return fallback; }
}

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["talent"])) return json(403,"forbidden",{ message:"talent_only" });

  const body = await readJson(request) || {};
  const kind = String(body.kind||"").trim(); // headshot|side|full|additional
  const key = String(body.object_key||"").trim();

  if(!["headshot","side","full","additional"].includes(kind)){
    return json(400,"invalid_input",{ message:"kind invalid" });
  }
  if(!key.startsWith(`talent/${a.uid}/`)){
    return json(400,"invalid_input",{ message:"object_key invalid" });
  }

  const now = nowSec();

  if(kind === "additional"){
    const row = await env.DB.prepare(`SELECT additional_keys_json FROM talent_profiles WHERE user_id=? LIMIT 1`).bind(a.uid).first();
    const arr = safeParse(row?.additional_keys_json || "[]", []);
    arr.unshift(key);
    const cut = arr.slice(0, 24); // cap
    await env.DB.prepare(`
      INSERT INTO talent_profiles (user_id,additional_keys_json,updated_at,created_at)
      VALUES (?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET additional_keys_json=excluded.additional_keys_json, updated_at=excluded.updated_at
    `).bind(a.uid, JSON.stringify(cut), now, now).run();
    return json(200,"ok",{ saved:true, kind, object_key:key });
  }

  const col = kind === "headshot" ? "headshot_key" : (kind === "side" ? "side_key" : "full_key");
  await env.DB.prepare(`
    INSERT INTO talent_profiles (user_id,${col},updated_at,created_at)
    VALUES (?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET ${col}=excluded.${col}, updated_at=excluded.updated_at
  `).bind(a.uid, key, now, now).run();

  return json(200,"ok",{ saved:true, kind, object_key:key });
}
