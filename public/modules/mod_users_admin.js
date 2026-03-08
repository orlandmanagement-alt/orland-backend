export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const fmtTime = (sec)=>{
    const n = Number(sec||0);
    if(!n) return "-";
    try{ return new Date(n*1000).toLocaleString(); }catch{ return String(sec); }
  };

  async function loadUsers(q, limit){
    const url = "/api/users/admin?limit="+encodeURIComponent(limit||50) + (q?("&q="+encodeURIComponent(q)):"");
    return await Orland.api(url);
  }

  function modalTpl(title, bodyHtml){
    return `
      <div class="fixed inset-0 z-[200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" data-close="1"></div>
        <div class="relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between">
            <div class="text-sm font-bold">${esc(title)}</div>
            <button class="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5" data-close="1">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="p-4">${bodyHtml}</div>
        </div>
      </div>
    `;
  }

  function toast(msg, type="info"){
    const host = document.getElementById("toast-host");
    if(!host){ alert(msg); return; }
    const div = document.createElement("div");
    div.className = "fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    div.innerHTML = `<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(div);
    setTimeout(()=>div.remove(), 2800);
  }

  function pwField(id){
    return `
      <div class="relative">
        <input id="${id}" type="password" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="min 10 chars">
        <button type="button" data-pw-toggle="${id}" class="absolute right-2 top-1.5 w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
          <i class="fa-solid fa-eye"></i>
        </button>
      </div>
    `;
  }

  function bindPwToggle(root){
    root.querySelectorAll("[data-pw-toggle]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-pw-toggle");
        const inp = root.querySelector("#"+CSS.escape(id));
        if(!inp) return;
        const isPw = inp.type === "password";
        inp.type = isPw ? "text" : "password";
        btn.innerHTML = isPw ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      });
    });
  }

  return {
    title: "Admin Users",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-base font-bold">Admin Users</div>
              <div class="text-xs text-slate-500 mt-1">CRUD untuk super_admin/admin/staff.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnCreate" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
                <i class="fa-solid fa-plus mr-2"></i>Create
              </button>
              <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="md:col-span-2">
              <div class="relative">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-3 text-slate-400 text-xs"></i>
                <input id="q" class="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="search by email/name...">
              </div>
            </div>
            <div>
              <select id="limit" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs">
                <option value="25">25</option>
                <option value="50" selected>50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </div>
          </div>

          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                <tr>
                  <th class="py-3 pr-3">User</th>
                  <th class="py-3 pr-3">Roles</th>
                  <th class="py-3 pr-3">Status</th>
                  <th class="py-3 pr-3">Last Login</th>
                  <th class="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
            </table>
          </div>

          <pre id="debug" class="hidden mt-4 text-[10px] bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-darkBorder rounded-xl p-3 overflow-auto"></pre>
        </div>
      `;

      const tb = host.querySelector("#tb");
      const qEl = host.querySelector("#q");
      const limitEl = host.querySelector("#limit");

      async function render(){
        tb.innerHTML = `<tr><td class="py-4 text-slate-500" colspan="5">Loading…</td></tr>`;
        const r = await loadUsers(String(qEl.value||"").trim(), Number(limitEl.value||50));
        if(r.status !== "ok"){
          tb.innerHTML = `<tr><td class="py-4 text-red-400" colspan="5">Failed: ${esc(r.status)}</td></tr>`;
          return;
        }
        const rows = r.data?.users || [];
        if(!rows.length){
          tb.innerHTML = `<tr><td class="py-4 text-slate-500" colspan="5">No data</td></tr>`;
          return;
        }
        tb.innerHTML = rows.map(u=>{
          const roles = (u.roles||[]).join(", ");
          const st = u.status || "-";
          const stBadge = st==="active"
            ? `<span class="text-success font-bold"><i class="fa-solid fa-circle text-[8px] mr-1"></i>active</span>`
            : `<span class="text-danger font-bold"><i class="fa-solid fa-circle text-[8px] mr-1"></i>${esc(st)}</span>`;
          return `
            <tr>
              <td class="py-3 pr-3">
                <div class="font-bold text-slate-900 dark:text-white">${esc(u.display_name||"")}</div>
                <div class="text-[10px] text-slate-500">${esc(u.email_norm||"")}</div>
                <div class="text-[10px] text-slate-500">id: <code>${esc(u.id||"")}</code></div>
              </td>
              <td class="py-3 pr-3"><span class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder">${esc(roles||"-")}</span></td>
              <td class="py-3 pr-3">${stBadge}</td>
              <td class="py-3 pr-3 text-slate-500">${esc(fmtTime(u.last_login_at))}</td>
              <td class="py-3 text-right">
                <div class="flex justify-end gap-2 flex-wrap">
                  <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-act="toggle" data-id="${esc(u.id)}" data-status="${esc(st)}">
                    ${st==="disabled"?"Enable":"Disable"}
                  </button>
                  <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-act="reset" data-id="${esc(u.id)}">
                    Reset PW
                  </button>
                  <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-act="revoke" data-id="${esc(u.id)}">
                    Revoke
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join("");

        tb.querySelectorAll("button[data-act]").forEach(btn=>{
          btn.addEventListener("click", async ()=>{
            const act = btn.getAttribute("data-act");
            const id = btn.getAttribute("data-id");
            if(!id) return;

            if(act==="toggle"){
              const st = btn.getAttribute("data-status");
              const action = (st==="disabled") ? "enable" : "disable";
              const rr = await Orland.api("/api/users/admin", { method:"PUT", body: JSON.stringify({ action, user_id:id }) });
              toast(rr.status, rr.status==="ok"?"success":"error");
              if(rr.status==="ok") await render();
              return;
            }

            if(act==="revoke"){
              const rr = await Orland.api("/api/users/admin", { method:"PUT", body: JSON.stringify({ action:"revoke_sessions", user_id:id }) });
              toast(rr.status, rr.status==="ok"?"success":"error");
              return;
            }

            if(act==="reset"){
              const modal = document.createElement("div");
              modal.innerHTML = modalTpl("Reset Password", `
                <div class="text-xs text-slate-500 mb-2">Set password baru (min 10)</div>
                ${pwField("pw_new")}
                <div class="mt-4 flex gap-2">
                  <button id="ok" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 w-full">Update</button>
                  <button id="cancel" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 w-full">Cancel</button>
                </div>
              `);
              document.body.appendChild(modal.firstElementChild);
              const root = document.body.lastElementChild;
              bindPwToggle(root);

              const close = ()=> root.remove();
              root.querySelectorAll("[data-close],#cancel").forEach(x=>x.addEventListener("click", close));
              root.querySelector("#ok")?.addEventListener("click", async ()=>{
                const pw = String(root.querySelector("#pw_new")?.value||"");
                if(pw.length<10){ toast("Min 10 chars", "error"); return; }
                const rr = await Orland.api("/api/users/admin", { method:"PUT", body: JSON.stringify({ action:"reset_password", user_id:id, new_password: pw }) });
                toast(rr.status, rr.status==="ok"?"success":"error");
                if(rr.status==="ok"){ close(); }
              });
              return;
            }
          });
        });
      }

      // Create modal
      host.querySelector("#btnCreate")?.addEventListener("click", ()=>{
        const modal = document.createElement("div");
        modal.innerHTML = modalTpl("Create Admin/Staff", `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Email</div>
              <input id="email" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="user@domain.com">
            </div>
            <div>
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Role</div>
              <select id="role" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs">
                <option value="staff">staff</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div class="md:col-span-2">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Display Name</div>
              <input id="name" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="Display name">
            </div>
            <div class="md:col-span-2">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Password</div>
              ${pwField("pw")}
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <button id="ok" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 w-full">Create</button>
            <button id="cancel" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 w-full">Cancel</button>
          </div>
        `);
        document.body.appendChild(modal.firstElementChild);
        const root = document.body.lastElementChild;
        bindPwToggle(root);

        const close = ()=> root.remove();
        root.querySelectorAll("[data-close],#cancel").forEach(x=>x.addEventListener("click", close));

        root.querySelector("#ok")?.addEventListener("click", async ()=>{
          const email = String(root.querySelector("#email")?.value||"").trim().toLowerCase();
          const role = String(root.querySelector("#role")?.value||"staff").trim();
          const display_name = String(root.querySelector("#name")?.value||"").trim();
          const password = String(root.querySelector("#pw")?.value||"");

          if(!email.includes("@")) return toast("Invalid email", "error");
          if(password.length<10) return toast("Password min 10", "error");

          const rr = await Orland.api("/api/users/admin", {
            method:"POST",
            body: JSON.stringify({ email, role, display_name, password })
          });
          toast(rr.status, rr.status==="ok"?"success":"error");
          if(rr.status==="ok"){ close(); render(); }
        });
      });

      host.querySelector("#btnReload")?.addEventListener("click", render);
      qEl.addEventListener("keydown", (e)=>{ if(e.key==="Enter") render(); });
      limitEl.addEventListener("change", render);

      await render();
    }
  };
}
