export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const qs = (sel, root=document)=>root.querySelector(sel);
  const qsa = (sel, root=document)=>Array.from(root.querySelectorAll(sel));

  function toast(msg,type="info"){
    const host = document.getElementById("toast-host");
    if(!host){ alert(msg); return; }
    const div = document.createElement("div");
    div.className = "orland-toast-item";
    div.innerHTML = `<div style="font-weight:900">${esc(type.toUpperCase())}</div><div style="opacity:.85;font-size:12px;margin-top:2px">${esc(msg)}</div>`;
    host.appendChild(div);
    setTimeout(()=>{ div.style.opacity="0"; div.style.transform="translateY(6px)"; }, 2200);
    setTimeout(()=>div.remove(), 3000);
  }

  async function loadMenus(){
    return await Orland.api("/api/menus");
  }

  async function upsertMenu(payload){
    return await Orland.api("/api/menus",{ method:"POST", body: JSON.stringify(payload) });
  }

  async function deleteMenu(id){
    return await Orland.api("/api/menus?id="+encodeURIComponent(id),{ method:"DELETE" });
  }

  async function loadRbacBundle(){
    // existing endpoint in your backend: functions/api/rbac/bundle.js
    const r = await Orland.api("/api/rbac/bundle");
    return r;
  }

  async function saveRoleMenus(role_id, menu_ids){
    return await Orland.api("/api/role-menus/set",{ method:"POST", body: JSON.stringify({ role_id, menu_ids }) });
  }

  function buildParentOptions(menus, selected){
    const opts = ['<option value="">(no parent)</option>'];
    for(const m of menus){
      const sel = (String(selected||"")===String(m.id)) ? "selected" : "";
      opts.push(`<option value="${esc(m.id)}" ${sel}>${esc(m.label)} • ${esc(m.code)}</option>`);
    }
    return opts.join("");
  }

  function render(host, state){
    host.innerHTML = `
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div class="text-sm font-bold">Menu Builder</div>
            <div class="text-xs text-slate-500">CRUD sidebar menus + assign menus to roles (RBAC).</div>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button id="mbReload" class="px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-darkBorder hover:opacity-90">Reload</button>
            <button id="mbClearForm" class="px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-darkBorder hover:opacity-90">Clear Form</button>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <!-- FORM -->
          <div class="border border-slate-200 dark:border-darkBorder rounded-xl p-3">
            <div class="text-xs font-bold mb-2">Upsert Menu</div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label class="text-[11px] font-bold text-slate-500">ID (optional)</label>
                <input id="f_id" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="auto uuid if empty">
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500">CODE *</label>
                <input id="f_code" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="e.g. users_admin">
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500">LABEL *</label>
                <input id="f_label" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="e.g. Admin Users">
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500">PATH *</label>
                <input id="f_path" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="/users/admin">
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500">PARENT</label>
                <select id="f_parent" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"></select>
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500">SORT ORDER</label>
                <input id="f_sort" type="number" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" value="50">
              </div>
              <div class="md:col-span-2">
                <label class="text-[11px] font-bold text-slate-500">ICON (FontAwesome class)</label>
                <input id="f_icon" class="w-full mt-1 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="fa-solid fa-users-gear">
                <div class="text-[11px] text-slate-500 mt-1">Contoh: <code>fa-solid fa-user-shield</code></div>
              </div>
            </div>

            <button id="mbSave" class="mt-3 w-full px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">
              Save Menu
            </button>

            <div class="mt-3 text-[11px] text-slate-500">
              Tips: untuk submenu, isi <b>parent_id</b> dengan ID menu parent.
            </div>
          </div>

          <!-- LIST -->
          <div class="border border-slate-200 dark:border-darkBorder rounded-xl p-3">
            <div class="flex items-center justify-between">
              <div class="text-xs font-bold">Menus</div>
              <div class="text-[11px] text-slate-500">Klik row untuk Fill form</div>
            </div>

            <div class="mt-2 overflow-auto max-h-[420px] border border-slate-200 dark:border-darkBorder rounded-lg">
              <table class="w-full text-left text-xs">
                <thead class="bg-slate-50 dark:bg-black/20 text-slate-500 sticky top-0">
                  <tr>
                    <th class="px-3 py-2">Label</th>
                    <th class="px-3 py-2">Path</th>
                    <th class="px-3 py-2">Sort</th>
                    <th class="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody id="mbTbody" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- RBAC -->
        <div class="mt-4 border border-slate-200 dark:border-darkBorder rounded-xl p-3">
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div class="text-xs font-bold">RBAC Assignment</div>
              <div class="text-[11px] text-slate-500">Pilih role → centang menu → Save.</div>
            </div>
            <div class="flex gap-2 items-center">
              <select id="rbRole" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"></select>
              <button id="rbSave" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">Save</button>
            </div>
          </div>

          <div id="rbChecks" class="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2"></div>
        </div>

        <details class="mt-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="mbDebug" class="text-[11px] text-slate-400 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    // parent options
    qs("#f_parent", host).innerHTML = buildParentOptions(state.menus, "");

    // list
    const tbody = qs("#mbTbody", host);
    tbody.innerHTML = (state.menus||[]).map(m=>{
      const icon = m.icon ? `<i class="${esc(m.icon)}"></i>` : "";
      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer" data-id="${esc(m.id)}">
          <td class="px-3 py-2">
            <div class="font-bold text-slate-900 dark:text-white">${icon} ${esc(m.label)}</div>
            <div class="text-[10px] text-slate-500">${esc(m.code)} • <code>${esc(m.id)}</code></div>
          </td>
          <td class="px-3 py-2 text-slate-500">${esc(m.path)}</td>
          <td class="px-3 py-2">${esc(String(m.sort_order ?? 50))}</td>
          <td class="px-3 py-2">
            <button class="mbDel px-2 py-1 rounded bg-danger/10 text-danger text-[11px] font-bold" data-del="${esc(m.id)}">Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    // fill form on row click
    qsa("tr[data-id]", host).forEach(tr=>{
      tr.addEventListener("click",(e)=>{
        if(e.target.closest(".mbDel")) return;
        const id = tr.getAttribute("data-id");
        const m = state.menus.find(x=>String(x.id)===String(id));
        if(!m) return;
        qs("#f_id",host).value = m.id || "";
        qs("#f_code",host).value = m.code || "";
        qs("#f_label",host).value = m.label || "";
        qs("#f_path",host).value = m.path || "/";
        qs("#f_parent",host).innerHTML = buildParentOptions(state.menus, m.parent_id || "");
        qs("#f_sort",host).value = String(m.sort_order ?? 50);
        qs("#f_icon",host).value = m.icon || "";
        toast("Form filled","info");
      });
    });

    // delete
    qsa(".mbDel", host).forEach(btn=>{
      btn.addEventListener("click", async (e)=>{
        e.preventDefault(); e.stopPropagation();
        const id = btn.getAttribute("data-del");
        if(!confirm("Delete menu? children will be detached (parent_id NULL).")) return;
        const r = await deleteMenu(id);
        qs("#mbDebug",host).textContent = JSON.stringify(r,null,2);
        toast(r.status, r.status==="ok"?"success":"error");
        await state.reload();
      });
    });

    // save upsert
    qs("#mbSave", host).addEventListener("click", async ()=>{
      const payload = {
        id: qs("#f_id",host).value.trim() || null,
        code: qs("#f_code",host).value.trim(),
        label: qs("#f_label",host).value.trim(),
        path: qs("#f_path",host).value.trim(),
        parent_id: qs("#f_parent",host).value.trim() || null,
        sort_order: Number(qs("#f_sort",host).value || 50),
        icon: qs("#f_icon",host).value.trim() || null,
      };
      const r = await upsertMenu(payload);
      qs("#mbDebug",host).textContent = JSON.stringify(r,null,2);
      toast(r.status, r.status==="ok"?"success":"error");
      if(r.status==="ok") await state.reload();
    });

    // clear
    qs("#mbClearForm", host).addEventListener("click", ()=>{
      qs("#f_id",host).value="";
      qs("#f_code",host).value="";
      qs("#f_label",host).value="";
      qs("#f_path",host).value="/";
      qs("#f_parent",host).innerHTML = buildParentOptions(state.menus, "");
      qs("#f_sort",host).value="50";
      qs("#f_icon",host).value="";
      toast("Cleared","info");
    });

    // reload
    qs("#mbReload", host).addEventListener("click", async ()=> state.reload());

    // RBAC render
    const roleSel = qs("#rbRole", host);
    roleSel.innerHTML = (state.roles||[]).map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("");

    function renderRoleChecks(){
      const role_id = roleSel.value;
      const set = new Set((state.role_menus||[]).filter(x=>String(x.role_id)===String(role_id)).map(x=>String(x.menu_id)));
      const box = qs("#rbChecks", host);
      box.innerHTML = (state.menus||[]).map(m=>{
        const checked = set.has(String(m.id)) ? "checked" : "";
        return `
          <label class="flex items-start gap-2 p-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white/50 dark:bg-black/20 cursor-pointer">
            <input type="checkbox" data-mid="${esc(m.id)}" ${checked} style="margin-top:3px">
            <div>
              <div class="text-xs font-bold">${m.icon?`<i class="${esc(m.icon)} mr-1"></i>`:""}${esc(m.label)}</div>
              <div class="text-[10px] text-slate-500">${esc(m.path)} • <code>${esc(m.code)}</code></div>
            </div>
          </label>
        `;
      }).join("");
    }

    roleSel.addEventListener("change", renderRoleChecks);

    qs("#rbSave", host).addEventListener("click", async ()=>{
      const role_id = roleSel.value;
      const menu_ids = qsa('#rbChecks input[type="checkbox"]', host).filter(x=>x.checked).map(x=>x.getAttribute("data-mid"));
      const r = await saveRoleMenus(role_id, menu_ids);
      qs("#mbDebug",host).textContent = JSON.stringify(r,null,2);
      toast(r.status, r.status==="ok"?"success":"error");
      if(r.status==="ok") await state.reloadRbac();
    });

    renderRoleChecks();
  }

  return {
    title: "Menu Builder",
    async mount(host){
      const state = {
        menus: [],
        roles: [],
        role_menus: [],
        async reload(){
          const r = await loadMenus();
          if(r.status!=="ok"){ host.innerHTML = `<div class="text-xs text-red-400">Failed /api/menus: ${esc(r.status)}</div>`; return; }
          state.menus = r.data.menus || [];
          await state.reloadRbac(true);
          render(host, state);
          // refresh sidebar nav after menu change
          try{
            const nav = await Orland.api("/api/nav");
            if(nav.status==="ok"){
              Orland.state.nav = nav.data;
              Orland.renderNav(Orland.state.path);
            }
          }catch{}
        },
        async reloadRbac(skipRender){
          const b = await loadRbacBundle();
          if(b.status==="ok"){
            state.roles = b.data.roles || [];
            state.role_menus = b.data.role_menus || [];
          }
          if(!skipRender) render(host,state);
        }
      };

      await state.reload();
    }
  };
}
