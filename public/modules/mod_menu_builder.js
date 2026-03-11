export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function apiLoad(){
    return await Orland.api("/api/menus");
  }

  async function apiPost(payload){
    return await Orland.api("/api/menus", {
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

  function getDefaultNewId(){
    return "menu_" + Date.now();
  }

  return {
    title: "Menu Builder",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4 lg:p-5 max-w-5xl">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-xl lg:text-2xl font-extrabold">Menu Builder</div>
                <div class="text-slate-500 mt-1 text-sm">Manage menu, sort, parent-child, dan role menus.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnNew" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">
                  <i class="fa-solid fa-plus mr-2"></i>New
                </button>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-[11px] font-bold text-slate-500">TOTAL</div>
                <div id="statTotal" class="text-xl font-extrabold mt-1">0</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-[11px] font-bold text-slate-500">ROOT</div>
                <div id="statRoot" class="text-xl font-extrabold mt-1">0</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-[11px] font-bold text-slate-500">CHILD</div>
                <div id="statChild" class="text-xl font-extrabold mt-1">0</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-[11px] font-bold text-slate-500">ROLES</div>
                <div id="statRoles" class="text-xl font-extrabold mt-1">0</div>
              </div>
            </div>

            <div class="mt-4 flex flex-col lg:flex-row gap-3">
              <input id="qSearch" class="w-full lg:max-w-sm px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Search label / path / role">
              <select id="filterKind" class="w-full lg:w-48 px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                <option value="all">All menus</option>
                <option value="root">Root only</option>
                <option value="child">Child only</option>
              </select>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-3 lg:p-4 max-w-5xl">
            <div id="listWrap" class="space-y-2"></div>
          </div>
        </div>

        <div id="modalBackdrop" class="hidden fixed inset-0 z-[100] bg-black/50 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-4 lg:px-5 py-4 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between gap-3">
                <div>
                  <div id="modalTitle" class="text-lg lg:text-xl font-extrabold">Menu</div>
                  <div id="modalSub" class="text-xs text-slate-500 mt-1">Create / edit / delete menu</div>
                </div>
                <button id="btnModalClose" class="w-10 h-10 rounded-full border border-slate-200 dark:border-darkBorder">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div id="modalBody" class="p-4 lg:p-5"></div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      let ROLES = [];
      let MENUS = [];
      let TREE = [];
      let FLAT = [];
      let BY_ID = new Map();

      function setMsg(kind, text){
        const el = q("msg");
        el.className = "mt-4 text-sm";
        if(kind === "error") el.classList.add("text-red-500");
        else if(kind === "success") el.classList.add("text-emerald-600");
        else el.classList.add("text-slate-500");
        el.textContent = text;
      }

      function renderStats(){
        const total = MENUS.length;
        const root = MENUS.filter(x => !x.parent_id).length;
        q("statTotal").textContent = String(total);
        q("statRoot").textContent = String(root);
        q("statChild").textContent = String(total - root);
        q("statRoles").textContent = String(ROLES.length);
      }

      function openModal(title, sub, bodyHtml){
        q("modalTitle").textContent = title || "Modal";
        q("modalSub").textContent = sub || "";
        q("modalBody").innerHTML = bodyHtml || "";
        q("modalBackdrop").classList.remove("hidden");
      }

      function closeModal(){
        q("modalBackdrop").classList.add("hidden");
        q("modalBody").innerHTML = "";
      }

      function renderParentOptions(selectedId = "", selfId = ""){
        const rows = FLAT.filter(x => String(x.id) !== String(selfId));
        return `
          <option value="">(root)</option>
          ${rows.map(row => `
            <option value="${esc(row.id)}" ${String(selectedId) === String(row.id) ? "selected" : ""}>
              ${esc("— ".repeat(row._depth) + row.label)}
            </option>
          `).join("")}
        `;
      }

      function renderRoleChecks(selectedRoles){
        const picked = new Set((selectedRoles || []).map(String));
        return `
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <label class="block text-sm font-bold text-slate-500">ROLE MENUS</label>
              <div class="flex gap-2">
                <button type="button" id="btnRolesAll" class="px-3 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder text-xs font-bold">Check all</button>
                <button type="button" id="btnRolesNone" class="px-3 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder text-xs font-bold">Uncheck all</button>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-auto">
                ${ROLES.length ? ROLES.map(r => `
                  <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-3 py-3">
                    <input type="checkbox" name="roles" value="${esc(r.name)}" ${picked.has(r.name) ? "checked" : ""}>
                    <div class="min-w-0">
                      <div class="font-black text-sm">${esc(r.name)}</div>
                    </div>
                  </label>
                `).join("") : `
                  <div class="text-sm text-slate-500">No roles available.</div>
                `}
              </div>
            </div>
          </div>
        `;
      }

      function readCheckedRoles(){
        return Array.from(host.querySelectorAll('#modalBody input[name="roles"]:checked'))
          .map(el => String(el.value || "").trim())
          .filter(Boolean);
      }

      function bindRoleCheckButtons(){
        q("btnRolesAll")?.addEventListener("click", ()=>{
          q("modalBody").querySelectorAll('input[name="roles"]').forEach(el => {
            el.checked = true;
          });
        });

        q("btnRolesNone")?.addEventListener("click", ()=>{
          q("modalBody").querySelectorAll('input[name="roles"]').forEach(el => {
            el.checked = false;
          });
        });
      }

      function showCreateModal(){
        openModal(
          "Create Menu",
          "Buat menu baru dan pilih role menus",
          `
            <form id="menuForm" class="space-y-4">
              <input type="hidden" name="mode" value="create">

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">ID</label>
                  <input name="id" value="${esc(getDefaultNewId())}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">CODE</label>
                  <input name="code" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="menus">
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">LABEL</label>
                  <input name="label" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Menu Builder">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">PATH</label>
                  <input name="path" value="/" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="/menus">
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">PARENT</label>
                  <select name="parent_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    ${renderParentOptions("", "")}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">SORT</label>
                  <input name="sort_order" type="number" value="50" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">ICON</label>
                  <input name="icon" value="fa-solid fa-circle-dot" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
              </div>

              ${renderRoleChecks(ROLES.map(x => x.name))}

              <div class="flex justify-end gap-2 pt-2">
                <button type="button" id="btnCancelModal" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">
                  <i class="fa-solid fa-floppy-disk mr-2"></i>Save
                </button>
              </div>
            </form>
          `
        );

        bindRoleCheckButtons();
        bindMenuForm();
      }

      function showEditModal(row){
        openModal(
          "Edit Menu",
          "Edit menu dan role menus sesuai database",
          `
            <form id="menuForm" class="space-y-4">
              <input type="hidden" name="mode" value="update">

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">ID</label>
                  <input name="id" value="${esc(row.id || "")}" readonly class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-dark text-sm font-semibold opacity-80">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">CODE</label>
                  <input name="code" value="${esc(row.code || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">LABEL</label>
                  <input name="label" value="${esc(row.label || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">PATH</label>
                  <input name="path" value="${esc(row.path || "/")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
              </div>

              <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">PARENT</label>
                  <select name="parent_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    ${renderParentOptions(row.parent_id || "", row.id || "")}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">SORT</label>
                  <input name="sort_order" type="number" value="${esc(row.sort_order ?? 50)}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">ICON</label>
                  <input name="icon" value="${esc(row.icon || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
              </div>

              ${renderRoleChecks(Array.isArray(row.role_names) ? row.role_names : [])}

              <div class="flex justify-end gap-2 pt-2">
                <button type="button" id="btnCancelModal" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">
                  <i class="fa-solid fa-floppy-disk mr-2"></i>Save
                </button>
              </div>
            </form>
          `
        );

        bindRoleCheckButtons();
        bindMenuForm();
      }

      function showDeleteModal(row){
        openModal(
          "Delete Menu",
          "Hapus menu dari database",
          `
            <div class="space-y-4">
              <div class="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20 p-4">
                <div class="font-black text-red-600">Confirm delete</div>
                <div class="text-sm text-slate-600 dark:text-slate-300 mt-2">
                  Menu <span class="font-black">${esc(row.label || row.id)}</span> akan dihapus.
                </div>
              </div>

              <div class="flex justify-end gap-2">
                <button type="button" id="btnCancelModal" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
                <button type="button" id="btnConfirmDelete" class="px-4 py-2.5 rounded-2xl bg-red-600 text-white font-black text-sm">
                  <i class="fa-solid fa-trash mr-2"></i>Delete
                </button>
              </div>
            </div>
          `
        );

        q("btnCancelModal")?.addEventListener("click", closeModal);
        q("btnConfirmDelete")?.addEventListener("click", async ()=>{
          setMsg("muted", "Deleting...");
          const r = await apiPost({ action: "delete", id: row.id });

          if(r.status !== "ok"){
            const err = r.data?.error || r.status || "delete_failed";
            setMsg("error", "Delete failed: " + err);
            return;
          }

          closeModal();
          setMsg("success", "Menu deleted.");
          await load();
        });
      }

      function bindMenuForm(){
        q("btnCancelModal")?.addEventListener("click", closeModal);

        q("menuForm")?.addEventListener("submit", async (ev)=>{
          ev.preventDefault();
          const form = ev.currentTarget;

          const payload = {
            action: String(form.mode.value || "create").trim(),
            mode: String(form.mode.value || "create").trim(),
            id: String(form.id.value || "").trim(),
            code: String(form.code.value || "").trim(),
            label: String(form.label.value || "").trim(),
            path: normPath(form.path.value || "/"),
            parent_id: String(form.parent_id.value || "").trim() || null,
            sort_order: Number(form.sort_order.value || 50),
            icon: String(form.icon.value || "").trim(),
            roles: readCheckedRoles()
          };

          setMsg("muted", "Saving...");
          const r = await apiPost(payload);

          if(r.status !== "ok"){
            const err = r.data?.error || r.data?.message || r.status || "save_failed";
            setMsg("error", "Save failed: " + err);
            return;
          }

          closeModal();
          setMsg("success", "Menu saved.");
          await load();
        });
      }

      async function quickSaveSort(row, newSort){
        const roles = Array.isArray(row.role_names) ? row.role_names : [];
        return await apiPost({
          action: "update",
          mode: "update",
          id: row.id,
          code: row.code,
          label: row.label,
          path: normPath(row.path || "/"),
          parent_id: row.parent_id || null,
          sort_order: Number(newSort || 50),
          icon: row.icon || "",
          roles
        });
      }

      async function moveRow(row, dir){
        const siblings = MENUS
          .filter(x => String(x.parent_id || "") === String(row.parent_id || ""))
          .slice()
          .sort(bySort);

        const idx = siblings.findIndex(x => String(x.id) === String(row.id));
        if(idx < 0) return;

        const targetIdx = dir === "up" ? idx - 1 : idx + 1;
        if(targetIdx < 0 || targetIdx >= siblings.length) return;

        const a = siblings[idx];
        const b = siblings[targetIdx];

        setMsg("muted", "Updating order...");

        const ra = await quickSaveSort(a, b.sort_order);
        if(ra.status !== "ok"){
          setMsg("error", "Move failed: " + (ra.data?.error || ra.status));
          return;
        }

        const rb = await quickSaveSort(b, a.sort_order);
        if(rb.status !== "ok"){
          setMsg("error", "Move failed: " + (rb.data?.error || rb.status));
          return;
        }

        setMsg("success", "Order updated.");
        await load();
      }

      function roleBadgeLine(roleNames){
        const names = Array.isArray(roleNames) ? roleNames : [];
        if(!names.length){
          return `<div class="text-[11px] text-slate-400">[no roles]</div>`;
        }
        return `<div class="text-[11px] lg:text-xs text-slate-500 mt-2">[${esc(names.join(", "))}]</div>`;
      }

      function filteredRows(){
        const keyword = String(q("qSearch").value || "").trim().toLowerCase();
        const kind = String(q("filterKind").value || "all");

        return FLAT.filter(row => {
          if(kind === "root" && row.parent_id) return false;
          if(kind === "child" && !row.parent_id) return false;

          if(!keyword) return true;

          const parentLabel = row.parent_id ? (BY_ID.get(String(row.parent_id))?.label || "") : "";
          const hay = [
            row.label,
            row.path,
            ...(row.role_names || []),
            parentLabel
          ].join(" ").toLowerCase();

          return hay.includes(keyword);
        });
      }

      function renderRows(){
        const rows = filteredRows();

        if(!rows.length){
          q("listWrap").innerHTML = `<div class="text-sm text-slate-500">No matching menu data.</div>`;
          return;
        }

        q("listWrap").innerHTML = rows.map(row => {
          const parentLabel = row.parent_id ? (BY_ID.get(String(row.parent_id))?.label || row.parent_id) : "";
          const title = row._depth > 0 ? `${"— ".repeat(row._depth)}${row.label}` : row.label;

          return `
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
              <div class="flex items-start gap-3">
                <div class="pt-1 text-slate-400">
                  <i class="${esc(row.icon || "fa-solid fa-circle-dot")}"></i>
                </div>

                <div class="min-w-0 flex-1">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="font-black text-sm lg:text-base">${esc(title)}</div>

                      ${row._depth > 0 ? `
                        <div class="text-[11px] lg:text-xs text-slate-500 mt-1">
                          Parent [${esc(parentLabel)}]
                        </div>
                      ` : ""}

                      ${row.path && row.path !== "/" ? `
                        <div class="text-[11px] lg:text-xs text-slate-500 mt-1 break-all">${esc(row.path)}</div>
                      ` : ""}

                      ${roleBadgeLine(row.role_names)}
                    </div>

                    <div class="shrink-0 flex flex-col items-end gap-2">
                      <div class="flex items-center gap-1.5">
                        <input
                          class="sortInput w-16 px-2 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-center text-xs font-black"
                          type="number"
                          value="${esc(row.sort_order)}"
                          data-id="${esc(row.id)}"
                        >
                        <button class="btnMove px-2.5 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs" data-dir="up" data-id="${esc(row.id)}" title="Move up">
                          <i class="fa-solid fa-arrow-up"></i>
                        </button>
                        <button class="btnMove px-2.5 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs" data-dir="down" data-id="${esc(row.id)}" title="Move down">
                          <i class="fa-solid fa-arrow-down"></i>
                        </button>
                      </div>

                      <div class="flex items-center gap-1.5">
                        <button class="btnEdit w-10 h-10 rounded-xl border border-slate-200 dark:border-darkBorder" data-id="${esc(row.id)}" title="Edit">
                          <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btnDelete w-10 h-10 rounded-xl border border-red-200 text-red-600" data-id="${esc(row.id)}" title="Delete">
                          <i class="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join("");

        q("listWrap").querySelectorAll(".btnEdit").forEach(btn => {
          btn.addEventListener("click", ()=>{
            const id = String(btn.getAttribute("data-id") || "");
            const row = MENUS.find(x => String(x.id) === id);
            if(row) showEditModal(row);
          });
        });

        q("listWrap").querySelectorAll(".btnDelete").forEach(btn => {
          btn.addEventListener("click", ()=>{
            const id = String(btn.getAttribute("data-id") || "");
            const row = MENUS.find(x => String(x.id) === id);
            if(row) showDeleteModal(row);
          });
        });

        q("listWrap").querySelectorAll(".btnMove").forEach(btn => {
          btn.addEventListener("click", async ()=>{
            const id = String(btn.getAttribute("data-id") || "");
            const dir = String(btn.getAttribute("data-dir") || "");
            const row = MENUS.find(x => String(x.id) === id);
            if(row) await moveRow(row, dir);
          });
        });

        q("listWrap").querySelectorAll(".sortInput").forEach(input => {
          const commit = async ()=>{
            const id = String(input.getAttribute("data-id") || "");
            const row = MENUS.find(x => String(x.id) === id);
            if(!row) return;

            const newSort = Number(input.value || row.sort_order || 50);
            if(Number(newSort) === Number(row.sort_order)) return;

            setMsg("muted", "Saving sort...");
            const r = await quickSaveSort(row, newSort);

            if(r.status !== "ok"){
              setMsg("error", "Sort update failed: " + (r.data?.error || r.status));
              return;
            }

            setMsg("success", "Sort updated.");
            await load();
          };

          input.addEventListener("blur", commit);
          input.addEventListener("keydown", async (e)=>{
            if(e.key === "Enter"){
              e.preventDefault();
              await commit();
            }
          });
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
        BY_ID = new Map(MENUS.map(x => [String(x.id), x]));

        renderStats();
        renderRows();
        setMsg("success", "Loaded.");
      }

      q("btnReload").addEventListener("click", load);
      q("btnNew").addEventListener("click", showCreateModal);
      q("qSearch").addEventListener("input", renderRows);
      q("filterKind").addEventListener("change", renderRows);
      q("btnModalClose").addEventListener("click", closeModal);
      q("modalBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("modalBackdrop")) closeModal();
      });

      await load();
    }
  };
}
