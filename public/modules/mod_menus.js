export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  const fmtPath = (p)=>String(p||"/").startsWith("/")?String(p):("/"+String(p));
  const pick = (o,k,d="")=> (o && o[k]!=null)?o[k]:d;

  async function apiList(){ return await Orland.api("/api/menus"); }
  async function apiCreate(payload){ return await Orland.api("/api/menus",{ method:"POST", body: JSON.stringify(payload) }); }
  async function apiDel(id){ return await Orland.api("/api/menus?id="+encodeURIComponent(id),{ method:"DELETE" }); }

  function sortByOrder(a,b){
    const sa = Number(a.sort_order ?? 9999);
    const sb = Number(b.sort_order ?? 9999);
    if(sa!==sb) return sa-sb;
    return String(a.created_at||0).localeCompare(String(b.created_at||0));
  }

  function buildTree(flat){
    const byId = new Map();
    const roots = [];
    for(const m of flat){ byId.set(String(m.id), {...m, children:[]}); }
    for(const m of byId.values()){
      if(m.parent_id && byId.has(String(m.parent_id))) byId.get(String(m.parent_id)).children.push(m);
      else roots.push(m);
    }
    const walk = (arr)=>{ arr.sort(sortByOrder); for(const x of arr) walk(x.children); };
    walk(roots);
    return { roots, byId };
  }

  function flattenTree(roots){
    const out=[];
    const walk=(node, depth)=>{
      out.push({ ...node, __depth: depth });
      for(const c of (node.children||[])) walk(c, depth+1);
    };
    for(const r of roots) walk(r, 0);
    return out;
  }

  function optParents(flat){
    const opts = [{ id:"", label:"(no parent)" }];
    for(const m of flat){
      opts.push({ id: m.id, label: `${"— ".repeat(m.__depth)}${m.label} (${m.code})` });
    }
    return opts;
  }

  function tinyBtn(html, cls){
    return `<button type="button" class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark hover:bg-slate-50 dark:hover:bg-white/5 ${cls||""}">${html}</button>`;
  }

  function modalHtml(state){
    const parents = optParents(state.flatAll);
    const m = state.editing || {};
    return `
<div class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-3">
  <div class="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-xl overflow-hidden">
    <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between">
      <div>
        <div class="text-sm font-extrabold">${state.mode==="create"?"Create Menu":"Edit Menu"}</div>
        <div class="text-[11px] text-slate-500">ID harus unik. Path wajib diawali <code>/</code>.</div>
      </div>
      <button id="mbClose" class="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 flex items-center justify-center">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <div class="p-4 space-y-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] font-bold text-slate-500">ID</label>
          <input id="f_id" ${state.mode==="edit"?"disabled":""} value="${esc(pick(m,"id",""))}"
            class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder ${state.mode==="edit"?"opacity-60":""}"
            placeholder="m_core_dashboard">
        </div>
        <div>
          <label class="text-[11px] font-bold text-slate-500">CODE</label>
          <input id="f_code" value="${esc(pick(m,"code",""))}"
            class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"
            placeholder="dashboard">
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] font-bold text-slate-500">LABEL</label>
          <input id="f_label" value="${esc(pick(m,"label",""))}"
            class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"
            placeholder="Dashboard">
        </div>
        <div>
          <label class="text-[11px] font-bold text-slate-500">PATH</label>
          <input id="f_path" value="${esc(pick(m,"path",""))}"
            class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"
            placeholder="/dashboard">
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label class="text-[11px] font-bold text-slate-500">PARENT</label>
          <select id="f_parent" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
            ${parents.map(o=>`<option value="${esc(o.id)}" ${String(o.id)===String(pick(m,"parent_id",""))?"selected":""}>${esc(o.label)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="text-[11px] font-bold text-slate-500">SORT</label>
          <input id="f_sort" type="number" value="${esc(String(pick(m,"sort_order",50)))}"
            class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
        </div>
        <div>
          <label class="text-[11px] font-bold text-slate-500">ICON (FA)</label>
          <input id="f_icon" value="${esc(pick(m,"icon",""))}"
            class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"
            placeholder="fa-solid fa-gauge-high">
        </div>
      </div>

      <div id="mbErr" class="hidden text-xs text-red-500 font-semibold"></div>
    </div>

    <div class="px-4 py-3 border-t border-slate-200 dark:border-darkBorder flex items-center justify-between gap-2">
      <button id="mbDelete" class="px-3 py-2 rounded-xl text-xs font-black border border-red-200 text-red-600 hover:bg-red-50 ${state.mode==="create"?"hidden":""}">
        Delete
      </button>
      <div class="flex gap-2 ml-auto">
        <button id="mbCancel" class="px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
          Cancel
        </button>
        <button id="mbSave" class="px-3 py-2 rounded-xl text-xs font-black bg-primary text-white hover:opacity-95">
          Save
        </button>
      </div>
    </div>
  </div>
</div>`;
  }

  function render(host, state){
    const rows = state.filtered;

    host.innerHTML = `
<div class="space-y-4">
  <div class="flex items-start justify-between gap-3">
    <div>
      <div class="text-xl font-extrabold text-slate-900 dark:text-white">Menu Builder</div>
      <div class="text-sm text-slate-500">CRUD menus + reorder. Mobile-friendly.</div>
    </div>
    <div class="flex gap-2">
      <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
        <i class="fa-solid fa-rotate-right mr-2"></i>Reload
      </button>
      <button id="btnCreate" class="px-3 py-2 rounded-xl text-xs font-black bg-primary text-white hover:opacity-95">
        <i class="fa-solid fa-plus mr-2"></i>Create
      </button>
    </div>
  </div>

  <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-3">
    <div class="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
      <div class="relative w-full sm:max-w-md">
        <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
        <input id="q" value="${esc(state.q)}" placeholder="filter label/path/code..."
          class="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
      </div>
      <div class="text-[11px] text-slate-500">
        Total: <span class="font-black">${rows.length}</span>
      </div>
    </div>
  </div>

  <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl overflow-hidden">
    <div class="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_160px] gap-2 px-4 py-3 text-[11px] font-extrabold text-slate-500 bg-slate-50 dark:bg-dark">
      <div>MENU</div>
      <div class="text-right">ACTIONS</div>
    </div>

    <div class="divide-y divide-slate-100 dark:divide-darkBorder">
      ${rows.map(m=>{
        const indent = Math.min(5, m.__depth||0);
        const pad = 12 + indent*14;
        const active = "";
        return `
        <div class="grid grid-cols-[1fr_100px] sm:grid-cols-[1fr_160px] gap-2 px-4 py-3 items-center">
          <div class="min-w-0">
            <div class="flex items-center gap-2" style="padding-left:${pad}px">
              <i class="${esc(m.icon||"fa-solid fa-circle-dot")} text-slate-400 w-5 text-center"></i>
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">${esc(m.label||m.code||m.id)}</div>
                <div class="text-[11px] text-slate-500 truncate">
                  <span class="font-bold">${esc(m.code)}</span>
                  <span class="opacity-60">•</span>
                  <span class="opacity-80">${esc(m.id)}</span>
                  <span class="opacity-60">•</span>
                  <span class="opacity-80">${esc(m.path)}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center justify-end gap-1">
            ${tinyBtn('<i class="fa-solid fa-arrow-up"></i>',"btnUp")}
            ${tinyBtn('<i class="fa-solid fa-arrow-down"></i>',"btnDown")}
            ${tinyBtn('<span class="font-black">Edit</span>',"btnEdit")}
          </div>

          <div class="hidden meta"
            data-id="${esc(m.id)}"
            data-code="${esc(m.code)}"
            data-label="${esc(m.label)}"
            data-path="${esc(m.path)}"
            data-parent_id="${esc(m.parent_id||"")}"
            data-sort_order="${esc(String(m.sort_order||50))}"
            data-icon="${esc(m.icon||"")}"
          ></div>
        </div>`;
      }).join("")}
    </div>
  </div>

  <div class="text-[11px] text-slate-500">
    Reorder (Up/Down) berlaku dalam group parent yang sama.
  </div>
</div>

${state.modalOpen ? modalHtml(state) : ""}
`;

    // bindings
    host.querySelector("#q")?.addEventListener("input",(e)=>{
      state.q = e.target.value || "";
      applyFilter(state);
      render(host,state);
      bindRowButtons(host,state);
    });

    host.querySelector("#btnReload")?.addEventListener("click",()=>state.reload());
    host.querySelector("#btnCreate")?.addEventListener("click",()=>openCreate(host,state));

    if(state.modalOpen){
      host.querySelector("#mbClose")?.addEventListener("click",()=>closeModal(host,state));
      host.querySelector("#mbCancel")?.addEventListener("click",()=>closeModal(host,state));
      host.querySelector("#mbSave")?.addEventListener("click",()=>saveModal(host,state));
      host.querySelector("#mbDelete")?.addEventListener("click",()=>deleteModal(host,state));
    }

    bindRowButtons(host,state);
  }

  function bindRowButtons(host,state){
    const rows = host.querySelectorAll(".divide-y > div");
    rows.forEach(row=>{
      const meta = row.querySelector(".meta");
      if(!meta) return;
      const m = {
        id: meta.dataset.id,
        code: meta.dataset.code,
        label: meta.dataset.label,
        path: meta.dataset.path,
        parent_id: meta.dataset.parent_id || null,
        sort_order: Number(meta.dataset.sort_order||50),
        icon: meta.dataset.icon || null
      };

      row.querySelector(".btnEdit")?.addEventListener("click",()=>openEdit(host,state,m));
      row.querySelector(".btnUp")?.addEventListener("click",()=>reorder(host,state,m,"up"));
      row.querySelector(".btnDown")?.addEventListener("click",()=>reorder(host,state,m,"down"));
    });
  }

  function applyFilter(state){
    const q = String(state.q||"").trim().toLowerCase();
    if(!q){
      state.filtered = state.flatAll;
      return;
    }
    state.filtered = state.flatAll.filter(m=>{
      const hay = `${m.label} ${m.code} ${m.path} ${m.id}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function openCreate(host,state){
    state.mode = "create";
    state.editing = { id:"", code:"", label:"", path:"/", parent_id:"", sort_order:50, icon:"" };
    state.modalOpen = true;
    render(host,state);
  }

  function openEdit(host,state,m){
    state.mode = "edit";
    state.editing = { ...m, parent_id: m.parent_id || "" };
    state.modalOpen = true;
    render(host,state);
  }

  function closeModal(host,state){
    state.modalOpen = false;
    state.mode = "create";
    state.editing = null;
    render(host,state);
  }

  function showErr(host,msg){
    const el = host.querySelector("#mbErr");
    if(!el) return;
    el.classList.remove("hidden");
    el.textContent = msg;
  }

  async function saveModal(host,state){
    const id = String(host.querySelector("#f_id")?.value||"").trim();
    const code = String(host.querySelector("#f_code")?.value||"").trim();
    const label = String(host.querySelector("#f_label")?.value||"").trim();
    const path = fmtPath(host.querySelector("#f_path")?.value||"/");
    const parent_id = String(host.querySelector("#f_parent")?.value||"").trim() || null;
    const sort_order = Number(host.querySelector("#f_sort")?.value||50);
    const icon = String(host.querySelector("#f_icon")?.value||"").trim() || null;

    if(!id && state.mode==="create") return showErr(host,"id_required");
    if(!code || !label || !path) return showErr(host,"code/label/path_required");

    const payload = { id, code, label, path, parent_id, sort_order, icon };

    const r = await apiCreate(payload);
    if(r.status!=="ok"){
      return showErr(host, r.status || "server_error");
    }

    closeModal(host,state);
    await state.reload(true);
  }

  async function deleteModal(host,state){
    const id = String(state.editing?.id||"").trim();
    if(!id) return;
    if(!confirm("Delete menu: "+id+" ?")) return;
    const r = await apiDel(id);
    if(r.status!=="ok"){
      return showErr(host, r.status || "server_error");
    }
    closeModal(host,state);
    await state.reload(true);
  }

  async function reorder(host,state, item, dir){
    // reorder within same parent group: swap sort_order with nearest sibling
    const sibs = state.flatAll.filter(x=>String(x.parent_id||"")===String(item.parent_id||"")).sort(sortByOrder);
    const idx = sibs.findIndex(x=>x.id===item.id);
    if(idx<0) return;

    const j = dir==="up" ? idx-1 : idx+1;
    if(j<0 || j>=sibs.length) return;

    const a = sibs[idx];
    const b = sibs[j];

    // swap sort_order (keep integers)
    const sa = Number(a.sort_order||50);
    const sb = Number(b.sort_order||50);

    const ra = await apiCreate({ id:a.id, code:a.code, label:a.label, path:a.path, parent_id:a.parent_id, sort_order:sb, icon:a.icon||null });
    if(ra.status!=="ok") return;

    const rb = await apiCreate({ id:b.id, code:b.code, label:b.label, path:b.path, parent_id:b.parent_id, sort_order:sa, icon:b.icon||null });
    if(rb.status!=="ok") return;

    await state.reload(true);
  }

  return {
    title: "Menu Builder",
    async mount(host){
      const state = {
        q:"",
        modalOpen:false,
        mode:"create",
        editing:null,
        flatAll:[],
        filtered:[],
        async reload(keepQuery){
          const r = await apiList();
          if(r.status!=="ok"){
            host.innerHTML = `<div class="text-red-500 font-bold">Failed: ${esc(r.status||"server_error")}</div>`;
            return;
          }
          const flat = (r.data?.flat || r.data?.menus || r.data || []);
          // API /api/menus di project kamu biasanya return {menus:[...]} atau {flat:[...]}
          // fallback: kalau ada field "menus"
          const raw = Array.isArray(flat) ? flat : (Array.isArray(r.data?.menus)?r.data.menus:[]);
          const { roots } = buildTree(raw.map(x=>({
            id:String(x.id),
            code:String(x.code),
            label:String(x.label),
            path:String(x.path),
            parent_id: x.parent_id ? String(x.parent_id) : null,
            sort_order: Number(x.sort_order ?? 50),
            icon: x.icon ? String(x.icon) : null,
            created_at: Number(x.created_at ?? 0)
          })));
          state.flatAll = flattenTree(roots);
          if(!keepQuery) state.q = "";
          applyFilter(state);
          render(host,state);
        }
      };

      await state.reload(false);
    }
  };
}
