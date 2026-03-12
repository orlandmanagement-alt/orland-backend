import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
  const fmt = (v)=>!v ? "-" : new Date(Number(v) * 1000).toLocaleString("id-ID");

  async function findUsers(q){
    return await Orland.api("/api/users/options?q=" + encodeURIComponent(q || ""));
  }

  async function inspectUser(userId){
    return await Orland.api("/api/admin/mfa/user-inspector?user_id=" + encodeURIComponent(userId));
  }

  async function disableUserMfa(payload){
    return await Orland.api("/api/admin/mfa/disable-user", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"Admin User MFA Inspector",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: ["super_admin", "admin", "security_admin", "audit_admin"],
        title: "Admin User MFA Inspector",
        desc: "Hanya role admin/security/audit yang boleh membuka inspector MFA user."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-7xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">Admin User MFA Inspector</div>
            <div class="text-sm text-slate-500 mt-1">Inspect MFA state user, role requirement, recovery codes, dan disable MFA bila dibutuhkan.</div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <input id="qUser" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari user id / email / nama">
              <button id="btnSearch" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Search</button>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4 ui-gap-grid">
            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Users</div>
              <div id="userList" class="mt-4 space-y-3"></div>
            </div>

            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Inspector</div>
                <div class="flex gap-2 flex-wrap">
                  <button id="btnReloadInspector" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" disabled>Reload</button>
                  <button id="btnDisableMfa" class="px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-black" disabled>Disable MFA</button>
                </div>
              </div>
              <div id="inspectorBox" class="mt-4 text-sm text-slate-500">Pilih user terlebih dahulu.</div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let SELECTED_USER_ID = "";

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else if(kind === "warning") q("msg").classList.add("text-amber-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderUsers(items){
        if(!items.length){
          q("userList").innerHTML = `<div class="text-sm text-slate-500">No users found.</div>`;
          return;
        }

        q("userList").innerHTML = items.map(u => `
          <button class="userRow w-full text-left rounded-2xl border border-slate-200 dark:border-darkBorder p-4 hover:bg-slate-50 dark:hover:bg-white/5" data-id="${esc(u.id)}">
            <div class="font-black text-sm">${esc(u.display_name || u.email_norm || u.id)}</div>
            <div class="mt-1 text-xs text-slate-500">${esc(u.email_norm || "-")}</div>
            <div class="mt-1 text-[11px] text-slate-400">${esc(u.id)}</div>
          </button>
        `).join("");

        q("userList").querySelectorAll(".userRow").forEach(btn => {
          btn.onclick = async ()=>{
            SELECTED_USER_ID = String(btn.getAttribute("data-id") || "");
            await loadInspector();
          };
        });
      }

      function renderInspector(data){
        const user = data.user || {};
        const roles = Array.isArray(data.roles) ? data.roles : [];
        const policy = data.policy || {};

        q("btnReloadInspector").disabled = !user.id;
        q("btnDisableMfa").disabled = !user.id;

        q("inspectorBox").innerHTML = `
          <div class="space-y-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-lg font-extrabold">${esc(user.display_name || user.email_norm || user.id || "-")}</div>
              <div class="mt-1 text-sm text-slate-500">${esc(user.email_norm || "-")}</div>
              <div class="mt-1 text-[11px] text-slate-400">${esc(user.id || "-")}</div>

              <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span class="font-black">Status:</span> ${esc(user.status || "-")}</div>
                <div><span class="font-black">MFA Enabled:</span> ${user.mfa_enabled ? "yes" : "no"}</div>
                <div><span class="font-black">MFA Type:</span> ${esc(user.mfa_type || "-")}</div>
                <div><span class="font-black">Has Secret:</span> ${user.has_mfa_secret ? "yes" : "no"}</div>
                <div><span class="font-black">Recovery Codes:</span> ${esc(user.recovery_codes_count || 0)}</div>
                <div><span class="font-black">Session Version:</span> ${esc(user.session_version || 1)}</div>
                <div><span class="font-black">Updated:</span> ${esc(fmt(user.updated_at))}</div>
                <div><span class="font-black">Required By Role:</span> ${data.required_by_role ? "yes" : "no"}</div>
              </div>

              <div class="mt-4 flex gap-2 flex-wrap">
                ${roles.map(x => `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x)}</span>`).join("") || `<span class="text-xs text-slate-400">no roles</span>`}
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-sm font-black text-slate-500 mb-3">MFA Policy View</div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span class="font-black">Policy Enabled:</span> ${policy.enabled ? "yes" : "no"}</div>
                <div><span class="font-black">Allow User Opt-In:</span> ${policy.allow_user_opt_in ? "yes" : "no"}</div>
                <div><span class="font-black">Require Super Admin:</span> ${policy.require_for_super_admin ? "yes" : "no"}</div>
                <div><span class="font-black">Require Security Admin:</span> ${policy.require_for_security_admin ? "yes" : "no"}</div>
                <div><span class="font-black">Require Admin:</span> ${policy.require_for_admin ? "yes" : "no"}</div>
              </div>
            </div>
          </div>
        `;
      }

      async function searchUsers(){
        const r = await findUsers(q("qUser").value.trim());
        if(r.status !== "ok"){
          q("userList").innerHTML = `<div class="text-sm text-red-500">Search failed.</div>`;
          return;
        }
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        renderUsers(items);
      }

      async function loadInspector(){
        if(!SELECTED_USER_ID) return;
        setMsg("muted", "Loading MFA inspector...");
        const r = await inspectUser(SELECTED_USER_ID);
        if(r.status !== "ok"){
          q("inspectorBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }
        renderInspector(r.data || {});
        setMsg("success", "Loaded.");
      }

      q("btnSearch").onclick = searchUsers;
      q("qUser").addEventListener("keydown", (e)=>{ if(e.key === "Enter") searchUsers(); });
      q("btnReloadInspector").onclick = loadInspector;

      q("btnDisableMfa").onclick = async ()=>{
        if(!SELECTED_USER_ID) return;

        setMsg("muted", "Disabling user MFA...");
        const r = await disableUserMfa({
          user_id: SELECTED_USER_ID,
          clear_recovery_codes: true,
          rotate_session_version: true,
          revoke_sessions: true
        });

        if(r.status !== "ok"){
          setMsg("error", "Disable failed: " + (r.data?.message || r.status));
          return;
        }

        setMsg("success", "User MFA disabled.");
        await loadInspector();
      };

      await searchUsers();
    }
  };
}
