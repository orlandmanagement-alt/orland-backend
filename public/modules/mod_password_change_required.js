export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadStatus(){
    return await Orland.api("/api/password/change-required");
  }

  async function submitChange(payload){
    return await Orland.api("/api/password/change-required", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title: "Password Change Required",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-4xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">Password Change + Hash Rotation</div>
            <div class="text-sm text-slate-500 mt-1">Ganti password, rotasi hash, dan revoke session lain bila perlu.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div id="statusBox" class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 text-sm text-slate-500">Loading...</div>

            <form id="pwForm" class="mt-5 space-y-4">
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
                <button type="button" id="btnReload" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Reload</button>
              </div>
            </form>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

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
        const must = data.must_change_password === true;
        q("statusBox").innerHTML = `
          <div class="space-y-1">
            <div><span class="font-black">User:</span> ${esc(user.display_name || user.email_norm || user.id || "-")}</div>
            <div><span class="font-black">Email:</span> ${esc(user.email_norm || "-")}</div>
            <div class="mt-3">
              ${must
                ? `<span class="px-3 py-2 rounded-2xl bg-amber-100 text-amber-700 text-xs font-black">Password change required</span>`
                : `<span class="px-3 py-2 rounded-2xl bg-emerald-100 text-emerald-700 text-xs font-black">Password change optional</span>`
              }
            </div>
          </div>
        `;
      }

      async function load(){
        setMsg("muted", "Loading password status...");
        const r = await loadStatus();
        if(r.status !== "ok"){
          q("statusBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }
        renderStatus(r.data || {});
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
        const r = await submitChange({
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
        setMsg("success", "Password changed successfully.");
        await load();
      };

      q("btnReload").onclick = load;

      await load();
    }
  };
}
