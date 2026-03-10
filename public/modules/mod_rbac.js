export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function apiLoad(roleId = ""){
    const q = roleId ? ("?role_id=" + encodeURIComponent(roleId)) : "";
    return await Orland.api("/api/rbac" + q);
  }

  async function apiSave(payload){
    return await Orland.api("/api/rbac", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  function bySort(a, b){
    const sa = Number(a.sort_order ?? 999999);
    const sb = Number(b.sort_order ?? 999999);
    if(sa !== sb) return sa - sb;

    const ca = Number(a.created_at ?? 0);
    const cb = Number(b.created_at ?? 0);
    if(ca !== cb) return ca - cb;

    return String(a.label || "").localeCompare(String(b.label || ""));
  }

  function buildTree(items){
    const byId = new Map();
    const roots = [];

    for(const row of (items || [])){
      byId.set(String(row.id), {
        id: String(row.id),
        code: row.code || "",
        label: row.label || row.code || row.path || "Menu",
        path: row.path || "/",
        parent_id: row.parent_id ? String(row.parent_id) : null,
        icon: row.icon || "fa-solid fa-circle-dot",
        sort_order: Number(row.sort_order ?? 50),
        created_at: Number(row.created_at ?? 0),
        role_names: Array.isArray(row.role_names) ? row.role_names : [],
        children: []
      });
    }

    for(const item of byId.values()){
      if(item.parent_id && byId.has(item.parent_id)){
        byId.get(item.parent_id).children.push(item);
      }else{
        roots.push(item);
      }
    }

    const walk = (arr)=>{
      arr.sort(bySort);
      for(const x of arr){
        walk(x.children || []);
      }
    };
    walk(roots);

    return roots;
  }

  function flattenTree(nodes, depth = 0, out = []){
    for(const n of (nodes || [])){
      out.push({ ...n, _depth: depth });
      flattenTree(n.children || [], depth + 1, out);
    }
    return out;
  }

  return {
    title: "RBAC Manager",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">RBAC Manager</div>
                <div class="text-slate-500 mt-1">Assign menu access per role melalui tabel role_menus.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnSave" class="px-5 py-3 rounded-2xl bg-primary text-white font-black">
                  <i class="fa-solid fa-floppy-disk mr-2"></i>Save
                </button>
                <button id="btnReload" class="px-5 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
              </div>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>

            <div class="grid md:grid-cols-4 gap-4 mt-5">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-slate-500 text-xs font-bold">ROLES</div>
                <div id="statRoles" class="text-2xl font-extrabold mt-1">0</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-slate-500 text-xs font-bold">MENUS</div>
                <div id="statMenus" class="text-2xl font-extrabold mt-1">0</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-slate-500 text-xs font-bold">CHECKED</div>
                <div id="statChecked" class="text-2xl font-extrabold mt-1">0</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-slate-500 text-xs font-bold">ACTIVE ROLE</div>
                <div id="statRoleName" class="text-lg font-extrabold mt-1">-</div>
              </div>
            </div>

            <div class="grid md:grid-cols-2 gap-4 mt-5">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">ROLE</label>
                <select id="roleSelect" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold"></select>
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">SEARCH MENU</label>
                <input id="qSearch" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold" placeholder="Search label / code / path / id" />
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-xl font-extrabold">Role Menus</div>
                <div class="text-slate-500 text-sm mt-1">Checklist parent-child menu dari database.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnCheckAll" class="px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-bold text-sm">Check all</button>
                <button id="btnUncheckAll" class="px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-bold text-sm">Uncheck all</button>
                <button id="btnExpandAll" class="px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-bold text-sm">Expand all</button>
                <button id="btnCollapseAll" class="px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-bold text-sm">Collapse all</button>
              </div>
            </div>

            <div id="menuBox" class="mt-5 space-y-3"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      let ROLES = [];
      let MENUS = [];
      let TREE = [];
      let FLAT = [];
      let CHECKED = new Set();
      let OPEN = new Set();
      let ACTIVE_ROLE = "";

      function setMsg(kind, text){
        const el = q("msg");
        el.className = "mt-4 text-sm";
        if(kind === "error") el.classList.add("text-red-500");
        else if(kind === "success") el.classList.add("text-emerald-600");
        else el.classList.add("text-slate-500");
        el.textContent = text;
      }

      function getRoleName(roleId){
        return ROLES.find(x => String(x.id) === String(roleId))?.name || "-";
      }

      function refreshStats(){
        q("statRoles").textContent = String(ROLES.length);
        q("statMenus").textContent = String(FLAT.length);
        q("statChecked").textContent = String(CHECKED.size);
        q("statRoleName").textContent = getRoleName(ACTIVE_ROLE);
      }

      function renderRoleSelect(){
        q("roleSelect").innerHTML = ROLES.map(r => `
          <option value="${esc(r.id)}">${esc(r.name)}</option>
        `).join("");

        if(ACTIVE_ROLE){
          q("roleSelect").value = ACTIVE_ROLE;
        }
      }

      function toggleNode(node, checked){
        if(checked) CHECKED.add(node.id);
        else CHECKED.delete(node.id);

        for(const ch of (node.children || [])){
          toggleNode(ch, checked);
        }
      }

      function syncParentState(){
        const byId = new Map(FLAT.map(x => [x.id, x]));

        for(let i = FLAT.length - 1; i >= 0; i--){
          const item = FLAT[i];
          if(!item.children || !item.children.length) continue;

          const childIds = item.children.map(x => x.id);
          const allChecked = childIds.length > 0 && childIds.every(id => CHECKED.has(id));

          if(allChecked) CHECKED.add(item.id);
          else CHECKED.delete(item.id);
        }

        for(const item of FLAT){
          if(item.parent_id && CHECKED.has(item.id)){
            const p = byId.get(item.parent_id);
            if(p){
              const siblings = (p.children || []).map(x => x.id);
              if(siblings.length && siblings.every(id => CHECKED.has(id))){
                CHECKED.add(p.id);
              }
            }
          }
        }
      }

      function filteredRoots(){
        const keyword = String(q("qSearch").value || "").trim().toLowerCase();
        if(!keyword) return TREE;

        function nodeMatches(node){
          const hay = [
            node.id,
            node.code,
            node.label,
            node.path,
            ...(node.role_names || [])
          ].join(" ").toLowerCase();
          if(hay.includes(keyword)) return true;
          return (node.children || []).some(nodeMatches);
        }

        function cloneFiltered(node){
          const matched = nodeMatches(node);
          if(!matched) return null;

          const kids = (node.children || [])
            .map(cloneFiltered)
            .filter(Boolean);

          return { ...node, children: kids };
        }

        return TREE.map(cloneFiltered).filter(Boolean);
      }

      function renderTree(nodes, depth = 0){
        return nodes.map(node => {
          const hasChildren = Array.isArray(node.children) && node.children.length > 0;
          const checked = CHECKED.has(node.id);
          const isOpen = OPEN.has(node.id) || depth === 0;
          const roleCount = Array.isArray(node.role_names) ? node.role_names.length : 0;

          return `
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder overflow-hidden">
              <div class="flex items-start gap-3 px-4 py-3 ${depth === 0 ? "bg-slate-50 dark:bg-black/10" : "bg-white dark:bg-darkLighter"}">
                ${hasChildren ? `
                  <button class="toggleOpen mt-0.5 text-slate-500" data-id="${esc(node.id)}" type="button">
                    <i class="fa-solid ${isOpen ? "fa-chevron-down" : "fa-chevron-right"}"></i>
                  </button>
                ` : `
                  <div class="w-4"></div>
                `}
                <input class="menuCheck mt-1" type="checkbox" data-id="${esc(node.id)}" ${checked ? "checked" : ""}>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <i class="${esc(node.icon || "fa-solid fa-circle-dot")} text-slate-400"></i>
                    <span class="font-black text-sm">${esc(node.label)}</span>
                  </div>
                  <div class="text-xs text-slate-500 mt-1 break-all">
                    ${esc(node.code || "-")} • ${esc(node.path || "-")} • roles ${esc(roleCount)}
                  </div>
                </div>
              </div>

              ${hasChildren && isOpen ? `
                <div class="pl-6 border-t border-slate-200 dark:border-darkBorder">
                  ${renderTree(node.children, depth + 1)}
                </div>
              ` : ""}
            </div>
          `;
        }).join("");
      }

      function bindMenuEvents(){
        const byId = new Map(FLAT.map(x => [x.id, x]));

        q("menuBox").querySelectorAll(".menuCheck").forEach(el => {
          el.onchange = ()=>{
            const id = String(el.getAttribute("data-id") || "");
            const node = byId.get(id);
            if(!node) return;

            toggleNode(node, !!el.checked);
            syncParentState();
            renderMenus();
          };
        });

        q("menuBox").querySelectorAll(".toggleOpen").forEach(el => {
          el.onclick = ()=>{
            const id = String(el.getAttribute("data-id") || "");
            if(OPEN.has(id)) OPEN.delete(id);
            else OPEN.add(id);
            renderMenus();
          };
        });
      }

      function renderMenus(){
        const roots = filteredRoots();

        if(!roots.length){
          q("menuBox").innerHTML = `<div class="text-sm text-slate-500">No menu data.</div>`;
          refreshStats();
          return;
        }

        q("menuBox").innerHTML = renderTree(roots, 0);
        bindMenuEvents();
        refreshStats();
      }

      async function load(roleId = ""){
        setMsg("muted", "Loading...");
        const r = await apiLoad(roleId);

        if(r.status !== "ok"){
          setMsg("error", "Failed: " + r.status);
          return;
        }

        ROLES = Array.isArray(r.data?.roles) ? r.data.roles : [];
        MENUS = Array.isArray(r.data?.menus) ? r.data.menus.slice().sort(bySort) : [];
        TREE = buildTree(MENUS);
        FLAT = flattenTree(TREE, 0, []);
        CHECKED = new Set((Array.isArray(r.data?.menu_ids) ? r.data.menu_ids : []).map(String));

        if(!ACTIVE_ROLE){
          ACTIVE_ROLE = roleId || (ROLES[0]?.id || "");
        }

        syncParentState();
        renderRoleSelect();
        renderMenus();
        setMsg("success", "Loaded.");
      }

      q("roleSelect").onchange = async ()=>{
        ACTIVE_ROLE = String(q("roleSelect").value || "");
        await load(ACTIVE_ROLE);
      };

      q("qSearch").oninput = ()=>{
        renderMenus();
      };

      q("btnReload").onclick = async ()=>{
        await load(ACTIVE_ROLE);
      };

      q("btnCheckAll").onclick = ()=>{
        CHECKED = new Set(FLAT.map(x => x.id));
        renderMenus();
      };

      q("btnUncheckAll").onclick = ()=>{
        CHECKED = new Set();
        renderMenus();
      };

      q("btnExpandAll").onclick = ()=>{
        OPEN = new Set(FLAT.filter(x => (x.children || []).length > 0).map(x => x.id));
        renderMenus();
      };

      q("btnCollapseAll").onclick = ()=>{
        OPEN = new Set();
        renderMenus();
      };

      q("btnSave").onclick = async ()=>{
        if(!ACTIVE_ROLE){
          setMsg("error", "Role belum dipilih.");
          return;
        }

        setMsg("muted", "Saving...");
        const payload = {
          role_id: ACTIVE_ROLE,
          menu_ids: Array.from(CHECKED)
        };

        const r = await apiSave(payload);
        if(r.status !== "ok"){
          const err = r.data?.error || r.status || "save_failed";
          setMsg("error", "Save failed: " + err);
          return;
        }

        setMsg("success", "RBAC saved.");
        await load(ACTIVE_ROLE);
      };

      await load("");
    }
  };
}
