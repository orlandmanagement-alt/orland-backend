import { json } from "../../_lib.js";

const BOOTSTRAP_LOCK_KEY = "bootstrap_superadmin_lock_v1";

async function isBootstrapLocked(env){
  try{
    const row = await env.DB.prepare(`
      SELECT v
      FROM system_settings
      WHERE k = ?
      LIMIT 1
    `).bind(BOOTSTRAP_LOCK_KEY).first();

    return String(row?.v || "") === "1";
  }catch{
    return false;
  }
}

export async function onRequestGet({ env }){
  const usersRow = await env.DB.prepare(`
    SELECT COUNT(*) AS total
    FROM users
  `).first();

  const total_users = Number(usersRow?.total || 0);
  const bootstrap_locked = await isBootstrapLocked(env);

  return json(200, "ok", {
    total_users,
    bootstrap_locked,
    bootstrap_available: !bootstrap_locked && total_users === 0
  });
}
