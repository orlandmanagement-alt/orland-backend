import { nowSec } from "../../../_lib.js";

export async function setBreakerConfig(env, k, v){
  await env.DB.prepare(`
    INSERT INTO blogspot_breaker_config (k, v, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(k) DO UPDATE SET
      v = excluded.v,
      updated_at = excluded.updated_at
  `).bind(String(k), String(v ?? ""), nowSec()).run();
}

export async function getBreakerConfigValue(env, k, fallback = ""){
  const row = await env.DB.prepare(`
    SELECT v FROM blogspot_breaker_config WHERE k=? LIMIT 1
  `).bind(String(k)).first();
  return row ? String(row.v || "") : String(fallback ?? "");
}

export async function getBreakerConfig(env){
  return {
    breaker_enabled: (await getBreakerConfigValue(env, "breaker_enabled", "1")) === "1",
    fail_threshold: Math.max(1, Math.min(100, Number(await getBreakerConfigValue(env, "fail_threshold", "5")))),
    reopen_sec: Math.max(10, Math.min(86400, Number(await getBreakerConfigValue(env, "reopen_sec", "300")))),
    half_open_success_needed: Math.max(1, Math.min(20, Number(await getBreakerConfigValue(env, "half_open_success_needed", "2")))),
    quota_warn_threshold_minute: Math.max(1, Math.min(10000, Number(await getBreakerConfigValue(env, "quota_warn_threshold_minute", "60")))),
    quota_warn_threshold_day: Math.max(1, Math.min(1000000, Number(await getBreakerConfigValue(env, "quota_warn_threshold_day", "2000"))))
  };
}

export function breakerScopeForJobType(jobType){
  const t = String(jobType || "").trim().toLowerCase();
  if(t.startsWith("publish_")) return "publish";
  if(t.startsWith("refresh_")) return "refresh";
  if(t.startsWith("delete_")) return "delete";
  if(t === "sync_run") return "sync";
  return "generic";
}

export async function getHealthRow(env, scope_key){
  const row = await env.DB.prepare(`
    SELECT *
    FROM blogspot_upstream_health
    WHERE scope_key=?
    LIMIT 1
  `).bind(String(scope_key || "")).first();

  if(row) return {
    scope_key: String(row.scope_key || ""),
    breaker_state: String(row.breaker_state || "closed"),
    fail_count: Number(row.fail_count || 0),
    success_count: Number(row.success_count || 0),
    last_error: String(row.last_error || ""),
    last_failure_at: Number(row.last_failure_at || 0),
    last_success_at: Number(row.last_success_at || 0),
    reopen_after: Number(row.reopen_after || 0),
    updated_at: Number(row.updated_at || 0)
  };

  return {
    scope_key: String(scope_key || ""),
    breaker_state: "closed",
    fail_count: 0,
    success_count: 0,
    last_error: "",
    last_failure_at: 0,
    last_success_at: 0,
    reopen_after: 0,
    updated_at: 0
  };
}

export async function setHealthRow(env, patch){
  await env.DB.prepare(`
    INSERT INTO blogspot_upstream_health (
      scope_key, breaker_state, fail_count, success_count, last_error,
      last_failure_at, last_success_at, reopen_after, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(scope_key) DO UPDATE SET
      breaker_state = excluded.breaker_state,
      fail_count = excluded.fail_count,
      success_count = excluded.success_count,
      last_error = excluded.last_error,
      last_failure_at = excluded.last_failure_at,
      last_success_at = excluded.last_success_at,
      reopen_after = excluded.reopen_after,
      updated_at = excluded.updated_at
  `).bind(
    String(patch.scope_key || ""),
    String(patch.breaker_state || "closed"),
    Number(patch.fail_count || 0),
    Number(patch.success_count || 0),
    String(patch.last_error || ""),
    Number(patch.last_failure_at || 0),
    Number(patch.last_success_at || 0),
    Number(patch.reopen_after || 0),
    nowSec()
  ).run();
}

