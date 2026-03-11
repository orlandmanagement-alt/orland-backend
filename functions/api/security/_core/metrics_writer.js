import { nowSec } from "../../../_lib.js";

function pad2(n){
  n = Number(n || 0);
  return n < 10 ? "0" + n : String(n);
}

function utcDayKey(ts){
  const d = new Date(Number(ts) * 1000);
  return (
    d.getUTCFullYear() + "-" +
    pad2(d.getUTCMonth() + 1) + "-" +
    pad2(d.getUTCDate())
  );
}

function utcHourKey(ts){
  const d = new Date(Number(ts) * 1000);
  return (
    d.getUTCFullYear() + "-" +
    pad2(d.getUTCMonth() + 1) + "-" +
    pad2(d.getUTCDate()) + " " +
    pad2(d.getUTCHours()) + ":00"
  );
}

const DAILY_MAP = {
  otp_send_ok: "otp_send_ok",
  otp_send_fail: "otp_send_fail",
  otp_verify_ok: "otp_verify_ok",
  otp_verify_fail: "otp_verify_fail",
  lockout: "lockouts",
  rate_limited: "rate_limited",
  incidents_created: "incidents_created"
};

const HOURLY_MAP = {
  otp_send_fail: "otp_send_fail",
  otp_verify_fail: "otp_verify_fail",
  rate_limited: "rate_limited",
  lockout: "lockouts",
  password_fail: "password_fail",
  session_anomaly: "session_anomaly"
};

async function ensureDailyRow(env, day, now){
  await env.DB.prepare(`
    INSERT INTO daily_metrics (
      day,
      otp_send_ok, otp_send_fail, otp_verify_ok, otp_verify_fail,
      tasks_done, tasks_retry, tasks_dlq,
      lockouts, rate_limited, incidents_created,
      updated_at
    )
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(day) DO NOTHING
  `).bind(
    day,
    0,0,0,0,
    0,0,0,
    0,0,0,
    now
  ).run();
}

async function ensureHourlyRow(env, hour, now){
  await env.DB.prepare(`
    INSERT INTO hourly_metrics (
      hour,
      otp_send_fail, otp_verify_fail, rate_limited, lockouts,
      updated_at, password_fail, session_anomaly
    )
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(hour) DO NOTHING
  `).bind(
    hour,
    0,0,0,0,
    now,0,0
  ).run();
}

export async function bumpMetric(env, action, amount=1){
  const now = nowSec();
  const day = utcDayKey(now);
  const hour = utcHourKey(now);

  const dailyCol = DAILY_MAP[action] || null;
  const hourlyCol = HOURLY_MAP[action] || null;

  if(!dailyCol && !hourlyCol) return { ok:true, skipped:true };

  if(dailyCol){
    await ensureDailyRow(env, day, now);
    await env.DB.prepare(`
      UPDATE daily_metrics
      SET ${dailyCol} = COALESCE(${dailyCol},0) + ?,
          updated_at = ?
      WHERE day = ?
    `).bind(Number(amount || 1), now, day).run();
  }

  if(hourlyCol){
    await ensureHourlyRow(env, hour, now);
    await env.DB.prepare(`
      UPDATE hourly_metrics
      SET ${hourlyCol} = COALESCE(${hourlyCol},0) + ?,
          updated_at = ?
      WHERE hour = ?
    `).bind(Number(amount || 1), now, hour).run();
  }

  return {
    ok:true,
    action,
    amount:Number(amount || 1),
    day,
    hour,
    dailyCol,
    hourlyCol
  };
}
