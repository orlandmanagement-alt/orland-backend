import { json, requireAuth, hasRole, nowSec } from "../_lib.js";

function s(v){ return String(v || "").trim(); }

export async function onRequestGet({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;
  if(!hasRole(a.roles, ["super_admin","admin"])) return json(403, "forbidden", null);

  const url = new URL(request.url);
  const q = s(url.searchParams.get("q")).toLowerCase();
  const state = s(url.searchParams.get("state")).toLowerCase();
  const now = nowSec();

  const r = await env.DB.prepare(`
    SELECT
      b.id,
      b.ip_hash,
      b.reason,
      b.expires_at,
      b.revoked_at,
      b.created_at,
      b.created_by_user_id,
      u.display_name AS created_by_name,
      u.email_norm AS created_by_email
    FROM ip_blocks b
    LEFT JOIN users u ON u.id = b.created_by_user_id
    ORDER BY b.created_at DESC
  `).all();

  let items = (r.results || []).map(x => {
    const revoked = !!Number(x.revoked_at || 0);
    const expired = !revoked && Number(x.expires_at || 0) > 0 && Number(x.expires_at || 0) <= now;
    const active = !revoked && !expired;
    return {
      ...x,
      state: active ? "active" : (revoked ? "revoked" : "expired")
    };
  });

  if(state){
    items = items.filter(x => String(x.state) === state);
  }

  if(q){
    items = items.filter(x => {
      const hay = [
        x.id,
        x.ip_hash,
        x.reason,
        x.created_by_name,
        x.created_by_email,
        x.state
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }

  const stats = {
    total: items.length,
    active: items.filter(x => x.state === "active").length,
    revoked: items.filter(x => x.state === "revoked").length,
    expired: items.filter(x => x.state === "expired").length
  };

  return json(200, "ok", {
    items,
    stats
  });
}
