export default function(Orland){
  async function loadUsers(){
    return await Orland.api("/api/users/lifecycle");
  }
  async function applyAction(payload){
    return await Orland.api("/api/users/lifecycle", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"User Lifecycle",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">User Lifecycle</div>
            <div class="text-sm text-slate-500 mt-1">Kelola invited, active, suspended, locked, archived, dan force password reset.</div>
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

            <div class="mt-4 flex gap-2 flex-wrap">
              <button class="btnStatus px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-id="${u.id}" data-status="active">Active</button>
              <button class="btnStatus px-3 py-2 rounded-xl border border-amber-200 text-amber-700 text-xs font-black" data-id="${u.id}" data-status="suspended">Suspend</button>
              <button class="btnStatus px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-black" data-id="${u.id}" data-status="archived">Archive</button>
              <button class="btnReset px-3 py-2 rounded-xl border border-violet-200 text-violet-700 text-xs font-black" data-id="${u.id}">Force Password Reset</button>
              <button class="btnClearLock px-3 py-2 rounded-xl border border-sky-200 text-sky-700 text-xs font-black" data-id="${u.id}">Clear Lock</button>
            </div>
          </div>
        `).join("");

        q("box").querySelectorAll(".btnStatus").forEach(btn => {
          btn.onclick = async ()=>{
            setMsg("muted", "Updating status...");
            const rr = await applyAction({
              action: "set_status",
              user_id: btn.getAttribute("data-id"),
              status: btn.getAttribute("data-status")
            });
            if(rr.status !== "ok"){
              setMsg("error", "Update failed.");
              return;
            }
            setMsg("success", "Status updated.");
            await render();
          };
        });

        q("box").querySelectorAll(".btnReset").forEach(btn => {
          btn.onclick = async ()=>{
            setMsg("muted", "Forcing password reset...");
            const rr = await applyAction({
              action: "force_password_reset",
              user_id: btn.getAttribute("data-id")
            });
            if(rr.status !== "ok"){
              setMsg("error", "Action failed.");
              return;
            }
            setMsg("success", "Password reset forced.");
            await render();
          };
        });

        q("box").querySelectorAll(".btnClearLock").forEach(btn => {
          btn.onclick = async ()=>{
            setMsg("muted", "Clearing lock...");
            const rr = await applyAction({
              action: "clear_lock",
              user_id: btn.getAttribute("data-id")
            });
            if(rr.status !== "ok"){
              setMsg("error", "Action failed.");
              return;
            }
            setMsg("success", "Lock cleared.");
            await render();
          };
        });

        setMsg("success", "Loaded.");
      }

      await render();
    }
  };
}
