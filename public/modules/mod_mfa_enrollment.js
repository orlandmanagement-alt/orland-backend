import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadStatus(){
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

  return {
    title:"MFA Enrollment",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: [],
        title: "MFA Enrollment",
        desc: "Session tidak valid atau akses tidak tersedia."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-5xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">MFA OTP Enrollment</div>
            <div class="text-sm text-slate-500 mt-1">Mulai enrollment MFA aplikasi authenticator dan verifikasi kode pertama.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4 ui-gap-grid">
            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Current Status</div>
              <div id="statusBox" class="mt-4 text-sm text-slate-500">Loading...</div>
              <div class="mt-4 flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Reload</button>
                <button id="btnStartEnroll" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Start Enrollment</button>
                <button id="btnDisable" class="px-4 py-2.5 rounded-2xl border border-rose-200 text-rose-700 font-black text-sm">Disable MFA</button>
              </div>
            </div>

            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Enrollment</div>
              <div id="enrollBox" class="mt-4 text-sm text-slate-500">Klik Start Enrollment untuk membuat secret MFA.</div>
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

      function renderStatus(data){
        const user = data.user || {};
        const policy = data.policy || {};
        q("statusBox").innerHTML = `
          <div class="space-y-2 text-sm">
            <div><span class="font-black">User:</span> ${esc(user.display_name || user.email_norm || user.id || "-")}</div>
            <div><span class="font-black">MFA Enabled:</span> ${user.mfa_enabled ? "yes" : "no"}</div>
            <div><span class="font-black">MFA Type:</span> ${esc(user.mfa_type || "-")}</div>
            <div><span class="font-black">Policy Enabled:</span> ${Number(policy.enabled || 0) === 1 ? "yes" : "no"}</div>
            <div><span class="font-black">User Opt-In:</span> ${Number(policy.allow_user_opt_in || 0) === 1 ? "yes" : "no"}</div>
            <div><span class="font-black">Required By Role:</span> ${data.mfa_required_by_role ? "yes" : "no"}</div>
          </div>
        `;
      }

      function renderEnrollment(data){
        LAST_SECRET = String(data.secret || "");
        q("enrollBox").innerHTML = `
          <div class="space-y-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-sm font-bold text-slate-500">SECRET</div>
              <div class="mt-2 font-mono text-sm break-all">${esc(data.secret || "-")}</div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-sm font-bold text-slate-500">OTPAUTH URL</div>
              <div class="mt-2 text-xs break-all text-slate-600 dark:text-slate-300">${esc(data.provision_url || "-")}</div>
            </div>

            <div class="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-700">
              Gunakan secret ini di aplikasi authenticator. Untuk mode saat ini, kode verifikasi default adalah <span class="font-black">123456</span> kecuali ENV <span class="font-black">MFA_ENROLL_TEST_CODE</span> diubah.
            </div>

            <form id="verifyForm" class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Verification Code</label>
                <input name="code" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="123456">
              </div>
              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Verify Enrollment</button>
              </div>
            </form>
          </div>
        `;

        q("verifyForm").onsubmit = async (ev)=>{
          ev.preventDefault();
          const code = String(q("verifyForm").code.value || "").trim();
          if(!LAST_SECRET || !code){
            setMsg("error", "Secret dan code wajib ada.");
            return;
          }

          setMsg("muted", "Verifying enrollment...");
          const r = await verifyEnroll({
            secret: LAST_SECRET,
            code
          });

          if(r.status !== "ok"){
            setMsg("error", "Verify failed: " + (r.data?.message || r.status));
            return;
          }

          setMsg("success", "MFA enrolled successfully.");
          q("enrollBox").innerHTML = `<div class="text-sm text-emerald-600 font-semibold">Enrollment completed.</div>`;
          await loadAll();
        };
      }

      async function loadAll(){
        setMsg("muted", "Loading MFA status...");
        const r = await loadStatus();
        if(r.status !== "ok"){
          q("statusBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }
        renderStatus(r.data || {});
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = loadAll;

      q("btnStartEnroll").onclick = async ()=>{
        setMsg("muted", "Starting enrollment...");
        const r = await startEnroll();
        if(r.status !== "ok"){
          setMsg("error", "Enroll start failed: " + (r.data?.message || r.status));
          return;
        }
        renderEnrollment(r.data || {});
        setMsg("success", "Enrollment secret created.");
      };

      q("btnDisable").onclick = async ()=>{
        setMsg("muted", "Disabling MFA...");
        const r = await disableMfa();
        if(r.status !== "ok"){
          setMsg("error", "Disable failed: " + (r.data?.message || r.status));
          return;
        }
        q("enrollBox").innerHTML = `<div class="text-sm text-slate-500">MFA disabled.</div>`;
        setMsg("success", "MFA disabled.");
        await loadAll();
      };

      await loadAll();
    }
  };
}
