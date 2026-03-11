import { json, readJson, nowSec } from "../../../_lib.js";
import { requireBlogspotAccess } from "./_service.js";

function s(v){ return String(v || "").trim(); }
function n(v, d = 0){
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, true);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const section = s(url.searchParams.get("section"));
  const status = s(url.searchParams.get("status"));

  let sql = `
    SELECT
      id,
      section,
      title,
      payload_json,
      sort_order,
      status,
      updated_at
    FROM blogspot_widget_home
    WHERE 1=1
  `;
  const binds = [];

  if(section){
    sql += ` AND section=?`;
    binds.push(section);
  }
  if(status){
    sql += ` AND status=?`;
    binds.push(status);
  }

  sql += ` ORDER BY sort_order ASC, updated_at DESC`;

  const r = await env.DB.prepare(sql).bind(...binds).all();

  return json(200, "ok", {
    items: (r.results || []).map(x => ({
      ...x,
      sort_order: Number(x.sort_order || 0),
      updated_at: Number(x.updated_at || 0),
      payload_json: (() => {
        try{ return JSON.parse(String(x.payload_json || "{}")); }
        catch{ return {}; }
      })()
    }))
  });
}

export async function onRequestPost({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const action = s(body.action || "create").toLowerCase();
  const now = nowSec();

  if(action === "delete"){
    const id = s(body.id);
    if(!id) return json(400, "invalid_input", { error:"id_required" });

    const ex = await env.DB.prepare(`
      SELECT id FROM blogspot_widget_home WHERE id=? LIMIT 1
    `).bind(id).first();

    if(!ex) return json(404, "not_found", { error:"widget_not_found" });

    await env.DB.prepare(`
      DELETE FROM blogspot_widget_home WHERE id=?
    `).bind(id).run();

    return json(200, "ok", { deleted:true, id });
  }

  const mode = action === "update" ? "update" : "create";
  const id = mode === "create"
    ? (s(body.id) || ("bwh_" + crypto.randomUUID()))
    : s(body.id);

  if(!id) return json(400, "invalid_input", { error:"id_required" });

  const section = s(body.section || "home");
  const title = s(body.title);
  const sort_order = n(body.sort_order, 0);
  const status = s(body.status || "active") || "active";
  const payload = body.payload_json && typeof body.payload_json === "object"
    ? body.payload_json
    : {};

  if(!title){
    return json(400, "invalid_input", { error:"title_required" });
  }

  if(mode === "update"){
    const ex = await env.DB.prepare(`
      SELECT id FROM blogspot_widget_home WHERE id=? LIMIT 1
    `).bind(id).first();

    if(!ex) return json(404, "not_found", { error:"widget_not_found" });

    await env.DB.prepare(`
      UPDATE blogspot_widget_home
      SET section=?,
          title=?,
          payload_json=?,
          sort_order=?,
          status=?,
          updated_at=?
      WHERE id=?
    `).bind(
      section,
      title,
      JSON.stringify(payload),
      sort_order,
      status,
      now,
      id
    ).run();
  }else{
    await env.DB.prepare(`
      INSERT INTO blogspot_widget_home (
        id,
        section,
        title,
        payload_json,
        sort_order,
        status,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      section,
      title,
      JSON.stringify(payload),
      sort_order,
      status,
      now
    ).run();
  }

  return json(200, "ok", {
    saved: true,
    mode,
    id
  });
}
