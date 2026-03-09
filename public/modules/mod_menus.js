export default function MenuBuilder(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  function toast(msg){
    const host = document.getElementById("toast-host");
    if(!host){ alert(msg); return; }
    const el = document.createElement("div");
    el.className = "bg-white/90 dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl px-3 py-2 text-xs shadow";
    el.innerHTML = `<div class="font-bold">Menu Builder</div><div class="opacity-70 mt-1">${esc(msg)}</div>`;
    host.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; }, 2200);
    setTimeout(()=>el.remove(), 2800);
  }

  function normPath(p){
    p = String(p||"").trim();
    if(!p.startsWith("/")) p = "/" + p;
    p = p.replace(/\s+/g,"");
    p = p.replace(/\/+$/,"");
    return p || "/";
  }

  async function loadMenus(){
    return await Orland.api("/api/menus");
  }

  async function createMenu(payload){
    return await Orland.api("/api/menus", { method:"POST", body: JSON.stringify(payload) });
  }

  async function updateMenu(payload){
    return await Orland.api("/api/menus", { method:"PUT", body: JSON.stringify({ action:"update", ...payload }) });
  }

  async function reorder(id, dir){
    return await Orland.api("/api/menus", { method:"PUT", body: JSON.stringify({ action:"reorder", id, dir }) });
  }

  async function delMenu(id){
    return await Orland.api("/api/menus?id="+encodeURIComponent(id), { method:"DELETE" });
  }

  function buildTree(rows){
    const byId = new Map();
    const list = (rows||[]).map(x=>({ ...x, children:[] }));
    for(const x of list) byId.set(x.id, x);

    const roots = [];
    for(const x of list){
      if(x.parent_id && byId.has(x.parent_id)) byId.get(x.parent_id).children.push(x);
      else roots.push(x);
    }

    const sortFn=(a,b)=>{
      const sa=Number(a.sort_order??9999), sb=Number(b.sort_order??9999);
      if(sa!==sb) return sa-sb;
      return Number(a.created_at??0)-Number(b.created_at??0);
    };
    const walk=(arr)=>{ arr.sort(sortFn); arr.forEach(n=>walk(n.children||[])); };
    walk(roots);
    return roots;
  }

  function flattenTree(tree){
    const out=[];
    const walk=(n, depth)=>{
      out.push({ node:n, depth });
      (n.children||[]).forEach(ch=>walk(ch, depth+1));
    };
    tree.forEach(n=>walk(n,0));
    return out;
  }

  function optionParents(rows, currentId){
    // prevent self-parenting; allow null
    const opts = [`<option value="">(no parent)</option>`];
    for(const r of (rows||[])){
      if(String(r.id) === String(currentId)) continue;
      opts.push(`<option value="${esc(r.id)}">${esc(r.label)} — ${esc(r.path)}</option>`);
    }
    return opts.join("");
  }

  return {
    title: "Menu Builder",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div class="text-sm font-extrabold">Menu Builder</div>
              <div class="text-xs opacity-70 mt-1">CRUD menu sidebar (D1 table: <code>menus</code>). Tidak drop data, aman untuk legacy.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">Reload</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div class="border border-slate-200 dark:border-darkBorder rounded-2xl p-3">
              <div class="text-xs font-bold mb-2">Create Menu</div>
              <div class="grid grid-cols-2 gap-2">
                <div class="col-span-2">
                  <label class="text-[10px] font-bold opacity-70">Label</label>
                  <input id="f_label" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Menu name">
                </div>
                <div>
                  <label class="text-[10px] font-bold opacity-70">Code</label>
                  <input id="f_code" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="menu_code">
                </div>
                <div>
                  <label class="text-[10px] font-bold opacity-70">Path</label>
                  <input id="f_path" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="/users/admin">
                </div>
                <div>
                  <label class="text-[10px] font-bold opacity-70">Parent</label>
                  <select id="f_parent" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"></select>
                </div>
                <div>
                  <label class="text-[10px] font-bold opacity-70">Sort</label>
                  <input id="f_sort" type="number" value="50" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                </div>
                <div class="col-span-2">
                  <label class="text-[10px] font-bold opacity-70">Icon (FontAwesome class)</label>
                  <div class="flex gap-2 items-center mt-1">
                    <input id="f_icon" class="flex-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="fa-solid fa-sitemap">
                    <span id="iconPreview" class="w-10 h-10 rounded-xl border border-slate-200 dark:border-darkBorder flex items-center justify-center">
                      <i class="fa-solid fa-circle-dot"></i>
                    </span>
                  </div>
                </div>
              </div>
              <button id="btnCreate" class="mt-3 w-full px-3 py-2 rounded-xl text-xs font-extrabold bg-primary text-white">Create</button>
              <div class="text-[10px] opacity-60 mt-2">
                Tips: Path harus unik. Parent menu boleh kosong. Code disarankan unik.
              </div>
            </div>

            <div class="border border-slate-200 dark:border-darkBorder rounded-2xl p-3">
              <div class="flex items-center justify-between gap-2">
                <div class="text-xs font-bold">Menus</div>
                <input id="q" class="px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="filter label/path...">
              </div>
              <div class="mt-3 overflow-auto" style="max-height:520px">
                <div class="data-orland-table-wrap" style="overflow-x:auto; -webkit-overflow-scrolling:touch;"><table class="w-full text-xs">
                  <thead class="sticky top-0 bg-white dark:bg-darkLighter">
                    <tr class="text-[10px] uppercase opacity-70">
                      <th class="text-left py-2">Menu</th>
                      <th class="text-left py-2">Path</th>
                      <th class="text-right py-2">Sort</th>
                      <th class="text-right py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="rows"></tbody>
                </table></div><!--data-orland-table-wrap-end-->
              </div>
              <div class="text-[10px] opacity-60 mt-2">
                Reorder (Up/Down) berlaku di dalam group parent yang sama.
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Modal -->
        <div id="modal" class="fixed inset-0 z-[200] hidden">
          <div class="absolute inset-0 bg-black/60"></div>
          <div class="relative mx-auto mt-16 w-[94%] max-w-xl bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <div class="flex items-start justify-between gap-2">
              <div>
                <div class="text-sm font-extrabold">Edit Menu</div>
                <div class="text-xs opacity-70 mt-1" id="m_hint">—</div>
              </div>
              <button id="m_close" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder">Close</button>
            </div>

            <div class="grid grid-cols-2 gap-2 mt-3">
              <div class="col-span-2">
                <label class="text-[10px] font-bold opacity-70">Label</label>
                <input id="m_label" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>
              <div>
                <label class="text-[10px] font-bold opacity-70">Code</label>
                <input id="m_code" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>
              <div>
                <label class="text-[10px] font-bold opacity-70">Path</label>
                <input id="m_path" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>
              <div>
                <label class="text-[10px] font-bold opacity-70">Parent</label>
                <select id="m_parent" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"></select>
              </div>
              <div>
                <label class="text-[10px] font-bold opacity-70">Sort</label>
                <input id="m_sort" type="number" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>
              <div class="col-span-2">
                <label class="text-[10px] font-bold opacity-70">Icon</label>
                <input id="m_icon" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>
            </div>

            <div class="flex gap-2 mt-4">
              <button id="m_save" class="flex-1 px-3 py-2 rounded-xl text-xs font-extrabold bg-primary text-white">Save</button>
              <button id="m_delete" class="px-3 py-2 rounded-xl text-xs font-extrabold bg-danger text-white">Delete</button>
            </div>

            <div class="text-[10px] opacity-60 mt-2">
              Delete akan ditolak jika menu masih punya children.
            </div>
          </div>
        </div>
      `;

      const $ = (id)=>host.querySelector(id);
      const rowsEl = $("#rows");
      const modal = $("#modal");

      let allMenus = [];
      let flat = [];
      let editId = null;

      function renderParents(){
        $("#f_parent").innerHTML = optionParents(allMenus, null);
      }

      function renderIconPreview(){
        const ic = ($("#f_icon").value||"").trim() || "fa-solid fa-circle-dot";
        $("#iconPreview").innerHTML = `<i class="${esc(ic)}"></i>`;
      }

      function applyFilter(){
        const q = ($("#q").value||"").trim().toLowerCase();
        if(!q) return flat;
        return flat.filter(x=>{
          const n = (x.node.label||"").toLowerCase();
          const p = (x.node.path||"").toLowerCase();
          const c = (x.node.code||"").toLowerCase();
          return n.includes(q) || p.includes(q) || c.includes(q);
        });
      }

      function pad(depth){
        return 12 + depth*14;
      }

      function renderTable(){
        const list = applyFilter();
        rowsEl.innerHTML = list.map(({node, depth})=>{
          const icon = node.icon || "fa-solid fa-circle-dot";
          return `
            <tr class="border-t border-slate-100 dark:border-darkBorder hover:bg-slate-50/60 dark:hover:bg-white/5">
              <td class="py-2">
                <div style="padding-left:${pad(depth)}px" class="flex items-center gap-2">
                  <i class="${esc(icon)} w-5 text-center"></i>
                  <div class="min-w-0">
                    <div class="font-bold truncate">${esc(node.label)}</div>
                    <div class="text-[10px] opacity-60 truncate">${esc(node.code)} • ${esc(node.id)}</div>
                  </div>
                </div>
              </td>
              <td class="py-2">
                <div class="font-mono text-[11px] opacity-80">${esc(node.path)}</div>
              </td>
              <td class="py-2 text-right">
                <span class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder text-[10px]">${esc(node.sort_order ?? 50)}</span>
              </td>
              <td class="py-2 text-right">
                <button data-act="up" data-id="${esc(node.id)}" class="px-2 py-1 rounded-lg text-[10px] border border-slate-200 dark:border-darkBorder hover:bg-slate-100 dark:hover:bg-white/5">↑</button>
                <button data-act="down" data-id="${esc(node.id)}" class="px-2 py-1 rounded-lg text-[10px] border border-slate-200 dark:border-darkBorder hover:bg-slate-100 dark:hover:bg-white/5">↓</button>
                <button data-act="edit" data-id="${esc(node.id)}" class="px-2 py-1 rounded-lg text-[10px] bg-slate-900 text-white dark:bg-white dark:text-slate-900">Edit</button>
              </td>
            </tr>
          `;
        }).join("");

        rowsEl.querySelectorAll("button[data-act]").forEach(btn=>{
          btn.addEventListener("click", async ()=>{
            const act = btn.getAttribute("data-act");
            const id = btn.getAttribute("data-id");

            if(act==="up" || act==="down"){
              const r = await reorder(id, act);
              if(r.status!=="ok") return toast("Reorder failed: "+r.status);
              await refresh();
              return;
            }

            if(act==="edit"){
              openEdit(id);
            }
          });
        });
      }

      function openEdit(id){
        const m = allMenus.find(x=>String(x.id)===String(id));
        if(!m) return;

        editId = id;
        $("#m_hint").textContent = m.path || "/";
        $("#m_label").value = m.label || "";
        $("#m_code").value = m.code || "";
        $("#m_path").value = m.path || "";
        $("#m_sort").value = Number(m.sort_order ?? 50);
        $("#m_icon").value = m.icon || "";
        $("#m_parent").innerHTML = optionParents(allMenus, id);

        // set selected
        const pid = m.parent_id ? String(m.parent_id) : "";
        $("#m_parent").value = pid;

        modal.classList.remove("hidden");
      }

      function closeEdit(){
        modal.classList.add("hidden");
        editId = null;
      }

      async function refresh(){
        const r = await loadMenus();
        if(r.status!=="ok"){
          rowsEl.innerHTML = `<tr><td class="py-3 text-red-400 text-xs" colspan="4">Failed: ${esc(r.status)}</td></tr>`;
          return;
        }
        allMenus = r.data.menus || [];
        const tree = buildTree(allMenus);
        flat = flattenTree(tree);

        renderParents();
        renderTable();
      }

      // events
      $("#btnReload").onclick = refresh;
      $("#q").addEventListener("input", renderTable);

      $("#f_icon").addEventListener("input", renderIconPreview);
      renderIconPreview();

      $("#btnCreate").onclick = async ()=>{
        const label = ($("#f_label").value||"").trim();
        const code = ($("#f_code").value||"").trim();
        const path = normPath($("#f_path").value||"");
        const parent_id = ($("#f_parent").value||"").trim() || null;
        const sort_order = Number($("#f_sort").value||50);
        const icon = ($("#f_icon").value||"").trim() || null;

        if(label.length<2) return toast("Label minimal 2 karakter");
        if(code.length<2) return toast("Code minimal 2 karakter");
        if(!path.startsWith("/")) return toast("Path harus diawali /");

        const r = await createMenu({ label, code, path, parent_id, sort_order, icon });
        if(r.status!=="ok") return toast("Create failed: "+r.status+(r.data?.message?(" ("+r.data.message+")"):""));
        toast("Created");
        $("#f_label").value=""; $("#f_code").value=""; $("#f_path").value=""; $("#f_parent").value=""; $("#f_sort").value=50; $("#f_icon").value="";
        renderIconPreview();
        await refresh();

        // refresh nav in memory
        try{
          const nav = await Orland.api("/api/nav");
          if(nav.status==="ok"){ Orland.state.nav = nav.data; Orland.renderNav(Orland.state.path||"/dashboard"); }
        }catch{}
      };

      $("#m_close").onclick = closeEdit;

      $("#m_save").onclick = async ()=>{
        if(!editId) return;
        const payload = {
          id: editId,
          label: ($("#m_label").value||"").trim(),
          code: ($("#m_code").value||"").trim(),
          path: normPath($("#m_path").value||""),
          parent_id: ($("#m_parent").value||"").trim(),
          sort_order: Number($("#m_sort").value||50),
          icon: ($("#m_icon").value||"").trim()
        };
        if(!payload.label) return toast("Label required");
        if(!payload.code) return toast("Code required");
        if(!payload.path.startsWith("/")) return toast("Path invalid");

        if(payload.parent_id==="") payload.parent_id = null;
        if(payload.icon==="") payload.icon = null;

        const r = await updateMenu(payload);
        if(r.status!=="ok") return toast("Save failed: "+r.status+(r.data?.message?(" ("+r.data.message+")"):""));
        toast("Saved");
        closeEdit();
        await refresh();

        try{
          const nav = await Orland.api("/api/nav");
          if(nav.status==="ok"){ Orland.state.nav = nav.data; Orland.renderNav(Orland.state.path||"/dashboard"); }
        }catch{}
      };

      $("#m_delete").onclick = async ()=>{
        if(!editId) return;
        if(!confirm("Delete menu ini? (Jika punya children akan ditolak)")) return;

        const r = await delMenu(editId);
        if(r.status!=="ok") return toast("Delete failed: "+r.status+(r.data?.message?(" ("+r.data.message+")"):""));
        toast("Deleted");
        closeEdit();
        await refresh();

        try{
          const nav = await Orland.api("/api/nav");
          if(nav.status==="ok"){ Orland.state.nav = nav.data; Orland.renderNav(Orland.state.path||"/dashboard"); }
        }catch{}
      };

      // initial
      await refresh();
    }
  };
}
