import { json, readJson, requireAuth } from "../../_lib.js";
import { generateRecoveryCodes, hashRecoveryCodes } from "./_common.js";

export async function onRequestPost({ request, env }){
  const a = await requireAuth(env, request);
  if(!a.ok) return a.res;

  const body = await readJson(request) || {};
  const regenerate = body.regenerate === true;

  const user = await env.DB.prepare(`
    SELECT id, email_norm, display_name, mfa_enabled
    FROM users
    WHERE id = ?
    LIMIT 1
  `).bind(a.uid).first();

  if(!user){
    return json(404, "not_found", { message:"user_not_found" });
  }

  if(Number(user.mfa_enabled || 0) !== 1){
    return json(400, "invalid_input", { message:"mfa_not_enabled" });
  }

  const plainCodes = generateRecoveryCodes();
  const hashedCodes = await hashRecoveryCodes(plainCodes);

  if(regenerate || true){
    await env.DB.prepare(`
      UPDATE users
      SET recovery_codes_json = ?, updated_at = strftime('%s','now')
      WHERE id = ?
    `).bind(JSON.stringify(hashedCodes), a.uid).run();
  }

  const printable_text = [
    "ORLAND MFA RECOVERY CODES",
    "=========================",
    `User: ${user.display_name || user.email_norm || user.id}`,
    `Email: ${user.email_norm || "-"}`,
    "",
    "Store these codes in a safe place.",
    "Each code can be used once.",
    "",
    ...plainCodes.map((c, i) => `${i + 1}. ${c}`)
  ].join("\\n");

  return json(200, "ok", {
    generated: true,
    regenerate,
    count: plainCodes.length,
    codes: plainCodes,
    printable_text,
    filename: `orland-recovery-codes-${String(user.id || "user").slice(0,8)}.txt`
  });
}
