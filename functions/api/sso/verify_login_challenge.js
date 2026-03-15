import {
  json,
  readJson,
  cookie,
  nowSec,
  sha256Base64,
  auditEvent,
  getRolesForUser,
  createSession,
  requireEnv
} from "../../_lib.js";

function getClientIp(request){
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    ""
  );
}

function getUa(request){
  return request.headers.get("user-agent") || "";
}

async function sha(v){
  return await sha256Base64(String(v || ""));
}

async function hashIp(env, ip){
  const pepper = String(env.HASH_PEPPER || "");
  return await sha256Base64(String(ip || "") + "|" + pepper);
}

async function computeDeviceHash(env, request, userId){
  const ua = getUa(request);
  const ip = getClientIp(request);
  const raw = `${userId}|${ua}|${ip}|${env.HASH_PEPPER || ""}`;
  return await sha256Base64(raw);
}

function resolveTargetByRoles(env, roles){
  const r = new Set((roles || []).map(String));
  if(
    r.has("super_admin") ||
    r.has("admin") ||
    r.has("staff") ||
    r.has("security_admin") ||
    r.has("audit_admin") ||
    r.has("ops_admin") ||
    r.has("access_admin")
  ){
    return String(env.SSO_DEFAULT_REDIRECT_ADMIN || "https://dashboard.orlandmanagement.com");
  }
  if(r.has("client")){
    return String(env.SSO_DEFAULT_REDIRECT_CLIENT || "https://client.orlandmanagement.com");
  }
  if(r.has("talent")){
    return String(env.SSO_DEFAULT_REDIRECT_TALENT || "https://talent.orlandmanagement.com");
  }
  return String(env.SSO_DEFAULT_REDIRECT_DENIED || "https://sso.orlandmanagement.com/app/pages/sso/access-denied.html");
}

function needsRoleChoice(roles){
  const portalRoles = [];
  const r = new Set((roles || []).map(String));

  if(
    r.has("super_admin") ||
    r.has("admin") ||
    r.has("staff") ||
    r.has("security_admin") ||
    r.has("audit_admin") ||
    r.has("ops_admin") ||
    r.has("access_admin")
  ) portalRoles.push("dashboard");

  if(r.has("client")) portalRoles.push("client");
  if(r.has("talent")) portalRoles.push("talent");

  return portalRoles.length > 1;
}

