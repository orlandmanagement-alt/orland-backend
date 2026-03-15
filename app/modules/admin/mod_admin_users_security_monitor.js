import { buildAdminUrl, getJson, postJson } from "../../js/admin_security_helper.js";
import { renderAdminPaging } from "../../js/admin_monitor_helper.js";
import { showAdminNotice } from "../../js/admin_notice.js";
import { withAdminLoading } from "../../js/admin_loading.js";

let offset = 0;

function getEl(id){
  return document.getElementById(id);
}

function getRiskLabel(row){
  const out = [];
  const now = Math.floor(Date.now() / 1000);

  if(row?.locked_until && Number(row.locked_until) > now){
    out.push("LOCKED");
  }
  if(Number(row?.pw_fail_count || 0) > 0){
    out.push(`FAIL=${Number(row.pw_fail_count || 0)}`);
  }
  if(row?.disabled_at){
    out.push("DISABLED");
  }
  if(Number(row?.mfa_enabled || 0) === 1){
    out.push("MFA");
  }
  if(Number(row?.require_mfa_enroll || 0) === 1){
    out.push("REQUIRE_ENROLL");
  }

  return out.join(" • ") || "NORMAL";
}

async function actionPost(path, body, loadingTarget){
  return withAdminLoading(loadingTarget, async () => {
    return await postJson(path, body);
  });
}

async function requireMfaEnroll(userId, enabled, btn){
  const info = getEl("usersSecurityInfo");
  const res = await actionPost("/functions/api/admin/user_require_mfa_enrollment", {
    user_id: userId,
    enabled: enabled ? 1 : 0
  }, btn);

  if(res.status !== "ok"){
    if(info) info.textContent = res?.data?.message || "Failed to update MFA enrollment requirement.";
    showAdminNotice(res?.data?.message || "Failed to update MFA enrollment requirement.", "error");
    return;
  }

  showAdminNotice(`MFA enrollment requirement updated: ${userId}`, "success");
  if(info) info.textContent = `MFA enrollment requirement updated: ${userId}`;
  await load();
}

async function unlockUser(userId, btn){
  const info = getEl("usersSecurityInfo");
  const res = await actionPost("/functions/api/admin/user_unlock", {
    user_id: userId,
    reason: "unlock_from_users_security_monitor"
  }, btn);

  if(res.status !== "ok"){
    if(info) info.textContent = res?.data?.message || "Failed to unlock user.";
    showAdminNotice(res?.data?.message || "Failed to unlock user.", "error");
    return;
  }

  showAdminNotice(`User unlocked: ${userId}`, "success");
  if(info) info.textContent = `User unlocked: ${userId}`;
  await load();
}

async function revokeAllSessions(userId, btn){
  const info = getEl("usersSecurityInfo");
  const res = await actionPost("/functions/api/admin/user_revoke_all_sessions", {
    user_id: userId,
    reason: "revoke_all_sessions_from_users_security_monitor"
  }, btn);

  if(res.status !== "ok"){
    if(info) info.textContent = res?.data?.message || "Failed to revoke sessions.";
    showAdminNotice(res?.data?.message || "Failed to revoke sessions.", "error");
    return;
  }

  showAdminNotice(`All sessions revoked for user: ${userId}`, "success");
  if(info) info.textContent = `All sessions revoked for user: ${userId}`;
  await load();
}

async function disableUser(userId, btn){
  const info = getEl("usersSecurityInfo");
  const res = await actionPost("/functions/api/admin/user_disable", {
    user_id: userId,
    reason: "disable_from_users_security_monitor"
  }, btn);

  if(res.status !== "ok"){
    if(info) info.textContent = res?.data?.message || "Failed to disable user.";
    showAdminNotice(res?.data?.message || "Failed to disable user.", "error");
    return;
  }

  showAdminNotice(`User disabled: ${userId}`, "success");
  if(info) info.textContent = `User disabled: ${userId}`;
  await load();
}

async function enableUser(userId, btn){
  const info = getEl("usersSecurityInfo");
  const res = await actionPost("/functions/api/admin/user_enable", {
    user_id: userId
  }, btn);

  if(res.status !== "ok"){
    if(info) info.textContent = res?.data?.message || "Failed to enable user.";
    showAdminNotice(res?.data?.message || "Failed to enable user.", "error");
    return;
  }

  showAdminNotice(`User enabled: ${userId}`, "success");
  if(info) info.textContent = `User enabled: ${userId}`;
  await load();
}

async function resetFailCounter(userId, btn){
  const info = getEl("usersSecurityInfo");
  const res = await actionPost("/functions/api/admin/user_reset_fail_counter", {
    user_id: userId
  }, btn);

  if(res.status !== "ok"){
    if(info) info.textContent = res?.data?.message || "Failed to reset fail counter.";
    showAdminNotice(res?.data?.message || "Failed to reset fail counter.", "error");
    return;
  }

  showAdminNotice(`Fail counter reset: ${userId}`, "success");
  if(info) info.textContent = `Fail counter reset: ${userId}`;
  await load();
}

