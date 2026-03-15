import { nowSec, normEmail, randomB64, pbkdf2Hash, sha256Base64 } from "../../_lib.js";

export async function ensureInviteTables(env){
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS project_invite_links (
      id TEXT PRIMARY KEY,
      project_role_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'active',
      title TEXT,
      message TEXT,
      role_label TEXT,
      require_approval INTEGER NOT NULL DEFAULT 1,
      auto_create_user INTEGER NOT NULL DEFAULT 1,
      max_uses INTEGER NOT NULL DEFAULT 1,
      used_count INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER,
      created_by_user_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_project_invite_links_role
    ON project_invite_links(project_role_id)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_project_invite_links_status
    ON project_invite_links(status)
  `).run();

  await env.DB.prepare(`
    CREATE INDEX IF NOT EXISTS idx_project_invite_links_expires
    ON project_invite_links(expires_at)
  `).run();
}

export async function ensureRole(env, name){
  let r = await env.DB.prepare(
    "SELECT id FROM roles WHERE name=? LIMIT 1"
  ).bind(name).first();

  if(r) return r.id;

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO roles (id,name,created_at,description) VALUES (?,?,?,?)"
  ).bind(id, name, nowSec(), null).run();

  return id;
}

export async function ensureTalentBaseProfile(env, userId, payload = {}){
  const now = nowSec();

  const p1 = await env.DB.prepare(
    "SELECT id FROM talent_profiles WHERE user_id=? LIMIT 1"
  ).bind(userId).first();

  if(!p1){
    await env.DB.prepare(`
      INSERT INTO talent_profiles (
        id, user_id, display_name, public_slug, visibility_status, visibility_reason, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      String(payload.display_name || ""),
      null,
      "private",
      null,
      now,
      now
    ).run();
  }

  const p2 = await env.DB.prepare(
    "SELECT id FROM talent_profile_basic WHERE user_id=? LIMIT 1"
  ).bind(userId).first();

  if(!p2){
    await env.DB.prepare(`
      INSERT INTO talent_profile_basic (
        id, user_id, gender, dob, location, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      String(payload.gender || "") || null,
      String(payload.dob || "") || null,
      String(payload.location || "") || null,
      now,
      now
    ).run();
  }

  const p3 = await env.DB.prepare(
    "SELECT id FROM talent_contact_public WHERE user_id=? LIMIT 1"
  ).bind(userId).first();

  if(!p3){
    await env.DB.prepare(`
      INSERT INTO talent_contact_public (
        id, user_id, email, phone, website, contact_visibility, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      userId,
      String(payload.email || "") || null,
      String(payload.phone || "") || null,
      String(payload.website || "") || null,
      "private",
      now,
      now
    ).run();
  }

  const p4 = await env.DB.prepare(
    "SELECT user_id FROM talent_progress WHERE user_id=? LIMIT 1"
  ).bind(userId).first();

  if(!p4){
    await env.DB.prepare(`
      INSERT INTO talent_progress (
        user_id, completion_percent, visibility_status, visibility_reason, phone_verified, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      10,
      "private",
      null,
      0,
      now
    ).run();
  }
}

export async function createTalentUser(env, payload = {}){
  const email = normEmail(payload.email);
  const display_name = String(payload.display_name || "").trim();
  const password = String(payload.password || "");

  if(!email.includes("@")) throw new Error("invalid_email");
  if(password.length < 10) throw new Error("password_min_10");

  const used = await env.DB.prepare(
    "SELECT id FROM users WHERE email_norm=? LIMIT 1"
  ).bind(email).first();

  if(used) throw new Error("email_used");

  const now = nowSec();
  const user_id = crypto.randomUUID();
  const salt = randomB64(16);
  const iter = 100000;
  const hash = await pbkdf2Hash(password, salt, iter);

  let email_hash = "";
  try{
    email_hash = await sha256Base64(email + "|" + (env.HASH_PEPPER || ""));
  }catch{
    email_hash = email;
  }

  await env.DB.prepare(`
    INSERT INTO users (
      id,email_norm,email_hash,display_name,status,created_at,updated_at,
      password_hash,password_salt,password_iter,password_algo,
      email_verified,phone_verified,profile_completed
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    user_id,
    email,
    email_hash,
    display_name || email,
    "active",
    now,
    now,
    hash,
    salt,
    iter,
    "pbkdf2_sha256",
    0,
    0,
    0
  ).run();

  const role_id = await ensureRole(env, "talent");
  await env.DB.prepare(`
    INSERT OR IGNORE INTO user_roles (user_id, role_id, created_at)
    VALUES (?, ?, ?)
  `).bind(user_id, role_id, now).run();

  await ensureTalentBaseProfile(env, user_id, {
    email,
    display_name,
    phone: payload.phone,
    website: payload.website,
    gender: payload.gender,
    dob: payload.dob,
    location: payload.location
  });

  return { user_id, email };
}

export async function getInviteLinkDetail(env, token){
  return await env.DB.prepare(`
    SELECT
      l.id,
      l.project_role_id,
      l.token,
      l.status,
      l.title,
      l.message,
      l.role_label,
      l.require_approval,
      l.auto_create_user,
      l.max_uses,
      l.used_count,
      l.expires_at,
      l.created_by_user_id,
      l.created_at,
      l.updated_at,
      pr.role_name,
      pr.role_type,
      pr.qty_needed,
      pr.status AS project_role_status,
      p.id AS project_id,
      p.title AS project_title,
      p.status AS project_status,
      p.project_type,
      p.location_text,
      p.organization_id
    FROM project_invite_links l
    JOIN project_roles pr ON pr.id = l.project_role_id
    JOIN projects p ON p.id = pr.project_id
    WHERE l.token = ?
    LIMIT 1
  `).bind(token).first();
}

export function validateInviteRow(row){
  const now = nowSec();
  if(!row) return "invite_not_found";
  if(String(row.status || "") !== "active") return "invite_inactive";
  if(row.expires_at != null && Number(row.expires_at) > 0 && Number(row.expires_at) < now) return "invite_expired";
  if(Number(row.max_uses || 0) > 0 && Number(row.used_count || 0) >= Number(row.max_uses || 0)) return "invite_limit_reached";
  return "";
}

export async function upsertInviteForTalent(env, projectRoleId, talentUserId, status, message){
  const now = nowSec();

  const row = await env.DB.prepare(`
    SELECT id
    FROM project_invites
    WHERE project_role_id=? AND talent_user_id=?
    LIMIT 1
  `).bind(projectRoleId, talentUserId).first();

  if(row){
    await env.DB.prepare(`
      UPDATE project_invites
      SET status=?, message=?, responded_at=?
      WHERE id=?
    `).bind(status, message || null, now, row.id).run();
    return row.id;
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO project_invites (
      id, project_role_id, talent_user_id, status, message, response_message, created_at, responded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    projectRoleId,
    talentUserId,
    status,
    message || null,
    null,
    now,
    status === "pending" ? null : now
  ).run();

  return id;
}

export async function upsertBooking(env, projectRoleId, talentUserId, status, notes){
  const now = nowSec();

  const row = await env.DB.prepare(`
    SELECT id
    FROM project_bookings
    WHERE project_role_id=? AND talent_user_id=?
    LIMIT 1
  `).bind(projectRoleId, talentUserId).first();

  if(row){
    await env.DB.prepare(`
      UPDATE project_bookings
      SET status=?, notes=?, updated_at=?
      WHERE id=?
    `).bind(status, notes || null, now, row.id).run();
    return row.id;
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO project_bookings (
      id, project_role_id, talent_user_id, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, projectRoleId, talentUserId, status, notes || null, now, now).run();

  return id;
}

export async function increaseInviteUsage(env, inviteLinkId){
  await env.DB.prepare(`
    UPDATE project_invite_links
    SET used_count = COALESCE(used_count, 0) + 1,
        updated_at = ?
    WHERE id=?
  `).bind(nowSec(), inviteLinkId).run();
}

export function makeToken(){
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
}