export async function onRequestPost({ request, env }){
  const started = Date.now();
  const miss = requireEnv(env, ["HASH_PEPPER"]);
  if(miss.length) return json(500, "server_error", { message: "missing_env", missing: miss });

  const body = await readJson(request) || {};
  const challengeId = String(body.challenge_id || "").trim();
  const otpCode = String(body.otp_code || "").trim();

  if(!challengeId || !otpCode){
    return json(400, "invalid_input", { message: "challenge_id_and_otp_code_required" });
  }

  const ip = getClientIp(request);
  const ua = getUa(request);
  const ipHash = await hashIp(env, ip);
  const uaHash = await sha(ua);
  const now = nowSec();

  const row = await env.DB.prepare(`
    SELECT
      c.id,
      c.user_id,
      c.identity_type,
      c.identity_value,
      c.otp_code,
      c.status,
      c.expires_at,
      u.id AS uid,
      u.email_norm,
      u.display_name,
      u.status AS user_status,
      u.disabled_at,
      u.session_version,
      u.locked_until,
      u.lock_reason
    FROM sso_login_challenges c
    JOIN users u ON u.id = c.user_id
    WHERE c.id = ?
    LIMIT 1
  `).bind(challengeId).first();

  if(!row){
    return json(404, "not_found", { message: "challenge_not_found" });
  }

  if(String(row.user_status || "").toLowerCase() !== "active" || row.disabled_at != null){
    return json(403, "forbidden", { message: "user_inactive" });
  }

  if(row.locked_until != null && Number(row.locked_until || 0) > now){
    return json(423, "locked", {
      message: "account_locked",
      locked_until: Number(row.locked_until || 0),
      lock_reason: row.lock_reason || null
    });
  }

  if(String(row.status || "") !== "pending"){
    return json(403, "forbidden", { message: "challenge_not_pending" });
  }

  if(Number(row.expires_at || 0) < now){
    await env.DB.prepare(`
      UPDATE sso_login_challenges
      SET status = 'expired'
      WHERE id = ?
    `).bind(challengeId).run();

    return json(403, "forbidden", { message: "challenge_expired" });
  }

  if(String(row.otp_code || "") !== otpCode){
    await env.DB.prepare(`
      INSERT INTO sso_login_events (
        id, user_id, identity_type, identity_value, flow, result,
        ip_hash, ua_hash, meta_json, created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).bind(
      crypto.randomUUID(),
      row.user_id,
      row.identity_type,
      row.identity_value,
      "verify_login_challenge",
      "invalid_otp",
      ipHash,
      uaHash,
      JSON.stringify({ challenge_id: row.id }),
      now
    ).run();

    await auditEvent(env, request, {
      actor_user_id: row.user_id,
      action: "sso_verify_login_challenge_fail",
      ip_hash: ipHash,
      ua_hash: uaHash,
      http_status: 403,
      duration_ms: Date.now() - started,
      meta: { challenge_id: row.id, reason: "invalid_otp" }
    });

    return json(403, "forbidden", { message: "invalid_otp_code" });
  }

  await env.DB.prepare(`
    UPDATE sso_login_challenges
    SET status = 'consumed', consumed_at = ?
    WHERE id = ?
  `).bind(now, challengeId).run();

  const roles = await getRolesForUser(env, row.user_id);
  const sessionVersion = Number(row.session_version || 1);

  const sess = await createSession(env, row.user_id, roles, {
    ip_hash: ipHash,
    ua_hash: uaHash,
    session_version: sessionVersion
  });

  const deviceHash = await computeDeviceHash(env, request, row.user_id);
  const trustEnabled = Number(env.SSO_TRUST_DEVICE_ENABLED || 1) === 1;

  let trusted = false;
  if(trustEnabled){
    const existing = await env.DB.prepare(`
      SELECT id, status
      FROM sso_trusted_devices
      WHERE user_id = ? AND device_hash = ?
      LIMIT 1
    `).bind(row.user_id, deviceHash).first();

    if(existing && String(existing.status || "") === "active"){
      trusted = true;
      await env.DB.prepare(`
        UPDATE sso_trusted_devices
        SET last_ip_hash = ?, last_ua_hash = ?, last_seen_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(ipHash, uaHash, now, now, existing.id).run();
    } else if(!existing){
      await env.DB.prepare(`
        INSERT INTO sso_trusted_devices (
          id, user_id, device_hash, device_name, status,
          first_ip_hash, last_ip_hash, first_ua_hash, last_ua_hash,
          last_seen_at, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        crypto.randomUUID(),
        row.user_id,
        deviceHash,
        "New Device",
        "pending",
        ipHash,
        ipHash,
        uaHash,
        uaHash,
        now,
        now,
        now
      ).run();
    }
  } else {
    trusted = true;
  }

  const targetUrl = resolveTargetByRoles(env, roles);
  const multiRole = needsRoleChoice(roles);

  await env.DB.prepare(`
    INSERT INTO sso_login_events (
      id, user_id, identity_type, identity_value, flow, result,
      ip_hash, ua_hash, meta_json, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(),
    row.user_id,
    row.identity_type,
    row.identity_value,
    "verify_login_challenge",
    "success",
    ipHash,
    uaHash,
    JSON.stringify({
      challenge_id: row.id,
      multi_role: multiRole,
      device_trusted: trusted,
      target_url: targetUrl
    }),
    now
  ).run();

  await auditEvent(env, request, {
    actor_user_id: row.user_id,
    action: "sso_login_success",
    ip_hash: ipHash,
    ua_hash: uaHash,
    http_status: 200,
    duration_ms: Date.now() - started,
    meta: {
      roles,
      multi_role: multiRole,
      device_trusted: trusted,
      session_version: sessionVersion,
      target_url: targetUrl
    }
  });
  
  function ssoPage(env, path){
  const base = String(env.SSO_APP_BASE_URL || "https://sso.orlandmanagement.com").replace(/\/+$/, "");
  const clean = String(path || "").startsWith("/") ? String(path) : `/${String(path || "")}`;
  return base + clean;
}

  const res = json(200, "ok", {
  id: row.user_id,
  email_norm: row.email_norm,
  display_name: row.display_name,
  roles,
  exp: sess.exp,
  device_trusted: trusted,
  choose_role: multiRole,
  next: multiRole
    ? ssoPage(env, "/app/pages/sso/choose-role.html")
    : (trusted
        ? ssoPage(env, "/app/pages/sso/session-check.html")
        : ssoPage(env, "/app/pages/sso/device-verification.html")),
  redirect_hint: targetUrl
});

  res.headers.append("set-cookie", cookie("sid", sess.sid, {
    maxAge: sess.ttl,
    domain: env.COOKIE_DOMAIN || ".orlandmanagement.com"
  }));

  return res;
}