async function requirePasswordReset(userId, enabled, btn){
  const info = getEl("usersSecurityInfo");
  const res = await actionPost("/functions/api/admin/user_require_password_reset", {
    user_id: userId,
    enabled: enabled ? 1 : 0
  }, btn);

  if(res.status !== "ok"){
    if(info) info.textContent = res?.data?.message || "Failed to update password reset requirement.";
    showAdminNotice(res?.data?.message || "Failed to update password reset requirement.", "error");
    return;
  }

  showAdminNotice(`Password reset requirement updated: ${userId}`, "success");
  if(info) info.textContent = `Password reset requirement updated: ${userId}`;
  await load();
}

function bindRowActions(){
  document.querySelectorAll("[data-action]").forEach(btn => {
    if(btn.dataset.bound) return;
    btn.dataset.bound = "1";

    btn.addEventListener("click", async () => {
      const action = String(btn.dataset.action || "");
      const userId = String(btn.dataset.userId || "").trim();
      if(!userId) return;

      if(action === "unlock-user") return unlockUser(userId, btn);
      if(action === "revoke-user-sessions") return revokeAllSessions(userId, btn);
      if(action === "disable-user") return disableUser(userId, btn);
      if(action === "enable-user") return enableUser(userId, btn);
      if(action === "reset-fail-counter") return resetFailCounter(userId, btn);
      if(action === "require-password-reset") return requirePasswordReset(userId, true, btn);
      if(action === "clear-password-reset") return requirePasswordReset(userId, false, btn);
      if(action === "require-mfa-enroll") return requireMfaEnroll(userId, true, btn);
      if(action === "clear-mfa-enroll") return requireMfaEnroll(userId, false, btn);
    });
  });
}

async function load(){
  const info = getEl("usersSecurityInfo");
  const list = getEl("usersSecurityList");

  const q = String(getEl("adminUsersSecuritySearch")?.value || "").trim();
  const limit = Number(getEl("adminUsersSecurityLimit")?.value || 20);
  const riskOnly = getEl("adminUsersSecurityRiskOnly")?.checked ? "1" : "0";

  const url = buildAdminUrl("/functions/api/admin/users_security_monitor_get", {
    q,
    limit,
    offset,
    risk_only: riskOnly
  });

  const res = await getJson(url);
  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load users security monitor.";
    showAdminNotice(res?.data?.message || "Failed to load users security monitor.", "error");
    return;
  }

  const rows = res.data?.items || [];
  const paging = res.data?.paging || {};

  if(info) info.textContent = `Loaded ${rows.length} user row(s).`;

  if(list){
    list.innerHTML = rows.map(row => `
      <li>
        <div>
          <strong>${row.display_name || row.email_norm || row.id || "-"}</strong>
          • ${row.email_norm || "-"}
          • ${getRiskLabel(row)}
        </div>
        <div>
          user_id=${row.id || "-"}
          • locked_until=${row.locked_until || "-"}
          • disabled_at=${row.disabled_at || "-"}
          • fail_count=${row.pw_fail_count || 0}
        </div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" data-action="unlock-user" data-user-id="${row.id || ""}">Unlock</button>
          <button type="button" data-action="revoke-user-sessions" data-user-id="${row.id || ""}">Revoke Sessions</button>
          <button type="button" data-action="disable-user" data-user-id="${row.id || ""}">Disable</button>
          <button type="button" data-action="enable-user" data-user-id="${row.id || ""}">Enable</button>
          <button type="button" data-action="reset-fail-counter" data-user-id="${row.id || ""}">Reset Fail</button>
          <button type="button" data-action="require-password-reset" data-user-id="${row.id || ""}">Require Password Reset</button>
          <button type="button" data-action="clear-password-reset" data-user-id="${row.id || ""}">Clear Password Reset</button>
          <button type="button" data-action="require-mfa-enroll" data-user-id="${row.id || ""}">Require MFA Enroll</button>
          <button type="button" data-action="clear-mfa-enroll" data-user-id="${row.id || ""}">Clear MFA Enroll</button>
        </div>
      </li>
    `).join("");
  }

  bindRowActions();

  renderAdminPaging("usersSecurityPaging", paging, async () => {
    offset = Math.max(0, Number(paging.prev_offset || 0));
    await load();
  }, async () => {
    offset = Number(paging.next_offset || 0);
    await load();
  });
}

export default async function(){
  getEl("adminUsersSecurityFilterForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    offset = 0;
    await load();
  });

  await load();
}
