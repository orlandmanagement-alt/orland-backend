export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
  const fmt = (v)=>!v ? "-" : new Date(Number(v) * 1000).toLocaleString("id-ID");

  async function loadMe(){
    return await Orland.api("/api/me");
  }
  async function loadPasswordStatus(){
    return await Orland.api("/api/password/change-required");
  }
  async function changePassword(payload){
    return await Orland.api("/api/password/change-required", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }
  async function loadSessions(){
    return await Orland.api("/api/sessions/me");
  }
  async function revokeOne(sid){
    return await Orland.api("/api/sessions/revoke", {
      method:"POST",
      body: JSON.stringify({ sid })
    });
  }
  async function revokeOthers(){
    return await Orland.api("/api/sessions/revoke-all", {
      method:"POST",
      body: JSON.stringify({ include_current:false })
    });
  }
  async function loadMfaStatus(){
    return await Orland.api("/api/mfa/status");
  }
  async function startEnroll(){
    return await Orland.api("/api/mfa/enroll");
  }
  async function verifyEnroll(payload){
    return await Orland.api("/api/mfa/verify-enroll", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }
  async function disableMfa(){
    return await Orland.api("/api/mfa/disable", {
      method:"POST",
      body: JSON.stringify({ confirm:true })
    });
  }
  async function loadRecoveryStatus(){
    return await Orland.api("/api/mfa/recovery-codes");
  }
  async function generateRecoveryCodes(){
    return await Orland.api("/api/mfa/recovery-codes", {
      method:"POST",
      body: JSON.stringify({ action:"generate" })
    });
  }
  async function exportRecoveryCodes(){
    return await Orland.api("/api/mfa/recovery-codes-export", {
      method:"POST",
      body: JSON.stringify({ regenerate:true })
    });
  }

  function downloadText(filename, content){
    const blob = new Blob([content], { type:"text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return {
    title:"Security Center",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">Security Center</div>
            <div class="text-sm text-slate-500 mt-1">Ringkasan akun, password, session, MFA enrollment, dan recovery codes milik sendiri.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 ui-gap-grid">
            <div class="space-y-4">
              <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="text-xl font-extrabold">Account Summary</div>
                <div id="profileBox" class="mt-4 text-sm text-slate-500">Loading...</div>
              </div>

              <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="text-xl font-extrabold">Password Change</div>
                <div id="passwordStatusBox" class="mt-4 text-sm text-slate-500">Loading...</div>

                <form id="pwForm" class="mt-4 space-y-4">
                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">Current Password</label>
                    <input name="current_password" type="password" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  </div>

                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">New Password</label>
                    <input name="new_password" type="password" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    <div class="text-xs text-slate-500 mt-2">Minimal 10 karakter.</div>
                  </div>

                  <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                    <input name="revoke_others" type="checkbox" checked>
                    <span class="text-sm font-semibold">Revoke other sessions after password change</span>
                  </label>

                  <div class="flex gap-2 flex-wrap">
                    <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Change Password</button>
                    <button type="button" id="btnReloadPassword" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Reload</button>
                  </div>
                </form>
              </div>

              <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div class="text-xl font-extrabold">MFA</div>
                    <div class="text-xs text-slate-500 mt-1">Enrollment, verification status, dan disable MFA.</div>
                  </div>
                  <div class="flex gap-2 flex-wrap">
                    <button id="btnReloadMfa" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Reload</button>
                    <button id="btnStartEnroll" class="px-3 py-2 rounded-xl bg-primary text-white text-xs font-black">Start Enrollment</button>
                    <button id="btnDisableMfa" class="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-black">Disable MFA</button>
                  </div>
                </div>

                <div id="mfaStatusBox" class="mt-4 text-sm text-slate-500">Loading...</div>
                <div id="mfaEnrollBox" class="mt-4"></div>
              </div>
            </div>

            <div class="space-y-4">
              <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div class="text-xl font-extrabold">My Sessions</div>
                    <div class="text-xs text-slate-500 mt-1">Kelola session milik sendiri.</div>
                  </div>
                  <div class="flex gap-2 flex-wrap">
                    <button id="btnReloadSessions" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Reload</button>
                    <button id="btnRevokeOthers" class="px-3 py-2 rounded-xl border border-amber-200 text-amber-700 text-xs font-black">Logout Other Sessions</button>
                  </div>
                </div>
                <div id="sessionBox" class="mt-4 space-y-3"></div>
              </div>

              <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div class="text-xl font-extrabold">Recovery Codes</div>
                    <div class="text-xs text-slate-500 mt-1">Generate ulang, lihat jumlah, dan download printable text.</div>
                  </div>
                  <div class="flex gap-2 flex-wrap">
                    <button id="btnReloadRecovery" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Reload</button>
                    <button id="btnGenerateRecovery" class="px-3 py-2 rounded-xl bg-primary text-white text-xs font-black">Generate</button>
                    <button id="btnExportRecovery" class="px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-black">Download / Print</button>
                  </div>
                </div>

                <div id="recoveryStatusBox" class="mt-4 text-sm text-slate-500">Loading...</div>
                <div id="recoveryBox" class="mt-4"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let LAST_SECRET = "";

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else if(kind === "warning") q("msg").classList.add("text-amber-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function renderProfile(){
        const r = await loadMe();
        if(r.status !== "ok"){
          q("profileBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          return;
        }

        const d = r.data || {};
        q("profileBox").innerHTML = `
          <div class="space-y-2 text-sm">
            <div><span class="font-black">Name:</span> ${esc(d.display_name || "-")}</div>
            <div><span class="font-black">Email:</span> ${esc(d.email_norm || "-")}</div>
            <div><span class="font-black">Status:</span> ${esc(d.status || "-")}</div>
            <div><span class="font-black">Roles:</span> ${(Array.isArray(d.roles) ? d.roles : []).map(x => `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black mr-1">${esc(x)}</span>`).join("") || "-"}</div>
            <div><span class="font-black">Session Version:</span> ${esc(d.session_version || 1)}</div>
            <div><span class="font-black">MFA Enabled:</span> ${Number(d.mfa_enabled || 0) === 1 ? "yes" : "no"}</div>
            <div><span class="font-black">MFA Type:</span> ${esc(d.mfa_type || "-")}</div>
          </div>
        `;
      }

      async function renderPasswordStatus(){
        const r = await loadPasswordStatus();
        if(r.status !== "ok"){
          q("passwordStatusBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          return;
        }

        const d = r.data || {};
        q("passwordStatusBox").innerHTML = `
          <div class="flex gap-2 flex-wrap">
            ${d.must_change_password
              ? `<span class="px-3 py-2 rounded-2xl bg-amber-100 text-amber-700 text-xs font-black">Password change required</span>`
              : `<span class="px-3 py-2 rounded-2xl bg-emerald-100 text-emerald-700 text-xs font-black">Password status normal</span>`
            }
          </div>
        `;
      }

      async function renderSessions(){
        const r = await loadSessions();
        if(r.status !== "ok"){
          q("sessionBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        if(!items.length){
          q("sessionBox").innerHTML = `<div class="text-sm text-slate-500">No sessions.</div>`;
          return;
        }

        q("sessionBox").innerHTML = items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <div class="font-black text-sm">${x.current_session ? "Current Session" : "Session"}</div>
                  ${x.current_session ? `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">current</span>` : ``}
                  ${x.revoked_at ? `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">revoked</span>` : `<span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">active</span>`}
                </div>
                <div class="mt-2 text-xs text-slate-500 space-y-1">
                  <div>sid: ${esc(x.id)}</div>
                  <div>created: ${esc(fmt(x.created_at))}</div>
                  <div>expires: ${esc(fmt(x.expires_at))}</div>
                  <div>last seen: ${esc(fmt(x.last_seen_at))}</div>
                  <div>session version: ${esc(x.session_version)}</div>
                </div>
              </div>
              <div class="shrink-0">
                ${!x.revoked_at ? `<button class="btnRevokeOne px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-black" data-sid="${esc(x.id)}" ${x.current_session ? "disabled" : ""}>Logout</button>` : ``}
              </div>
            </div>
          </div>
        `).join("");

        q("sessionBox").querySelectorAll(".btnRevokeOne").forEach(btn => {
          btn.onclick = async ()=>{
            const sid = String(btn.getAttribute("data-sid") || "");
            setMsg("muted", "Revoking session...");
            const rr = await revokeOne(sid);
            if(rr.status !== "ok"){
              setMsg("error", "Revoke failed: " + (rr.data?.message || rr.status));
              return;
            }
            setMsg("success", "Session revoked.");
            await renderSessions();
          };
        });
      }

      async function renderMfaStatus(){
        const r = await loadMfaStatus();
        if(r.status !== "ok"){
          q("mfaStatusBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          return;
        }

        const d = r.data || {};
        const policy = d.policy || {};
        q("mfaStatusBox").innerHTML = `
          <div class="space-y-2 text-sm">
            <div><span class="font-black">MFA Enabled:</span> ${d.user?.mfa_enabled ? "yes" : "no"}</div>
            <div><span class="font-black">MFA Type:</span> ${esc(d.user?.mfa_type || "-")}</div>
            <div><span class="font-black">Policy Enabled:</span> ${Number(policy.enabled || 0) === 1 ? "yes" : "no"}</div>
            <div><span class="font-black">User Opt-In:</span> ${Number(policy.allow_user_opt_in || 0) === 1 ? "yes" : "no"}</div>
            <div><span class="font-black">Required By Role:</span> ${d.mfa_required_by_role ? "yes" : "no"}</div>
          </div>
        `;
      }

      function renderEnrollBox(data){
        LAST_SECRET = String(data.secret || "");
        q("mfaEnrollBox").innerHTML = `
          <div class="space-y-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-sm font-bold text-slate-500">SECRET</div>
              <div class="mt-2 font-mono text-sm break-all">${esc(data.secret || "-")}</div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-sm font-bold text-slate-500">OTPAUTH URL</div>
              <div class="mt-2 text-xs break-all text-slate-600 dark:text-slate-300">${esc(data.provision_url || "-")}</div>
            </div>

            <form id="verifyEnrollForm" class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Verification Code</label>
                <input name="code" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="6-digit code">
              </div>
              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Verify Enrollment</button>
              </div>
            </form>
          </div>
        `;

        q("verifyEnrollForm").onsubmit = async (ev)=>{
          ev.preventDefault();
          const code = String(q("verifyEnrollForm").code.value || "").trim();
          if(!code){
            setMsg("error", "Verification code wajib diisi.");
            return;
          }
          setMsg("muted", "Verifying MFA enrollment...");
          const r = await verifyEnroll({ code });
          if(r.status !== "ok"){
            setMsg("error", "Verify failed: " + (r.data?.message || r.status));
            return;
          }
          q("mfaEnrollBox").innerHTML = `<div class="text-sm text-emerald-600 font-semibold">MFA enrollment completed.</div>`;
          setMsg("success", "MFA enrolled.");
          await renderMfaStatus();
          await renderRecoveryStatus();
        };
      }

      async function renderRecoveryStatus(){
        const r = await loadRecoveryStatus();
        if(r.status !== "ok"){
          q("recoveryStatusBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          return;
        }

        q("recoveryStatusBox").innerHTML = `
          <div class="space-y-2 text-sm">
            <div><span class="font-black">MFA Enabled:</span> ${r.data?.mfa_enabled ? "yes" : "no"}</div>
            <div><span class="font-black">Recovery Codes Count:</span> ${esc(r.data?.recovery_codes_count || 0)}</div>
          </div>
        `;
      }

      async function renderAll(){
        setMsg("muted", "Loading security center...");
        await Promise.all([
          renderProfile(),
          renderPasswordStatus(),
          renderSessions(),
          renderMfaStatus(),
          renderRecoveryStatus()
        ]);
        setMsg("success", "Loaded.");
      }

      q("pwForm").onsubmit = async (ev)=>{
        ev.preventDefault();
        const form = q("pwForm");
        const current_password = String(form.current_password.value || "");
        const new_password = String(form.new_password.value || "");
        const revoke_others = !!form.revoke_others.checked;

        if(!current_password || new_password.length < 10){
          setMsg("error", "Current password wajib dan new password minimal 10 karakter.");
          return;
        }

        setMsg("muted", "Changing password...");
        const r = await changePassword({
          current_password,
          new_password,
          revoke_others
        });

        if(r.status !== "ok"){
          setMsg("error", "Change failed: " + (r.data?.message || r.status));
          return;
        }

        form.reset();
        form.revoke_others.checked = true;
        setMsg("success", "Password changed.");
        await renderPasswordStatus();
        await renderSessions();
      };

      q("btnReloadPassword").onclick = renderPasswordStatus;
      q("btnReloadSessions").onclick = renderSessions;
      q("btnReloadMfa").onclick = async ()=>{
        await renderMfaStatus();
        await renderRecoveryStatus();
      };
      q("btnReloadRecovery").onclick = renderRecoveryStatus;

      q("btnRevokeOthers").onclick = async ()=>{
        setMsg("muted", "Revoking other sessions...");
        const r = await revokeOthers();
        if(r.status !== "ok"){
          setMsg("error", "Failed: " + (r.data?.message || r.status));
          return;
        }
        setMsg("success", "Other sessions revoked.");
        await renderSessions();
      };

      q("btnStartEnroll").onclick = async ()=>{
        setMsg("muted", "Starting MFA enrollment...");
        const r = await startEnroll();
        if(r.status !== "ok"){
          setMsg("error", "Enroll failed: " + (r.data?.message || r.status));
          return;
        }
        renderEnrollBox(r.data || {});
        setMsg("success", "Enrollment secret created.");
      };

      q("btnDisableMfa").onclick = async ()=>{
        setMsg("muted", "Disabling MFA...");
        const r = await disableMfa();
        if(r.status !== "ok"){
          setMsg("error", "Disable failed: " + (r.data?.message || r.status));
          return;
        }
        q("mfaEnrollBox").innerHTML = `<div class="text-sm text-slate-500">MFA disabled.</div>`;
        setMsg("success", "MFA disabled.");
        await renderMfaStatus();
        await renderRecoveryStatus();
      };

      q("btnGenerateRecovery").onclick = async ()=>{
        setMsg("muted", "Generating recovery codes...");
        const r = await generateRecoveryCodes();
        if(r.status !== "ok"){
          setMsg("error", "Generate failed: " + (r.data?.message || r.status));
          return;
        }
        const codes = Array.isArray(r.data?.codes) ? r.data.codes : [];
        q("recoveryBox").innerHTML = `
          <div class="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
            <div class="text-sm font-black text-amber-700">Simpan kode ini sekarang. Kode plaintext tidak akan ditampilkan lagi.</div>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              ${codes.map(c => `<div class="rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark px-3 py-3 font-mono text-sm">${esc(c)}</div>`).join("")}
            </div>
          </div>
        `;
        setMsg("success", "Recovery codes generated.");
        await renderRecoveryStatus();
      };

      q("btnExportRecovery").onclick = async ()=>{
        setMsg("muted", "Generating recovery export...");
        const r = await exportRecoveryCodes();
        if(r.status !== "ok"){
          setMsg("error", "Export failed: " + (r.data?.message || r.status));
          return;
        }
        const txt = String(r.data?.printable_text || "");
        downloadText(String(r.data?.filename || "recovery-codes.txt"), txt);
        q("recoveryBox").innerHTML = `
          <pre class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 text-[11px] overflow-auto">${esc(txt)}</pre>
        `;
        setMsg("success", "Recovery codes exported and downloaded.");
        await renderRecoveryStatus();
      };

      await renderAll();
    }
  };
}
