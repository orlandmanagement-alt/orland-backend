export default function(Orland){
  async function loadUsers(){
    return await Orland.api("/api/users/offboarding");
  }
  async function applyAction(payload){
    return await Orland.api("/api/users/offboarding", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"User Offboarding",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">User Offboarding</div>
            <div class="text-sm text-slate-500 mt-1">Suspend/archive user, revoke sessions, dan opsional hapus role assignment.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>
          <div id="box" class="space-y-3"></div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function render(){
        setMsg("muted", "Loading users...");
        const r = await loadUsers();
        if(r.status !== "ok"){
          setMsg("error", "Load failed.");
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        q("box").innerHTML = items.map(u => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="font-black text-sm">${u.display_name || u.email_norm || u.id}</div>
                <div class="text-xs text-slate-500 mt-1">${u.email_norm || "-"}</div>
                <div class="text-[11px] text-slate-400 mt-1">${u.id}</div>
              </div>
              <div class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${u.status || "-"}</div>
            </div>

            <div class="mt-3 flex gap-2 flex-wrap">
              ${(Array.isArray(u.roles) ? u.roles : []).map(r => `
                <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${r.role_name}</span>
              `).join("") || `<span class="text-xs text-slate-400">no roles</span>`}
            </div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
              <input class="offReason px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" data-id="${u.id}" placeholder="Reason, mis. resign / contract ended">
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="offRevokeRoles" data-id="${u.id}"><span>Remove roles</span></label>
              <label class="flex items-center gap-2 text-sm"><input type="checkbox" class="offArchive" data-id="${u.id}"><span>Archive</span></label>
            </div>

            <div class="mt-4 flex gap-2 flex-wrap">
              <button class="btnOffboard px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-black" data-id="${u.id}">Run Offboarding</button>
            </div>
          </div>
        `).join("");

        q("box").querySelectorAll(".btnOffboard").forEach(btn => {
          btn.onclick = async ()=>{
            const id = String(btn.getAttribute("data-id") || "");
            const reason = host.querySelector(`.offReason[data-id="${id}"]`)?.value || "";
            const revoke_roles = !!host.querySelector(`.offRevokeRoles[data-id="${id}"]`)?.checked;
            const force_archive = !!host.querySelector(`.offArchive[data-id="${id}"]`)?.checked;

            setMsg("muted", "Running offboarding...");
            const rr = await applyAction({
              user_id: id,
              reason,
              revoke_roles,
              force_archive
            });

            if(rr.status !== "ok"){
              setMsg("error", "Offboarding failed.");
              return;
            }

            setMsg("success", "Offboarding completed.");
            await render();
          };
        });

        setMsg("success", "Loaded.");
      }

      await render();
    }
  };
}