export async function recordUpstreamFailure(env, scope_key, errorMessage){
  const cfg = await getBreakerConfig(env);
  const row = await getHealthRow(env, scope_key);
  const fail_count = Number(row.fail_count || 0) + 1;
  const shouldOpen = cfg.breaker_enabled && fail_count >= cfg.fail_threshold;

  await setHealthRow(env, {
    scope_key,
    breaker_state: shouldOpen ? "open" : row.breaker_state || "closed",
    fail_count,
    success_count: 0,
    last_error: String(errorMessage || "upstream_failure"),
    last_failure_at: nowSec(),
    last_success_at: Number(row.last_success_at || 0),
    reopen_after: shouldOpen ? nowSec() + cfg.reopen_sec : Number(row.reopen_after || 0)
  });
}

export async function recordUpstreamSuccess(env, scope_key){
  const cfg = await getBreakerConfig(env);
  const row = await getHealthRow(env, scope_key);
  let breaker_state = row.breaker_state || "closed";
  let success_count = Number(row.success_count || 0) + 1;

  if(breaker_state === "half_open" && success_count >= cfg.half_open_success_needed){
    breaker_state = "closed";
    success_count = 0;
  }

  if(breaker_state === "closed"){
    success_count = 0;
  }

  await setHealthRow(env, {
    scope_key,
    breaker_state,
    fail_count: 0,
    success_count,
    last_error: "",
    last_failure_at: Number(row.last_failure_at || 0),
    last_success_at: nowSec(),
    reopen_after: 0
  });
}

export async function checkBreaker(env, scope_key){
  const cfg = await getBreakerConfig(env);
  if(!cfg.breaker_enabled) return { ok:true, state:"disabled" };

  const row = await getHealthRow(env, scope_key);
  const now = nowSec();

  if(row.breaker_state === "open"){
    if(Number(row.reopen_after || 0) > 0 && now >= Number(row.reopen_after || 0)){
      await setHealthRow(env, {
        scope_key,
        breaker_state: "half_open",
        fail_count: 0,
        success_count: 0,
        last_error: row.last_error || "",
        last_failure_at: Number(row.last_failure_at || 0),
        last_success_at: Number(row.last_success_at || 0),
        reopen_after: 0
      });
      return { ok:true, state:"half_open" };
    }
    return { ok:false, state:"open", reopen_after: Number(row.reopen_after || 0), last_error: row.last_error || "" };
  }

  return { ok:true, state: row.breaker_state || "closed" };
}

export async function bumpQuota(env, scope_key){
  const cfg = await getBreakerConfig(env);
  const minute_window = Math.floor(nowSec() / 60);
  const day_window = Math.floor(nowSec() / 86400);

  const row = await env.DB.prepare(`
    SELECT *
    FROM blogspot_quota_state
    WHERE scope_key=?
    LIMIT 1
  `).bind(String(scope_key || "")).first();

  let minute_count = 1;
  let day_count = 1;

  if(row){
    minute_count = Number(row.minute_window || 0) === minute_window ? Number(row.minute_count || 0) + 1 : 1;
    day_count = Number(row.day_window || 0) === day_window ? Number(row.day_count || 0) + 1 : 1;
  }

  await env.DB.prepare(`
    INSERT INTO blogspot_quota_state (
      scope_key, minute_window, minute_count, day_window, day_count,
      warn_threshold_minute, warn_threshold_day, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(scope_key) DO UPDATE SET
      minute_window = excluded.minute_window,
      minute_count = excluded.minute_count,
      day_window = excluded.day_window,
      day_count = excluded.day_count,
      warn_threshold_minute = excluded.warn_threshold_minute,
      warn_threshold_day = excluded.warn_threshold_day,
      updated_at = excluded.updated_at
  `).bind(
    String(scope_key || ""),
    minute_window,
    minute_count,
    day_window,
    day_count,
    cfg.quota_warn_threshold_minute,
    cfg.quota_warn_threshold_day,
    nowSec()
  ).run();

  return {
    minute_count,
    day_count,
    warn_minute: minute_count >= cfg.quota_warn_threshold_minute,
    warn_day: day_count >= cfg.quota_warn_threshold_day
  };
}

export async function breakerStatusSummary(env){
  const health = await env.DB.prepare(`
    SELECT *
    FROM blogspot_upstream_health
    ORDER BY updated_at DESC
  `).all();

  const quota = await env.DB.prepare(`
    SELECT *
    FROM blogspot_quota_state
    ORDER BY updated_at DESC
  `).all();

  return {
    health: health.results || [],
    quota: quota.results || []
  };
}
