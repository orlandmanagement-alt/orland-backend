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
        ...row,
        id: String(row.id),
        parent_id: row.parent_id ? String(row.parent_id) : null,
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
      for(const x of arr) walk(x.children || []);
    };
    walk(roots);

    return roots;
  }

  function flatten(nodes, out=[]){
    for(const n of nodes){
      out.push(n);
      flatten(n.children || [], out);
    }
    return out;
  }

  return {
    title:"Menu Builder",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">Menu Builder</div>
                <div class="text-slate-500 mt-1">CRUD menu + role_menus + sort order + parent-child.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnNew" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
                  <i class="fa-solid fa-plus mr-2"></i>New Menu
                </button>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-3">
              <input id="qSearch" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari label / path / id / code">
              <select id="qRole" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                <option value="">All roles</option>
              </select>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4 lg:p-5">
            <div class="text-xl font-extrabold">Menus</div>
            <div class="text-slate-500 text-sm mt-1">Tampilan mobile ringkas, edit cepat, mover sort, dan role menus.</div>
            <div id="listBox" class="mt-5 space-y-3"></div>
          </div>
        </div>

        <div id="modalBackdrop" class="hidden fixed inset-0 z-[100] bg-black/50 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-4 lg:px-5 py-4 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between gap-3">
                <div>
                  <div id="modalTitle" class="text-lg lg:text-xl font-extrabold">Menu</div>
                  <div class="text-xs text-slate-500 mt-1">Create / edit menu</div>
                </div>
                <button id="btnModalClose" class="w-10 h-10 rounded-full border border-slate-200 dark:border-darkBorder"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <div id="modalBody" class="p-4 lg:p-5"></div>
            </div>
          </div>
        </div>

        <div id="confirmBackdrop" class="hidden fixed inset-0 z-[120] bg-black/60 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-5 py-4 border-b border-slate-200 dark:border-darkBorder">
                <div id="confirmTitle" class="text-lg font-extrabold">Confirm Action</div>
                <div id="confirmDesc" class="text-sm text-slate-500 mt-1">Are you sure?</div>
              </div>
              <div class="p-5">
                <div id="confirmMeta" class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 text-sm break-words"></div>
                <div class="mt-5 flex justify-end gap-2">
                  <button id="btnConfirmCancel" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
                  <button id="btnConfirmOk" class="px-4 py-2.5 rounded-2xl bg-red-600 text-white font-black text-sm">Confirm</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let MENUS = [];
      let ROLES = [];
      let TREE = [];
      let confirmAction = null;

      function setMsg(kind, text){
        const el = q("msg");
        el.className = "mt-4 text-sm";
        if(kind === "error") el.classList.add("text-red-500");
        else if(kind === "success") el.classList.add("text-emerald-600");
        else el.classList.add("text-slate-500");
        el.textContent = text;
      }

      function openModal(title, body){
        q("modalTitle").textContent = title || "Menu";
        q("modalBody").innerHTML = body || "";
        q("modalBackdrop").classList.remove("hidden");
      }

      function closeModal(){
        q("modalBackdrop").classList.add("hidden");
        q("modalBody").innerHTML = "";
      }

      function openConfirm(title, desc, metaHtml, onOk){
        q("confirmTitle").textContent = title || "Confirm";
        q("confirmDesc").textContent = desc || "";
        q("confirmMeta").innerHTML = metaHtml || "-";
        confirmAction = onOk;
        q("confirmBackdrop").classList.remove("hidden");
      }

      function closeConfirm(){
        q("confirmBackdrop").classList.add("hidden");
        q("confirmMeta").innerHTML = "";
        confirmAction = null;
      }

      function renderRoleFilter(){
        q("qRole").innerHTML = `<option value="">All roles</option>` + ROLES.map(r => `
          <option value="${esc(r.name)}">${esc(r.name)}</option>
        `).join("");
      }

      function filteredItems(){
        const kw = String(q("qSearch").value || "").trim().toLowerCase();
        const role = String(q("qRole").value || "").trim();

        return MENUS.filter(x => {
          const hay = [x.id, x.code, x.label, x.path, x.parent_label].join(" ").toLowerCase();
          const okKw = !kw || hay.includes(kw);
          const okRole = !role || (Array.isArray(x.role_names_json) && x.role_names_json.includes(role));
          return okKw && okRole;
        });
      }

      function renderRows(nodes, depth=0){
        const visibleIds = new Set(filteredItems().map(x => String(x.id)));
        const hasVisible = (node)=>{
          if(visibleIds.has(String(node.id))) return true;
          return (node.children || []).some(hasVisible);
        };

        return nodes.filter(hasVisible).map(node => {
          const roles = Array.isArray(node.role_names_json) ? node.role_names_json : [];
          const indent = depth * 16;

          return `
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder overflow-hidden">
              <div class="px-3 lg:px-4 py-3 bg-white dark:bg-darkLighter" style="padding-left:${12 + indent}px">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 flex-wrap">
                      <i class="${esc(node.icon || "fa-solid fa-circle-dot")} text-slate-400"></i>
                      <div class="font-black text-sm">${depth > 0 ? "&mdash; " : ""}${esc(node.label || "Menu")}</div>
                    </div>
                    <div class="mt-2 text-xs text-slate-500 space-y-1">
                      ${depth > 0 ? `<div>Parent <span class="font-bold">[${esc(node.parent_label || "-")}]</span></div>` : ``}
                      ${node.path && node.path !== "/" ? `<div>${esc(node.path)}</div>` : ``}
                      <div>sort: ${esc(node.sort_order)} • id: ${esc(node.id)}</div>
                    </div>
                    <div class="mt-3 flex gap-2 flex-wrap">
                      ${roles.length ? roles.map(r => `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(r)}</span>`).join("") : `<span class="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-black">no roles</span>`}
                    </div>
                  </div>

                  <div class="flex gap-2 shrink-0 flex-wrap justify-end">
                    <button class="btnMoveUp px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-id="${esc(node.id)}" title="Move Up">
                      <i class="fa-solid fa-arrow-up"></i>
                    </button>
                    <button class="btnMoveDown px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-id="${esc(node.id)}" title="Move Down">
                      <i class="fa-solid fa-arrow-down"></i>
                    </button>
                    <button class="btnEdit px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-id="${esc(node.id)}" title="Edit">
                      <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btnDelete px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-black" data-id="${esc(node.id)}" title="Delete">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>

              ${(node.children || []).length ? `<div class="border-t border-slate-200 dark:border-darkBorder">${renderRows(node.children, depth + 1)}</div>` : ``}
            </div>
          `;
        }).join("");
      }

      function bindListActions(){
        q("listBox").querySelectorAll(".btnEdit").forEach(btn => {
          btn.onclick = ()=>{
            const row = MENUS.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(row) openEditor(row);
          };
        });

        q("listBox").querySelectorAll(".btnDelete").forEach(btn => {
          btn.onclick = ()=>{
            const row = MENUS.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(!row) return;

            openConfirm(
              "Delete Menu",
              "Menu akan dihapus jika tidak punya children.",
              `<div class="font-black text-red-600">${esc(row.label || row.id)}</div><div class="text-xs text-slate-500 mt-2">${esc(row.path || "-")}</div>`,
              async ()=>{
                setMsg("muted", "Deleting...");
                const r = await apiSave({ action:"delete", id: row.id });
                if(r.status !== "ok"){
                  setMsg("error", "Delete failed: " + (r.data?.message || r.status));
                  return;
                }
                closeConfirm();
                setMsg("success", "Menu deleted.");
                await load();
              }
            );
          };
        });

        q("listBox").querySelectorAll(".btnMoveUp").forEach(btn => {
          btn.onclick = async ()=>{
            const row = MENUS.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(!row) return;
            row.sort_order = Number(row.sort_order || 50) - 1;
            await quickSave(row);
          };
        });

        q("listBox").querySelectorAll(".btnMoveDown").forEach(btn => {
          btn.onclick = async ()=>{
            const row = MENUS.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(!row) return;
            row.sort_order = Number(row.sort_order || 50) + 1;
            await quickSave(row);
          };
        });
      }

      async function quickSave(row){
        setMsg("muted", "Saving sort...");
        const role_ids = ROLES
          .filter(r => Array.isArray(row.role_names_json) && row.role_names_json.includes(r.name))
          .map(r => r.id);

        const r = await apiSave({
          action: "update",
          id: row.id,
          code: row.code,
          label: row.label,
          path: row.path,
          parent_id: row.parent_id || "",
          sort_order: row.sort_order,
          icon: row.icon || "",
          role_ids
        });

        if(r.status !== "ok"){
          setMsg("error", "Sort save failed: " + (r.data?.message || r.status));
          return;
        }

        setMsg("success", "Sort updated.");
        await load();
      }

      function renderList(){
        TREE = buildTree(MENUS);
        q("listBox").innerHTML = renderRows(TREE, 0) || `<div class="text-sm text-slate-500">No menu data.</div>`;
        bindListActions();
      }

      function editorHtml(row = {}){
        const roleNames = Array.isArray(row.role_names_json) ? row.role_names_json : [];
        const selectedRoleIds = new Set(
          ROLES.filter(r => roleNames.includes(r.name)).map(r => String(r.id))
        );

        const parents = MENUS
          .filter(x => String(x.id) !== String(row.id || ""))
          .map(x => `<option value="${esc(x.id)}" ${String(row.parent_id || "") === String(x.id) ? "selected" : ""}>${esc(x.label)}</option>`)
          .join("");

        return `
          <form id="menuForm" class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="space-y-4">
              <input type="hidden" name="mode" value="${row.id ? "update" : "create"}">

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">ID</label>
                <input name="id" value="${esc(row.id || "")}" ${row.id ? "readonly" : ""} class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 text-sm font-semibold" placeholder="m_core_dashboard">
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">CODE</label>
                  <input name="code" value="${esc(row.code || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="dashboard">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">LABEL</label>
                  <input name="label" value="${esc(row.label || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Dashboard">
                </div>
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">PATH</label>
                <input name="path" value="${esc(row.path || "/")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="/dashboard">
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2">
                  <label class="block text-sm font-bold text-slate-500 mb-2">PARENT</label>
                  <select name="parent_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    <option value="">root</option>
                    ${parents}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">SORT ORDER</label>
                  <input name="sort_order" type="number" value="${esc(row.sort_order ?? 50)}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">ICON</label>
                <input name="icon" value="${esc(row.icon || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="fa-solid fa-sitemap">
              </div>

              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save</button>
                <button type="button" id="btnCancelMenu" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <div class="text-sm font-bold text-slate-500 mb-2">ROLE MENUS</div>
                <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                  <div class="flex gap-2 flex-wrap mb-3">
                    <button type="button" id="btnRoleAll" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Check all</button>
                    <button type="button" id="btnRoleNone" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Uncheck all</button>
                  </div>
                  <div id="roleChecks" class="space-y-2">
                    ${ROLES.map(r => `
                      <label class="flex items-center gap-3 text-sm">
                        <input class="roleCheck" type="checkbox" value="${esc(r.id)}" ${row.id ? (selectedRoleIds.has(String(r.id)) ? "checked" : "") : "checked"}>
                        <span class="font-semibold">${esc(r.name)}</span>
                      </label>
                    `).join("")}
                  </div>
                </div>
              </div>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 text-sm text-slate-500">
                <div><b>ID</b> harus unik dan berbeda dari menu lain.</div>
                <div class="mt-2"><b>Code</b> gunakan format snake_case.</div>
                <div class="mt-2"><b>Path</b> unik, kecuali root "/".</div>
              </div>
            </div>
          </form>
        `;
      }

      function openEditor(row = {}){
        openModal(row.id ? "Edit Menu" : "Create Menu", editorHtml(row));

        const form = q("menuForm");
        const roleChecks = ()=>Array.from(q("roleChecks").querySelectorAll(".roleCheck"));

        q("btnCancelMenu").onclick = closeModal;
        q("btnRoleAll").onclick = ()=>roleChecks().forEach(x => x.checked = true);
        q("btnRoleNone").onclick = ()=>roleChecks().forEach(x => x.checked = false);

        form.onsubmit = async (ev)=>{
          ev.preventDefault();

          const role_ids = roleChecks().filter(x => x.checked).map(x => x.value);

          const payload = {
            action: form.mode.value,
            id: form.id.value.trim(),
            code: form.code.value.trim(),
            label: form.label.value.trim(),
            path: form.path.value.trim(),
            parent_id: form.parent_id.value.trim(),
            sort_order: Number(form.sort_order.value || 50),
            icon: form.icon.value.trim(),
            role_ids
          };

          setMsg("muted", "Saving...");
          const r = await apiSave(payload);

          if(r.status !== "ok"){
            setMsg("error", "Save failed: " + (r.data?.message || r.status));
            return;
          }

          closeModal();
          setMsg("success", "Menu saved.");
          await load();
        };
      }

      async function load(){
        setMsg("muted", "Loading...");
        const r = await apiLoad();

        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + r.status);
          return;
        }

        MENUS = Array.isArray(r.data?.menus) ? r.data.menus : [];
        ROLES = Array.isArray(r.data?.roles) ? r.data.roles : [];

        renderRoleFilter();
        renderList();
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = load;
      q("btnNew").onclick = ()=>openEditor({});
      q("qSearch").oninput = renderList;
      q("qRole").onchange = renderList;

      q("btnModalClose").onclick = closeModal;
      q("modalBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("modalBackdrop")) closeModal();
      });

      q("btnConfirmCancel").onclick = closeConfirm;
      q("btnConfirmOk").onclick = async ()=>{
        if(typeof confirmAction === "function") await confirmAction();
      };
      q("confirmBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("confirmBackdrop")) closeConfirm();
      });

      await load();
    }
  };
}
