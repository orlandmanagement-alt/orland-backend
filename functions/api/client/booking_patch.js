import { json, readJson, requireAuth, nowSec } from "../../_lib.js";

function canAccessClient(roles){
  const set = new Set((roles || []).map(String));
  return set.has("client") || set.has("super_admin") || set.has("admin");
}

export async function onRequestPost({ request, env }){
  const auth = await requireAuth(env, request);
  if(!auth.ok) return auth.res;

  if(!canAccessClient(auth.roles || [])){
    return json(403, "forbidden", { message: "role_not_allowed" });
  }

  const body = await readJson(request) || {};
  const bookingId = String(body.booking_id || "").trim();
  const status = String(body.status || "").trim().toLowerCase();
  const notes = String(body.notes || "").trim();

  if(!bookingId){
    return json(400, "invalid_input", { message: "booking_id_required" });
  }

  const allowed = new Set(["pending", "confirmed", "cancelled", "completed"]);
  if(status && !allowed.has(status)){
    return json(400, "invalid_input", { message: "invalid_booking_status" });
  }

  const found = await env.DB.prepare(`
    SELECT id, status, notes
    FROM project_bookings
    WHERE id = ?
    LIMIT 1
  `).bind(bookingId).first();

  if(!found){
    return json(404, "not_found", { message: "booking_not_found" });
  }

  const nextStatus = status || String(found.status || "pending");
  const nextNotes = notes || String(found.notes || "");
  const updatedAt = nowSec();

  try{
    await env.DB.prepare(`
      UPDATE project_bookings
      SET status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `).bind(
      nextStatus,
      nextNotes,
      updatedAt,
      bookingId
    ).run();

    return json(200, "ok", {
      id: bookingId,
      status: nextStatus,
      notes: nextNotes,
      updated_at: updatedAt
    });
  }catch(err){
    return json(500, "server_error", {
      message: "failed_to_patch_booking",
      detail: String(err?.message || err)
    });
  }
}
