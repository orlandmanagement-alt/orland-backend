export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function apiLoad(){
    return await Orland.api("/api/menus");
  }

  async function apiSave(payload){
    return await Orland.api("/api/menus", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function apiDelete(payload){
    return await Orland.api("/api/menus", {
      method: "POST",
      body: JSON.stringify({ action: "delete", ...payload })
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

  function normPath(p){
    p = String(p || "").trim();
    if(!p) return "/";
    if(!p.startsWith("/")) p = "/" + p;
    p = p.replace(/\/+/g, "/").replace(/\/+$/,"");
    return p || "/";
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

  function countChildrenMap(items){
    const map = new Map();
    for(const row of (items || [])){
      const pid = row.parent_id ? String(row.parent_id) : "";
      if(!pid) continue;
      map.set(pid, Number(map.get(pid) || 0) + 1);
    }
    return map;
  }

  function defaultNewId(){
    return "menu_" + Date.now();
  }

  return {
    title: "Main Menu",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">Main Menu</div>
                <div class="text-slate-500 mt-1">List manager untuk menu, parent-child, dan role mapping.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnOpenBuilder" class="px-5 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">
                  <i class="fa-solid fa-sitemap mr-2"></i>Open Menu Builder
                </button>
                <button id="btnNew" class="px-5 py-3 rounded-2xl bg-primary text-white font-black">
                  <i class="fa-solid fa-plus mr-2"></i>Create New
                </button>
                <button id="btnReload" class="px-5 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
              </div>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>

            <div class="grid md:grid-cols-4 gap-4 mt-5">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-slate-500 text-xs font-bold">TOTAL MENUS</div>
                <div id="statTotal" class="text-2xl font-extrabold mt-1">0</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-slate-500 text-xs font-bold">ROOT MENUS</div>
                <div id="statRoots" class="text-2xl font-extrabold mt-1">0</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-slate-500 text-xs font-bold">CHILD MENUS</div>
                <div id="statChildren" class="text-2xl font-extrabold mt-1">0</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-slate-500 text-xs font-bold">ROLES</div>
                <div id="statRoles" class="text-2xl font-extrabold mt-1">0</div>
              </div>
            </div>
          </div>

          <div id="editorWrap" class="hidden rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div id="editorTitle" class="text-xl font-extrabold">Menu Form</div>
                <div class="text-slate-500 text-sm mt-1">Create atau update menu dengan role menus.</div>
              </div>
              <button id="btnCloseEditor" class="px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-bold text-sm">
                Close
              </button>
            </div>

            <form id="menuForm" class="mt-5 space-y-4">
              <input type="hidden" name="mode" value="create">

              <div class="grid md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">ID</label>
                  <input name="id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold" placeholder="menu_..." />
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">CODE</label>
                  <input name="code" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold" placeholder="users / rbac / menu_builder" />
                </div>
              </div>

              <div class="grid md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">LABEL</label>
                  <input name="label" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold" placeholder="Menu Label" />
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">PATH</label>
                  <input name="path" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold" placeholder="/menus" />
                </div>
              </div>

              <div class="grid md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">PARENT</label>
                  <select name="parent_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold"></select>
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">SORT ORDER</label>
                  <input name="sort_order" type="number" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold" value="50" />
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">ICON</label>
                  <input name="icon" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold" placeholder="fa-solid fa-circle-dot" />
                </div>
              </div>

              <div>
                <div class="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <label class="block text-sm font-bold text-slate-500">ROLE MENUS</label>
                  <div class="flex gap-2 flex-wrap">
                    <button type="button" id="btnRolesAll" class="px-3 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-bold text-xs">Check all</button>
                    <button type="button" id="btnRolesNone" class="px-3 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-bold text-xs">Uncheck all</button>
                  </div>
                </div>
                <div id="rolesBox" class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 grid md:grid-cols-3 gap-3"></div>
              </div>

              <div class="flex gap-3 flex-wrap pt-2">
                <button type="submit" class="px-5 py-3 rounded-2xl bg-primary text-white font-black">
                  <i class="fa-solid fa-floppy-disk mr-2"></i>Save
                </button>
                <button type="button" id="btnResetForm" class="px-5 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">
                  Reset
                </button>
              </div>
            </form>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-xl font-extrabold">Menu List</div>
                <div class="text-slate-500 text-sm mt-1">Tabel menu terurut dari database.</div>
              </div>
              <div class="flex gap-3 flex-wrap">
                <input id="qSearch" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold" placeholder="Search label / code / path / id" />
                <select id="filterKind" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-bold">
                  <option value="all">All</option>
                  <option value="root">Root only</option>
                  <option value="child">Child only</option>
                </select>
              </div>
            </div>

            <div id="tableWrap" class="mt-5 overflow-x-auto"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      const form = ()=>q("menuForm");

      let ROLES = [];
      let MENUS = [];
      let TREE = [];
      let FLAT = [];
      let CHILD_COUNT = new Map();

      function setMsg(kind, text){
        const el = q("msg");
        el.className = "mt-4 text-sm";
        if(kind === "error") el.classList.add("text-red-500");
        else if(kind === "success") el.classList.add("text-emerald-600");
        else el.classList.add("text-slate-500");
        el.textContent = text;
      }

      function openEditor(){
        q("editorWrap").classList.remove("hidden");
      }

      function closeEditor(){
        q("editorWrap").classList.add("hidden");
      }

      function renderStats(){
        const total = MENUS.length;
        const roots = MENUS.filter(x => !x.parent_id).length;
        const children = total - roots;
        q("statTotal").textContent = String(total);
        q("statRoots").textContent = String(roots);
        q("statChildren").textContent = String(children);
        q("statRoles").textContent = String(ROLES.length);
      }

      function renderParentOptions(selectedId = "", selfId = ""){
        const rows = FLAT.filter(x => String(x.id) !== String(selfId));
        form().parent_id.innerHTML = `
          <option value="">(root)</option>
          ${rows.map(row => `
            <option value="${esc(row.id)}" ${String(selectedId) === String(row.id) ? "selected" : ""}>
              ${esc("— ".repeat(row._depth) + row.label)}
            </option>
          `).join("")}
        `;
      }

      function renderRoles(selectedRoles){
        const picked = new Set((selectedRoles || []).map(String));
        q("rolesBox").innerHTML = (ROLES || []).map(r => `
          <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
            <input type="checkbox" name="roles" value="${esc(r.name)}" ${picked.has(r.name) ? "checked" : ""}>
            <div>
              <div class="font-black text-sm">${esc(r.name)}</div>
              <div class="text-xs text-slate-500">${esc(r.id)}</div>
            </div>
          </label>
        `).join("") || `<div class="text-sm text-slate-500">No roles.</div>`;
      }

      function checkedRoles(){
        return Array.from(host.querySelectorAll('input[name="roles"]:checked'))
          .map(el => String(el.value || "").trim())
          .filter(Boolean);
      }

      function fillCreate(){
        q("editorTitle").textContent = "Create Menu";
        form().mode.value = "create";
        form().id.value = defaultNewId();
        form().id.readOnly = false;
        form().id.classList.remove("opacity-70");
        form().code.value = "";
        form().label.value = "";
        form().path.value = "/";
        form().parent_id.value = "";
        form().sort_order.value = "50";
        form().icon.value = "fa-solid fa-circle-dot";
        renderParentOptions("", "");
        renderRoles(ROLES.map(x => x.name));
        openEditor();
      }

      function fillEdit(row){
        q("editorTitle").textContent = "Edit Menu";
        form().mode.value = "update";
        form().id.value = row.id || "";
        form().id.readOnly = true;
        form().id.classList.add("opacity-70");
        form().code.value = row.code || "";
        form().label.value = row.label || "";
        form().path.value = row.path || "/";
        form().sort_order.value = String(row.sort_order ?? 50);
        form().icon.value = row.icon || "";
        renderParentOptions(row.parent_id || "", row.id || "");
        renderRoles(Array.isArray(row.role_names) ? row.role_names : []);
        openEditor();
      }

      function filteredRows(){
        const keyword = String(q("qSearch").value || "").trim().toLowerCase();
        const kind = String(q("filterKind").value || "all");

        return FLAT.filter(row => {
          if(kind === "root" && row.parent_id) return false;
          if(kind === "child" && !row.parent_id) return false;

          if(!keyword) return true;

          const hay = [
            row.id,
            row.code,
            row.label,
            row.path,
            row.parent_id,
            ...(row.role_names || [])
          ].join(" ").toLowerCase();

          return hay.includes(keyword);
        });
      }

      function renderTable(){
        const rows = filteredRows();

        if(!rows.length){
          q("tableWrap").innerHTML = `<div class="text-sm text-slate-500">No matching menu data.</div>`;
          return;
        }

        q("tableWrap").innerHTML = `
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left border-b border-slate-200 dark:border-darkBorder">
                <th class="px-4 py-3 font-black">MENU</th>
                <th class="px-4 py-3 font-black">PATH</th>
                <th class="px-4 py-3 font-black">ROLES</th>
                <th class="px-4 py-3 font-black text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr class="border-b border-slate-100 dark:border-darkBorder/60">
                  <td class="px-4 py-4 align-top">
                    <div class="flex items-start gap-3">
                      <div class="text-slate-400 pt-0.5">
                        <i class="${esc(row.icon || "fa-solid fa-circle-dot")}"></i>
                      </div>
                      <div class="min-w-0">
                        <div class="font-black text-base">${esc("— ".repeat(row._depth) + row.label)}</div>
                        <div class="text-slate-500 mt-1 break-all">
                          ${esc(row.code)} • ${esc(row.id)} • sort ${esc(row.sort_order)}
                        </div>
                        <div class="text-xs text-slate-400 mt-1">
                          ${row.parent_id ? `parent ${esc(row.parent_id)}` : "root"} • children ${esc(CHILD_COUNT.get(String(row.id)) || 0)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-4 align-top">
                    <div class="font-bold">${esc(row.path || "/")}</div>
                  </td>
                  <td class="px-4 py-4 align-top">
                    <div class="flex flex-wrap gap-2">
                      ${(row.role_names || []).map(name => `
                        <span class="px-3 py-1 rounded-full bg-slate-100 dark:bg-black/20 text-xs font-bold">
                          ${esc(name)}
                        </span>
                      `).join("") || `<span class="text-slate-400 text-xs">No roles</span>`}
                    </div>
                  </td>
                  <td class="px-4 py-4 align-top">
                    <div class="flex justify-end gap-2 flex-wrap">
                      <button class="btnEdit px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-black" data-id="${esc(row.id)}">
                        Edit
                      </button>
                      <button class="btnDelete px-4 py-2 rounded-2xl border border-red-200 text-red-600 font-black" data-id="${esc(row.id)}">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;

        q("tableWrap").querySelectorAll(".btnEdit").forEach(btn => {
          btn.onclick = ()=>{
            const id = String(btn.getAttribute("data-id") || "");
            const row = MENUS.find(x => String(x.id) === id);
            if(!row) return;
            fillEdit(row);
          };
        });

        q("tableWrap").querySelectorAll(".btnDelete").forEach(btn => {
          btn.onclick = async ()=>{
            const id = String(btn.getAttribute("data-id") || "");
            const row = MENUS.find(x => String(x.id) === id);
            if(!row) return;

            const ok = confirm(`Delete menu "${row.label}"?`);
            if(!ok) return;

            setMsg("muted", "Deleting...");
            const r = await apiDelete({ id });

            if(r.status !== "ok"){
              const err = r.data?.error || r.status || "delete_failed";
              setMsg("error", "Delete failed: " + err);
              return;
            }

            setMsg("success", "Menu deleted.");
            await load();
            closeEditor();
          };
        });
      }

      async function load(){
        setMsg("muted", "Loading...");
        const r = await apiLoad();

        if(r.status !== "ok"){
          setMsg("error", "Failed: " + r.status);
          return;
        }

        ROLES = Array.isArray(r.data?.roles) ? r.data.roles : [];
        MENUS = Array.isArray(r.data?.menus) ? r.data.menus.slice().sort(bySort) : [];
        TREE = buildTree(MENUS);
        FLAT = flattenTree(TREE, 0, []);
        CHILD_COUNT = countChildrenMap(MENUS);

        renderStats();
        renderTable();
        setMsg("success", "Loaded.");
      }

      q("btnOpenBuilder").onclick = ()=>{
        if(typeof Orland.go === "function"){
          Orland.go("/menu-builder");
          return;
        }
        location.hash = "#/menu-builder";
      };

      q("btnNew").onclick = ()=>{
        fillCreate();
      };

      q("btnReload").onclick = async ()=>{
        await load();
      };

      q("btnCloseEditor").onclick = ()=>{
        closeEditor();
      };

      q("btnResetForm").onclick = ()=>{
        if(form().mode.value === "update"){
          const row = MENUS.find(x => String(x.id) === String(form().id.value || ""));
          if(row) fillEdit(row);
          return;
        }
        fillCreate();
      };

      q("btnRolesAll").onclick = ()=>{
        host.querySelectorAll('input[name="roles"]').forEach(el => {
          el.checked = true;
        });
      };

      q("btnRolesNone").onclick = ()=>{
        host.querySelectorAll('input[name="roles"]').forEach(el => {
          el.checked = false;
        });
      };

      q("qSearch").oninput = ()=>{
        renderTable();
      };

      q("filterKind").onchange = ()=>{
        renderTable();
      };

      form().onsubmit = async (ev)=>{
        ev.preventDefault();

        const payload = {
          action: String(form().mode.value || "create").trim(),
          mode: String(form().mode.value || "create").trim(),
          id: String(form().id.value || "").trim(),
          code: String(form().code.value || "").trim(),
          label: String(form().label.value || "").trim(),
          path: normPath(form().path.value || "/"),
          parent_id: String(form().parent_id.value || "").trim() || null,
          sort_order: Number(form().sort_order.value || 50),
          icon: String(form().icon.value || "").trim(),
          roles: checkedRoles()
        };

        setMsg("muted", "Saving...");
        const r = await apiSave(payload);

        if(r.status !== "ok"){
          const err = r.data?.error || r.data?.message || r.status || "save_failed";
          setMsg("error", "Save failed: " + err);
          return;
        }

        setMsg("success", "Menu saved.");
        await load();

        const saved = MENUS.find(x => String(x.id) === String(payload.id));
        if(saved) fillEdit(saved);
      };

      closeEditor();
      await load();
    }
  };
}
