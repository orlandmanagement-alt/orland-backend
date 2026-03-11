export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function apiLoad(roleId=""){
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
    const sa = Number(a.sort_order ?? 9999);
    const sb = Number(b.sort_order ?? 9999);
    if(sa !== sb) return sa - sb;
    return Number(a.created_at ?? 0) - Number(b.created_at ?? 0);
  }

  function buildTree(items){
    const byId = new Map();
    const roots = [];

    for(const row of (items || [])){
      byId.set(String(row.id), {
        id: String(row.id),
        code: row.code || "",
        label: row.label || row.code || row.path || "Menu",
        path: row.path || "",
        parent_id: row.parent_id ? String(row.parent_id) : null,
        parent_label: row.parent_label || "",
        icon: row.icon || "fa-solid fa-circle-dot",
        sort_order: Number(row.sort_order ?? 9999),
        created_at: Number(row.created_at ?? 0),
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
        walk(x.children);
      }
    };
    walk(roots);

    return roots;
  }

  function flattenTree(nodes, out = []){
    for(const n of nodes){
      out.push(n);
      flattenTree(n.children || [], out);
    }
    return out;
  }

  return {
    title: "RBAC Manager",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-6xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">RBAC Manager</div>
            <div class="text-slate-500 mt-1">Atur role_menus dengan tree menu dari database.</div>

            <div class="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-3">
              <select id="roleSelect" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold"></select>
              <button id="btnCheckAll" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Check all</button>
              <button id="btnUncheckAll" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Uncheck all</button>
              <button id="btnSave" class="px-5 py-3 rounded-2xl bg-primary text-white font-black text-sm">Save</button>
            </div>

            <div class="mt-4">
              <input id="qSearch" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari label / path / code">
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Role Menus</div>
            <div class="text-slate-500 text-sm mt-1">Checklist parent-child otomatis cascade.</div>
            <div id="menuBox" class="mt-5 space-y-3"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      let ROLES = [];
      let MENUS = [];
      let TREE = [];
      let CHECKED = new Set();
      let ACTIVE_ROLE = "";

      function setMsg(kind, text){
        const el = q("msg");
        el.className = "mt-4 text-sm";
        if(kind === "error") el.classList.add("text-red-500");
        else if(kind === "success") el.classList.add("text-emerald-600");
        else el.classList.add("text-slate-500");
        el.textContent = text;
      }

      function toggleNode(node, checked){
        if(checked) CHECKED.add(node.id);
        else CHECKED.delete(node.id);

        for(const ch of (node.children || [])){
          toggleNode(ch, checked);
        }
      }

      function updateParentState(){
        const flat = flattenTree(TREE, []);
        const byId = new Map(flat.map(x => [x.id, x]));

        for(let i = flat.length - 1; i >= 0; i--){
          const item = flat[i];
          if(!item.children || !item.children.length) continue;

          const childIds = item.children.map(x => x.id);
          const allChecked = childIds.length > 0 && childIds.every(id => CHECKED.has(id));

          if(allChecked) CHECKED.add(item.id);
          else CHECKED.delete(item.id);
        }

        for(const item of flat){
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

      function renderRoleSelect(){
        q("roleSelect").innerHTML = ROLES.map(r => `
          <option value="${esc(r.id)}">${esc(r.name)}</option>
        `).join("");

        if(ACTIVE_ROLE) q("roleSelect").value = ACTIVE_ROLE;
      }

      function renderTree(nodes, depth = 0){
        const kw = String(q("qSearch").value || "").trim().toLowerCase();

        const matches = (node)=>{
          const hay = [node.label, node.code, node.path, node.parent_label].join(" ").toLowerCase();
          if(hay.includes(kw)) return true;
          return (node.children || []).some(matches);
        };

        return nodes.filter(node => !kw || matches(node)).map(node => {
          const checked = CHECKED.has(node.id);
          const hasChildren = Array.isArray(node.children) && node.children.length > 0;

          return `
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder overflow-hidden">
              <label class="flex items-start gap-3 px-4 py-3 ${depth === 0 ? "bg-slate-50 dark:bg-black/10" : "bg-white dark:bg-darkLighter"}">
                <input class="menuCheck mt-1" type="checkbox" data-id="${esc(node.id)}" ${checked ? "checked" : ""}>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <i class="${esc(node.icon)} text-slate-400"></i>
                    <span class="font-black text-sm">${esc(node.label)}</span>
                  </div>
                  <div class="text-xs text-slate-500 mt-1 break-all">
                    ${esc(node.path || "-")} • ${esc(node.code || "-")}
                  </div>
                </div>
              </label>
              ${hasChildren ? `<div class="pl-6 border-t border-slate-200 dark:border-darkBorder">${renderTree(node.children, depth + 1)}</div>` : ``}
            </div>
          `;
        }).join("");
      }

      function bindChecks(){
        const flat = flattenTree(TREE, []);
        const byId = new Map(flat.map(x => [x.id, x]));

        q("menuBox").querySelectorAll(".menuCheck").forEach(el => {
          el.onchange = ()=>{
            const id = String(el.getAttribute("data-id") || "");
            const node = byId.get(id);
            if(!node) return;

            toggleNode(node, !!el.checked);
            updateParentState();
            renderMenus();
          };
        });
      }

      function renderMenus(){
        if(!TREE.length){
          q("menuBox").innerHTML = emptyState("No menu data.");
          return;
        }

        q("menuBox").innerHTML = renderTree(TREE, 0) || emptyState("No matched menu.");
        bindChecks();
      }

      async function load(roleId = ""){
        setMsg("muted", "Loading...");
        const r = await apiLoad(roleId);

        if(r.status !== "ok"){
          setMsg("error", "Failed: " + r.status);
          return;
        }

        ROLES = Array.isArray(r.data?.roles) ? r.data.roles : [];
        MENUS = Array.isArray(r.data?.menus) ? r.data.menus : [];
        CHECKED = new Set((Array.isArray(r.data?.menu_ids) ? r.data.menu_ids : []).map(String));

        if(!ACTIVE_ROLE){
          ACTIVE_ROLE = roleId || (ROLES[0]?.id || "");
        }else if(roleId){
          ACTIVE_ROLE = roleId;
        }

        TREE = buildTree(MENUS);
        updateParentState();
        renderRoleSelect();
        renderMenus();
        setMsg("success", "Loaded.");
      }

      q("roleSelect").onchange = async ()=>{
        ACTIVE_ROLE = q("roleSelect").value;
        await load(ACTIVE_ROLE);
      };

      q("btnCheckAll").onclick = ()=>{
        const flat = flattenTree(TREE, []);
        CHECKED = new Set(flat.map(x => x.id));
        renderMenus();
      };

      q("btnUncheckAll").onclick = ()=>{
        CHECKED = new Set();
        renderMenus();
      };

      q("qSearch").oninput = renderMenus;

      q("btnSave").onclick = async ()=>{
        if(!ACTIVE_ROLE){
          setMsg("error", "Role belum dipilih.");
          return;
        }

        setMsg("muted", "Saving...");
        const r = await apiSave({
          role_id: ACTIVE_ROLE,
          menu_ids: Array.from(CHECKED)
        });

        if(r.status !== "ok"){
          setMsg("error", "Save failed: " + r.status);
          return;
        }

        setMsg("success", "RBAC saved.");
        await load(ACTIVE_ROLE);
      };

      await load("");
    }
  };
}
