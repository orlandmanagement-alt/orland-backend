export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  const clsBtn = "px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5";
  const clsPri = "px-3 py-2 rounded-xl text-xs font-black bg-primary text-white";
  const clsInp = "w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder";

  async function apiList(){ return await Orland.api("/api/menus"); }
  async function apiCreate(payload){ return await Orland.api("/api/menus",{ method:"POST", body: JSON.stringify(payload) }); }
  async function apiUpdate(payload){ return await Orland.api("/api/menus",{ method:"PUT", body: JSON.stringify(payload) }); }
  async function apiDelete(id){ return await Orland.api("/api/menus?id="+encodeURIComponent(id),{ method:"DELETE" }); }

  function normPath(p){
    p = String(p||"").trim();
    if(!p.startsWith("/")) p = "/"+p;
    p = p.replace(/\/+$/,"");
    return p || "/";
  }

  function buildTree(menus){
    const byId = new Map();
    const nodes = menus.map(m=>({ ...m, children:[] }));
    for(const n of nodes) byId.set(String(n.id), n);
    const roots = [];
    for(const n of nodes){
      if(n.parent_id && byId.has(String(n.parent_id))){
        byId.get(String(n.parent_id)).children.push(n);
      }else{
        roots.push(n);
      }
    }
    const sort = (arr)=>{
      arr.sort((a,b)=>{
        const sa=Number(a.sort_order??9999), sb=Number(b.sort_order??9999);
        if(sa!==sb) return sa-sb;
        return Number(a.created_at??0)-Number(b.created_at??0);
      });
      for(const x of arr) sort(x.children||[]);
    };
    sort(roots);
    return { roots, byId };
  }

  function optionsParents(menus, currentId){
    const opt = [`<option value="">(root)</option>`];
    for(const m of menus){
      if(String(m.id)===String(currentId)) continue;
      opt.push(`<option value="${esc(m.id)}">${esc(m.label)} — ${esc(m.path)}</option>`);
    }
    return opt.join("");
  }

  function modalHtml(){
    return `
    <div id="mbModal" class="hidden fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" id="mbModalBg"></div>
      <div class="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-xl overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between">
          <div class="text-sm font-black" id="mbModalTitle">Edit Menu</div>
          <button class="${clsBtn}" id="mbClose" type="button"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="p-4 space-y-3">
          <input type="hidden" id="f_id">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <div class="text-[11px] font-black text-slate-500">CODE</div>
              <input id="f_code" class="${clsInp}" placeholder="users_admin">
            </div>
            <div>
              <div class="text-[11px] font-black text-slate-500">SORT</div>
              <input id="f_sort" class="${clsInp}" type="number" placeholder="50">
            </div>
          </div>

          <div>
            <div class="text-[11px] font-black text-slate-500">LABEL</div>
            <input id="f_label" class="${clsInp}" placeholder="Admin Users">
          </div>

          <div>
            <div class="text-[11px] font-black text-slate-500">PATH</div>
            <input id="f_path" class="${clsInp}" placeholder="/users/admin">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <div class="text-[11px] font-black text-slate-500">PARENT</div>
              <select id="f_parent" class="${clsInp}"></select>
            </div>
            <div>
              <div class="text-[11px] font-black text-slate-500">ICON (FA class)</div>
              <input id="f_icon" class="${clsInp}" placeholder="fa-solid fa-users">
            </div>
          </div>

          <div class="text-xs text-red-500" id="mbErr"></div>
        </div>
        <div class="px-4 py-3 border-t border-slate-200 dark:border-darkBorder flex items-center justify-between gap-2">
          <button class="${clsBtn}" id="mbDelete" type="button"><i class="fa-solid fa-trash"></i> Delete</button>
          <div class="flex gap-2">
            <button class="${clsBtn}" id="mbCancel" type="button">Cancel</button>
            <button class="${clsPri}" id="mbSave" type="button"><i class="fa-solid fa-floppy-disk me-2"></i>Save</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function cardRow(m, activeFilter){
    const label = esc(m.label||m.code||m.id);
    const code = esc(m.code||"");
    const id = esc(m.id||"");
    const path = esc(m.path||"/");
    const icon = esc(m.icon||"fa-solid fa-circle-dot");
    const f = (activeFilter||"").toLowerCase();
    const hit = !f || `${m.label||""} ${m.path||""} ${m.code||""} ${m.id||""}`.toLowerCase().includes(f);
    if(!hit) return "";

    // mobile-first card
    return `
      <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-3 flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-darkBorder shrink-0">
          <i class="${icon}"></i>
        </div>

        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-sm font-black truncate">${label}</div>
              <div class="text-[11px] text-slate-500 truncate">${code} • ${id}</div>
            </div>
            <div class="text-right text-[11px] text-slate-500 truncate max-w-[42%]">${path}</div>
          </div>

          <div class="mt-2 flex items-center justify-between gap-2">
            <div class="text-[11px] text-slate-500">
              Sort: <span class="font-black">${Number(m.sort_order??50)}</span>
              ${m.parent_id ? ` • Parent: <span class="font-black">${esc(m.parent_id)}</span>` : ` • Parent: <span class="font-black">root</span>`}
            </div>

            <div class="flex items-center gap-2">
              <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-xs" data-act="up" data-id="${id}" title="Up"><i class="fa-solid fa-arrow-up"></i></button>
              <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-xs" data-act="down" data-id="${id}" title="Down"><i class="fa-solid fa-arrow-down"></i></button>
              <button class="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black" data-act="edit" data-id="${id}" title="Edit">Edit</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  return {
    title: "Menu Builder",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="text-lg font-black">Menu Builder</div>
              <div class="text-xs text-slate-500">CRUD menus (D1: menus). Reorder up/down dalam parent yang sama.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnReload" class="${clsBtn}" type="button"><i class="fa-solid fa-rotate"></i> Reload</button>
              <button id="btnCreate" class="${clsPri}" type="button"><i class="fa-solid fa-plus"></i> Create</button>
            </div>
          </div>

          <div class="mt-4 flex items-center gap-2">
            <input id="fFilter" class="${clsInp}" placeholder="filter label/path/code/id...">
          </div>

          <div class="mt-4 space-y-3" id="listBox"></div>

          <div class="mt-3 text-xs text-red-500" id="errBox"></div>
        </div>
        ${modalHtml()}
      `;

      const listBox = host.querySelector("#listBox");
      const errBox = host.querySelector("#errBox");
      const fFilter = host.querySelector("#fFilter");

      // modal refs
      const modal = host.querySelector("#mbModal");
      const modalBg = host.querySelector("#mbModalBg");
      const mbTitle = host.querySelector("#mbModalTitle");
      const mbErr = host.querySelector("#mbErr");

      const f_id = host.querySelector("#f_id");
      const f_code = host.querySelector("#f_code");
      const f_label = host.querySelector("#f_label");
      const f_path = host.querySelector("#f_path");
      const f_parent = host.querySelector("#f_parent");
      const f_sort = host.querySelector("#f_sort");
      const f_icon = host.querySelector("#f_icon");

      const btnSave = host.querySelector("#mbSave");
      const btnCancel = host.querySelector("#mbCancel");
      const btnClose = host.querySelector("#mbClose");
      const btnDelete = host.querySelector("#mbDelete");

      let MENUS = [];

      function openModal(mode, item){
        mbErr.textContent = "";
        modal.classList.remove("hidden");
        if(mode==="create"){
          mbTitle.textContent = "Create Menu";
          f_id.value = "";
          f_code.value = "";
          f_label.value = "";
          f_path.value = "/new-path";
          f_parent.innerHTML = optionsParents(MENUS, "");
          f_parent.value = "";
          f_sort.value = "50";
          f_icon.value = "fa-solid fa-circle-dot";
          btnDelete.disabled = true;
          btnDelete.classList.add("opacity-40");
        }else{
          mbTitle.textContent = "Edit Menu";
          f_id.value = String(item.id||"");
          f_code.value = String(item.code||"");
          f_label.value = String(item.label||"");
          f_path.value = String(item.path||"/");
          f_parent.innerHTML = optionsParents(MENUS, item.id);
          f_parent.value = item.parent_id ? String(item.parent_id) : "";
          f_sort.value = String(Number(item.sort_order??50));
          f_icon.value = String(item.icon||"");
          btnDelete.disabled = false;
          btnDelete.classList.remove("opacity-40");
        }
      }
      function closeModal(){ modal.classList.add("hidden"); }

      modalBg.onclick = closeModal;
      btnCancel.onclick = closeModal;
      btnClose.onclick = closeModal;

      async function reload(){
        errBox.textContent = "";
        listBox.innerHTML = `<div class="text-xs text-slate-500">Loading…</div>`;
        const r = await apiList();
        if(r.status!=="ok"){
          errBox.textContent = "Failed: "+r.status;
          listBox.innerHTML = `<pre class="text-[11px] whitespace-pre-wrap">${esc(JSON.stringify(r.data||{},null,2))}</pre>`;
          return;
        }
        MENUS = r.data.menus||[];
        render();
      }

      function render(){
        const f = String(fFilter.value||"").trim();
        const { roots } = buildTree(MENUS);

        const parts = [];
        // tampilkan semua sebagai list datar tapi rapih (urut DB)
        for(const m of MENUS){
          const row = cardRow(m, f);
          if(row) parts.push(row);
        }
        listBox.innerHTML = parts.length ? parts.join("") : `<div class="text-xs text-slate-500">No results.</div>`;

        // bind actions
        listBox.querySelectorAll("button[data-act]").forEach(btn=>{
          btn.onclick = async ()=>{
            const act = btn.getAttribute("data-act");
            const id = btn.getAttribute("data-id");
            const item = MENUS.find(x=>String(x.id)===String(id));
            if(!item) return;

            if(act==="edit"){ openModal("edit", item); return; }

            if(act==="up" || act==="down"){
              const rr = await apiUpdate({ action:"move", id, dir: act==="up" ? "up" : "down" });
              if(rr.status!=="ok"){ errBox.textContent = "Move failed: "+rr.status; return; }
              await reload();
              return;
            }
          };
        });
      }

      host.querySelector("#btnReload").onclick = reload;
      host.querySelector("#btnCreate").onclick = ()=> openModal("create", null);
      fFilter.oninput = ()=> render();

      btnSave.onclick = async ()=>{
        mbErr.textContent = "";
        const payload = {
          id: f_id.value || undefined,
          code: f_code.value.trim(),
          label: f_label.value.trim(),
          path: normPath(f_path.value.trim()),
          parent_id: f_parent.value ? f_parent.value : null,
          sort_order: Number(f_sort.value||50),
          icon: f_icon.value.trim() || null
        };
        if(!payload.code || !payload.label || !payload.path){
          mbErr.textContent = "code/label/path wajib diisi.";
          return;
        }

        const isEdit = !!f_id.value;
        const r = isEdit
          ? await apiUpdate({ action:"update", id: f_id.value, ...payload })
          : await apiCreate(payload);

        if(r.status!=="ok"){
          mbErr.textContent = "Failed: " + r.status + (r.data?.message ? " ("+r.data.message+")" : "");
          return;
        }
        closeModal();
        await reload();
      };

      btnDelete.onclick = async ()=>{
        mbErr.textContent = "";
        if(btnDelete.disabled) return;
        const id = f_id.value;
        if(!id) return;
        if(!confirm("Hapus menu ini? (harus tanpa child)")) return;
        const r = await apiDelete(id);
        if(r.status!=="ok"){
          mbErr.textContent = "Delete failed: " + r.status + (r.data?.message ? " ("+r.data.message+")" : "");
          return;
        }
        closeModal();
        await reload();
      };

      await reload();
    }
  };
}
