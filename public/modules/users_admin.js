(function(){
  const Orland = window.Orland;

  Orland.registerModule("users_admin", {
    async mount(host, ctx){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-xl font-bold text-slate-900 dark:text-white">Admin Users</h2>
              <div class="text-xs text-slate-500">CRUD users (super_admin/admin/staff) via /api/users/admin</div>
            </div>
            <div class="flex gap-2">
              <input id="q" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs w-56" placeholder="Search...">
              <button id="btnReload" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Reload</button>
              <button id="btnCreate" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold">Create</button>
            </div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs whitespace-nowrap">
                <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                  <tr>
                    <th class="px-4 py-3 font-semibold">User</th>
                    <th class="px-4 py-3 font-semibold">Roles</th>
                    <th class="px-4 py-3 font-semibold">Status</th>
                    <th class="px-4 py-3 font-semibold">Last Login</th>
                    <th class="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody id="rows" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
              </table>
            </div>
          </div>

          <details class="text-[11px] text-slate-500">
            <summary>Debug</summary>
            <pre id="dbg" class="whitespace-pre-wrap"></pre>
          </details>
        </div>
      `;

      const dbg = document.getElementById("dbg");

      async function load(){
        const q = (document.getElementById("q").value||"").trim();
        const r = await ctx.api("/api/users/admin?limit=80&q="+encodeURIComponent(q));
        if(dbg) dbg.textContent = JSON.stringify(r,null,2);
        const body = document.getElementById("rows");
        if(r.status!=="ok"){
          body.innerHTML = `<tr><td class="px-4 py-3 text-danger" colspan="5">${ctx.esc(r.status)}</td></tr>`;
          return;
        }
        body.innerHTML = (r.data.users||[]).map(u=>row(u, ctx)).join("");
        bindActions(ctx, load);
      }

      document.getElementById("btnReload").onclick = load;
      document.getElementById("q").addEventListener("keydown",(e)=>{ if(e.key==="Enter") load(); });

      document.getElementById("btnCreate").onclick = async ()=>{
        const email = prompt("Email:"); if(!email) return;
        const display_name = prompt("Display name:", "") || "";
        const role = prompt("Role (staff/admin/super_admin):", "staff") || "staff";
        const password = prompt("Password (min 10):", "") || "";
        if(password.length < 10) return ctx.toast("Password min 10", "error");
        const rr = await ctx.api("/api/users/admin", { method:"POST", body: JSON.stringify({ email, display_name, role, password }) });
        if(dbg) dbg.textContent = JSON.stringify(rr,null,2);
        ctx.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") load();
      };

      await load();
    }
  });

  function row(u, ctx){
    const roles = (u.roles||[]).join(", ");
    const stColor = u.status==="active" ? "text-success" : "text-danger";
    return `
      <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <img class="w-9 h-9 rounded-full border border-slate-200 dark:border-darkBorder" src="${ctx.diceBear(u.email_norm||u.id)}" alt="av">
            <div>
              <div class="font-bold text-slate-900 dark:text-white">${ctx.esc(u.display_name||"")}</div>
              <div class="text-[10px] text-slate-500">${ctx.esc(u.email_norm||"")}</div>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 text-slate-600 dark:text-slate-300">${ctx.esc(roles)}</td>
        <td class="px-4 py-3 ${stColor} font-bold">${ctx.esc(u.status||"")}</td>
        <td class="px-4 py-3 text-slate-500">${ctx.esc(String(u.last_login_at||""))}</td>
        <td class="px-4 py-3 text-right">
          <div class="flex justify-end gap-2">
            <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-xs btnDisable" data-id="${ctx.esc(u.id)}">${u.status==="disabled"?"Enable":"Disable"}</button>
            <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-xs btnReset" data-id="${ctx.esc(u.id)}">Reset PW</button>
            <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-xs btnRevoke" data-id="${ctx.esc(u.id)}">Revoke</button>
          </div>
        </td>
      </tr>
    `;
  }

  function bindActions(ctx, reload){
    document.querySelectorAll(".btnDisable").forEach(b=>{
      b.onclick = async ()=>{
        const id = b.getAttribute("data-id");
        const action = b.textContent.includes("Enable") ? "enable" : "disable";
        const r = await ctx.api("/api/users/admin", { method:"PUT", body: JSON.stringify({ action, user_id:id }) });
        ctx.toast(r.status, r.status==="ok"?"success":"error");
        if(r.status==="ok") reload();
      };
    });
    document.querySelectorAll(".btnReset").forEach(b=>{
      b.onclick = async ()=>{
        const id = b.getAttribute("data-id");
        const pw = prompt("New password (min 10):"); if(!pw || pw.length<10) return;
        const r = await ctx.api("/api/users/admin", { method:"PUT", body: JSON.stringify({ action:"reset_password", user_id:id, new_password:pw }) });
        ctx.toast(r.status, r.status==="ok"?"success":"error");
      };
    });
    document.querySelectorAll(".btnRevoke").forEach(b=>{
      b.onclick = async ()=>{
        const id = b.getAttribute("data-id");
        const r = await ctx.api("/api/users/admin", { method:"PUT", body: JSON.stringify({ action:"revoke_sessions", user_id:id }) });
        ctx.toast(r.status, r.status==="ok"?"success":"error");
      };
    });
  }
})();
