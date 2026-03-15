import { json, requireAuth, nowSec, auditEvent } from "../../_lib.js";

function canAccessAdmin(roles){
  const s = new Set((roles || []).map(String));
  return s.has("super_admin") || s.has("admin") || s.has("security_admin");
}

async function readJsonSafe(request){
  try{
    return await request.json();
  }catch{
    return {};
  }
}

export async function onRequestPost({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;
  if(!canAccessAdmin(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const body = await readJsonSafe(request);
  const ids = Array.isArray(body.ip_block_ids) ? body.ip_block_ids.map(String).filter(Boolean) : [];

  if(!ids.length){
    return json(400, "invalid_input", { message: "ip_block_ids_required" });
  }

  try{
    let affected = 0;
    for(const id of ids){
      const r = await env.DB.prepare(`
        UPDATE ip_blocks
        SET revoked_at = ?
        WHERE id = ? AND revoked_at IS NULL
      `).bind(nowSec(), id).run();

      affected += Number(r?.meta?.changes || 0);
    }

    await auditEvent(env, request, {
      actor_user_id: auth.uid,
      action: "admin_bulk_unblock_ip",
      http_status: 200,
      meta: { count: ids.length, affected }
    });

    return json(200, "ok", {
      requested: ids.length,
      affected
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_unblock_ip_blocks",
      detail: String(err?.message || err)
    });
  }
}
