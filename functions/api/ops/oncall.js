import { json, requireAuth, hasRole, nowSec } from "../../_lib.js";

function allow(a){ return hasRole(a.roles, ["super_admin","admin","staff"]); }

function startOfWeekUTC(tsSec, week_start){
  const d = new Date(tsSec*1000);
  const day = d.getUTCDay(); // 0 sunday ... 6 saturday
  const startDay = (week_start === "sunday") ? 0 : 1; // monday default
  const diff = (day - startDay + 7) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0,0,0,0);
  return Math.floor(d.getTime()/1000);
}

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!allow(a)) return json(403,"forbidden",null);

  const url = new URL(request.url);
  const group_id = String(url.searchParams.get("group_id")||"").trim();
  if(!group_id) return json(400,"invalid_input",{message:"group_id"});

  const g = await env.DB.prepare(`
    SELECT id,name,rotation,timezone,week_start
    FROM oncall_groups WHERE id=? LIMIT 1
  `).bind(group_id).first();
  if(!g) return json(404,"not_found",null);

  const m = await env.DB.prepare(`
    SELECT m.user_id,m.sort_order,m.active,u.email_norm,u.display_name
    FROM oncall_members m
    LEFT JOIN users u ON u.id=m.user_id
    WHERE m.group_id=? AND m.active=1
    ORDER BY m.sort_order ASC, m.created_at ASC
    LIMIT 500
  `).bind(group_id).all();

  const members = (m.results||[]).filter(x=>x.user_id);
  if(!members.length){
    return json(200,"ok",{ group:g, members:[], current:null, window:{ from:null, to:null } });
  }

  const now = nowSec();

  if(String(g.rotation) === "daily"){
    // daily rotation: index by day number (UTC)
    const dayKey = Math.floor(now / 86400);
    const idx = dayKey % members.length;
    const from = dayKey*86400;
    const to = from + 86400;
    return json(200,"ok",{ group:g, members, current: members[idx], window:{ from, to } });
  }

  // weekly rotation default
  const weekStart = startOfWeekUTC(now, String(g.week_start||"monday"));
  const weekIdx = Math.floor(weekStart / (7*86400));
  const idx = weekIdx % members.length;
  const from = weekStart;
  const to = weekStart + 7*86400;

  return json(200,"ok",{ group:g, members, current: members[idx], window:{ from, to } });
}
