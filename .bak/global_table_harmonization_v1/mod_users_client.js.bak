export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const fmtTime = (sec)=>{ const n=Number(sec||0); if(!n) return "—"; return new Date(n*1000).toLocaleString(); };

  async function list(q, status, limit){
    const url="/api/users/client?q="+encodeURIComponent(q||"")+
      "&status="+encodeURIComponent(status||"")+
      "&limit="+encodeURIComponent(limit||50);
    return await Orland.api(url);
  }
  async function create(payload){ return await Orland.api("/api/users/client",{method:"POST",body:JSON.stringify(payload)}); }
  async function update(payload){ return await Orland.api("/api/users/client",{method:"PUT",body:JSON.stringify(payload)}); }

  return {
    title:"Client Users",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-sm font-extrabold">Client Users</div>
              <div class="text-xs opacity-70">CRUD user role: client</div>
            </div>
            <button id="btnCreate" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">
              <i class="fa-solid fa-plus mr-2"></i>Create
            </button>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <input id="q" class="w-64 max-w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"
              placeholder="search email / name">
            <select id="status" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              <option value="">all status</option>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
            </select>
            <select id="limit" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              <option value="25">25</option><option value="50" selected>50</option><option value="100">100</option><option value="200">200</option>
            </select>
            <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <i class="fa-solid fa-rotate mr-2"></i>Reload
            </button>
          </div>

          <div class="mt-4 overflow-auto border border-slate-200 dark:border-darkBorder rounded-xl">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="bg-slate-50 dark:bg-dark border-b border-slate-200 dark:border-darkBorder">
                <tr>
                  <th class="px-3 py-3 font-bold">User</th>
                  <th class="px-3 py-3 font-bold">Status</th>
                  <th class="px-3 py-3 font-bold">Created</th>
                  <th class="px-3 py-3 font-bold">Last login</th>
                  <th class="px-3 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody id="rows" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
            </table>
          </div>
          <div class="mt-3 text-[11px] opacity-70" id="meta">—</div>
        </div>

        <div id="modal" class="fixed inset-0 z-[9999] hidden items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/50"></div>
          <div class="relative w-full max-w-xl bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl shadow-xl p-4">
            <div class="flex items-center justify-between">
              <div class="text-sm font-extrabold">Create Client</div>
              <button id="mClose" class="w-9 h-9 rounded-full hover:bg-slate-100 dark:hover:bg-white/5"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div class="text-[11px] font-bold opacity-70">Email</div>
                <input id="fEmail" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="client@company.com">
              </div>
              <div>
                <div class="text-[11px] font-bold opacity-70">Display name</div>
                <input id="fName" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Company">
              </div>
              <div class="md:col-span-2">
                <div class="text-[11px] font-bold opacity-70">Password (min 10)</div>
                <input id="fPass" type="password" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="**********">
              </div>
            </div>
            <div class="mt-3 flex gap-2 justify-end">
              <button id="mCancel" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Cancel</button>
              <button id="mSave" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">Save</button>
            </div>
            <div class="mt-2 text-[11px] opacity-70" id="mOut"></div>
          </div>
        </div>
      `;

      const rowsEl = host.querySelector("#rows");
      const metaEl = host.querySelector("#meta");
      const qEl = host.querySelector("#q");
      const statusEl = host.querySelector("#status");
      const limitEl = host.querySelector("#limit");

      const modal = host.querySelector("#modal");
      const fEmail = host.querySelector("#fEmail");
      const fName  = host.querySelector("#fName");
      const fPass  = host.querySelector("#fPass");
      const mOut   = host.querySelector("#mOut");

      function openModal(){ modal.classList.remove("hidden"); modal.classList.add("flex"); }
      function closeModal(){ modal.classList.add("hidden"); modal.classList.remove("flex"); mOut.textContent=""; }

      host.querySelector("#mClose").onclick = closeModal;
      host.querySelector("#mCancel").onclick = closeModal;
      modal.addEventListener("click",(e)=>{ if(e.target===modal) closeModal(); });

      host.querySelector("#btnCreate").onclick = ()=>{
        fEmail.value=""; fName.value=""; fPass.value="";
        openModal();
      };

      host.querySelector("#mSave").onclick = async ()=>{
        const payload = { email:(fEmail.value||"").trim().toLowerCase(), display_name:(fName.value||"").trim(), password:(fPass.value||"") };
        if(!payload.email.includes("@")) return mOut.textContent="Email invalid.";
        if(payload.password.length<10) return mOut.textContent="Password min 10.";
        const r = await create(payload);
        mOut.textContent = r.status;
        if(r.status==="ok"){ Orland.toast("Created","success"); closeModal(); await reload(); }
        else Orland.toast("Failed: "+r.status,"error");
      };

      async function reload(){
        rowsEl.innerHTML = `<tr><td class="px-3 py-3 opacity-70" colspan="5">Loading...</td></tr>`;
        const r = await list(qEl.value, statusEl.value, limitEl.value);
        if(r.status!=="ok"){
          rowsEl.innerHTML = `<tr><td class="px-3 py-3 text-danger" colspan="5">Error: ${esc(r.status)}</td></tr>`;
          metaEl.textContent="—";
          return;
        }
        const users = r.data?.users || [];
        metaEl.textContent = `Total: ${users.length}`;
        rowsEl.innerHTML = users.map(u=>{
          return `
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
              <td class="px-3 py-3">
                <div class="font-bold">${esc(u.display_name||"-")}</div>
                <div class="text-[11px] opacity-70">${esc(u.email_norm||"")}</div>
              </td>
              <td class="px-3 py-3">${esc(u.status||"")}</td>
              <td class="px-3 py-3">${esc(fmtTime(u.created_at))}</td>
              <td class="px-3 py-3">${esc(fmtTime(u.last_login_at))}</td>
              <td class="px-3 py-3 text-right space-x-1">
                <button class="px-2 py-1 rounded-lg text-[11px] border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5"
                  data-act="toggle" data-id="${esc(u.id)}" data-status="${esc(u.status)}">${u.status==="active"?"Disable":"Enable"}</button>
                <button class="px-2 py-1 rounded-lg text-[11px] border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5"
                  data-act="resetpw" data-id="${esc(u.id)}">Reset PW</button>
              </td>
            </tr>
          `;
        }).join("") || `<tr><td class="px-3 py-3 opacity-70" colspan="5">No data</td></tr>`;

        rowsEl.querySelectorAll("button[data-act]").forEach(btn=>{
          btn.addEventListener("click", async ()=>{
            const act=btn.getAttribute("data-act");
            const id=btn.getAttribute("data-id");
            if(!id) return;

            if(act==="toggle"){
              const st=btn.getAttribute("data-status");
              const action=(st==="active")?"disable":"enable";
              if(!confirm(`Confirm ${action}?`)) return;
              const rr=await update({action,user_id:id});
              Orland.toast(rr.status, rr.status==="ok"?"success":"error");
              return reload();
            }

            if(act==="resetpw"){
              const np=prompt("New password (min 10):","");
              if(!np || np.length<10) return;
              const rr=await update({action:"reset_password",user_id:id,new_password:np});
              Orland.toast(rr.status, rr.status==="ok"?"success":"error");
              return reload();
            }
          });
        });
      }

      host.querySelector("#btnReload").onclick = reload;
      qEl.addEventListener("keydown",(e)=>{ if(e.key==="Enter") reload(); });

      await reload();
    }
  };
}
