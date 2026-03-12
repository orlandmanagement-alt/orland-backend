export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function findUsers(q){
    return await Orland.api("/api/users/options?q=" + encodeURIComponent(q || ""));
  }

  async function forceReset(payload){
    return await Orland.api("/api/admin/users/force-password-reset", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"Forced Password Reset",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-6xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">Forced Password Reset Admin</div>
            <div class="text-sm text-slate-500 mt-1">Paksa reset password user, dengan temporary password dan revoke sessions.</div>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <input id="qUser" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari user id / email / nama">
              <button id="btnSearch" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Search</button>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Users</div>
              <div id="userList" class="mt-4 space-y-3"></div>
            </div>

            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Force Reset Form</div>
              <div id="editorBox" class="mt-4 text-sm text-slate-500">Pilih user terlebih dahulu.</div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let SELECTED_USER = null;

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
          <button class="userRow w-full text-left rounded-2xl border border-slate-200 dark:border-darkBorder p-4 hover:bg-slate-50 dark:hover:bg-white/5" data-id="${esc(u.id)}" data-name="${esc(u.display_name || "")}" data-email="${esc(u.email_norm || "")}">
            <div class="font-black text-sm">${esc(u.display_name || u.email_norm || u.id)}</div>
            <div class="mt-1 text-xs text-slate-500">${esc(u.email_norm || "-")}</div>
            <div class="mt-1 text-[11px] text-slate-400">${esc(u.id)}</div>
          </button>
        `).join("");

        q("userList").querySelectorAll(".userRow").forEach(btn => {
          btn.onclick = ()=>{
            SELECTED_USER = {
              id: String(btn.getAttribute("data-id") || ""),
              display_name: String(btn.getAttribute("data-name") || ""),
              email_norm: String(btn.getAttribute("data-email") || "")
            };
            renderEditor();
          };
        });
      }

      function renderEditor(){
        if(!SELECTED_USER){
          q("editorBox").innerHTML = `<div class="text-sm text-slate-500">Pilih user terlebih dahulu.</div>`;
          return;
        }

        q("editorBox").innerHTML = `
          <div class="space-y-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="font-black text-sm">${esc(SELECTED_USER.display_name || SELECTED_USER.email_norm || SELECTED_USER.id)}</div>
              <div class="mt-1 text-xs text-slate-500">${esc(SELECTED_USER.email_norm || "-")}</div>
              <div class="mt-1 text-[11px] text-slate-400">${esc(SELECTED_USER.id)}</div>
            </div>

            <form id="forceForm" class="space-y-4">
              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                <input name="set_temporary_password" type="checkbox" checked>
                <span class="text-sm font-semibold">Set temporary password</span>
              </label>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Temporary Password</label>
                <input name="temporary_password" type="text" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="TempStrong#12345">
                <div class="text-xs text-slate-500 mt-2">Minimal 10 karakter jika set temporary password aktif.</div>
              </div>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                <input name="force_revoke_sessions" type="checkbox" checked>
                <span class="text-sm font-semibold">Force revoke all sessions</span>
              </label>

              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Apply Force Reset</button>
              </div>
            </form>
          </div>
        `;

        q("forceForm").onsubmit = async (ev)=>{
          ev.preventDefault();
          const form = q("forceForm");
          const payload = {
            user_id: SELECTED_USER.id,
            set_temporary_password: !!form.set_temporary_password.checked,
            temporary_password: String(form.temporary_password.value || ""),
            force_revoke_sessions: !!form.force_revoke_sessions.checked
          };

          if(payload.set_temporary_password && payload.temporary_password.length < 10){
            setMsg("error", "Temporary password minimal 10 karakter.");
            return;
          }

          setMsg("muted", "Applying force password reset...");
          const r = await forceReset(payload);

          if(r.status !== "ok"){
            setMsg("error", "Failed: " + (r.data?.message || r.status));
            return;
          }

          setMsg("success", "Force password reset applied.");
        };
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

      q("btnSearch").onclick = searchUsers;
      q("qUser").addEventListener("keydown", (e)=>{ if(e.key === "Enter") searchUsers(); });

      await searchUsers();
    }
  };
}
