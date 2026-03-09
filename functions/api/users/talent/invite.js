import { json, readJson, requireAuth, hasRole, sha256Base64, nowSec, normEmail, randomB64 } from "../../../_lib.js";

/**
 * POST /api/users/talent/invite
 * Body: { email, role="talent", ttl_hours=72, tenant_id=null, note=null }
 * Creates invite token (returned once) and stores email_hash in invites table.
 *
 * Notes:
 * - token = randomB64(24) (plaintext returned), stored hashed in invites.id (sha256) or as id raw if you want.
 * - We'll store: invites.id = token_hash (sha256), and meta stored in system_settings? (not needed)
 * - invites table schema in your DB: (id, email_hash, role, expires_at, used_at, used_by_user_id, created_by_user_id, created_at, tenant_id)
 */
export async function onRequestPost({ request, env }) {
  const a = await requireAuth(env, request);
  if (!a.ok) return a.res;

  // Only super_admin/admin can invite talents
  if (!hasRole(a.roles, ["super_admin", "admin"])) return json(403, "forbidden", null);

  const body = (await readJson(request)) || {};
  const email = normEmail(body.email);
  const role = String(body.role || "talent").trim();
  const ttl_hours = Math.max(1, Math.min(720, Number(body.ttl_hours || 72))); // 1h..30d
  const tenant_id = body.tenant_id ? String(body.tenant_id) : null;

  if (!email.includes("@")) return json(400, "invalid_input", { message: "email" });
  if (!["talent", "client", "staff", "admin", "super_admin"].includes(role)) {
    return json(400, "invalid_input", { message: "role" });
  }

  const now = nowSec();
  const expires_at = now + Math.floor(ttl_hours * 3600);

  // email hash
  const pepper = env.HASH_PEPPER || "";
  const email_hash = pepper
    ? await sha256Base64(`${email}|${pepper}`)
    : await sha256Base64(email);

  // token
  const token = randomB64(24); // user will see this ONCE
  const token_hash = await sha256Base64(`${token}|${pepper || "pepper"}`);

  // store invite
  await env.DB.prepare(
    `INSERT INTO invites (id, email_hash, role, expires_at, used_at, used_by_user_id, created_by_user_id, created_at, tenant_id)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).bind(
    token_hash,
    email_hash,
    role,
    expires_at,
    null,
    null,
    a.uid,
    now,
    tenant_id
  ).run();

  return json(200, "ok", {
    token,
    email_norm: email,
    role,
    expires_at
  });
}
