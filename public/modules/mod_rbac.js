export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadBundle(){
    return await Orland.api("/api/rbac/bundle");
  }

  async function saveRoleMenus(role_id, menu_ids){
    return await Orland.api("/api/role-menus/set", {
      method:"POST",
      body: JSON.stringify({ role_id, menu_ids })
    });
  }

  function sortMenus(a,b){
    const sa = Number(a.sort_order ?? 9999);
    const sb = Number(b.sort_order ?? 9999);
    if(sa !== sb) return sa - sb;
    return Number(a.created_at ?? 0) - Number(b.created_at ?? 0);
  }

  function buildTree(menus){
    const byId = new Map();
    const roots = [];

    for(const m of (menus||[])){
      byId.set(String(m.id), { ...m, children:[] });
    }

    for(const m of byId.values()){
      if(m.parent_id && byId.has(String(m.parent_id))){
        byId.get(String(m.parent_id)).children.push(m);
      }else{
        roots.push(m);
      }
    }

    const walk = (arr)=>{
      arr.sort(sortMenus);
      for(const x of arr) walk(x.children || []);
    };
    walk(roots);
    return roots;
  }

  function flattenTree(roots){
    const out = [];
    const walk = (node, depth)=>{
      out.push({ ...node, __depth: depth });
      for(const c of (node.children||[])) walk(c, depth+1);
    };
    for(const r of roots) walk(r, 0);
    return out;
  }

  return {
    title:"RBAC Manager",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div>
            <div class="text-xl font-extrabold text-slate-900 dark:text-white">RBAC Manager</div>
            <div class="text-sm text-slate-500">Assign menus ke role.</div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <div class="flex gap-2 flex-wrap">
              <button id="btnSave" class="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white">Save</button>
              <button id="btnReload" class="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder">Reload</button>
            </div>

            <div class="mt-4">
              <label class="text-[11px] font-bold text-slate-500">ROLE</label>
              <select id="roleSel" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder"></select>
            </div>

            <div class="mt-4">
              <label class="text-[11px] font-bold text-slate-500">INFO</label>
              <div class="mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder text-slate-500">
                Checklist menu → Save untuk set menu_ids.
              </div>
            </div>

            <div id="msg" class="mt-3 text-xs"></div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <div class="text-sm font-extrabold">Menus</div>
            <div id="menusBox" class="mt-4 space-y-2"></div>
          </div>
        </div>
      `;

      const msg = host.querySelector("#msg");
      const roleSel = host.querySelector("#roleSel");
      const menusBox = host.querySelector("#menusBox");

      let ROLES = [];
      let MENUS = [];
      let ROLE_MENUS_MAP = {};
      let CURRENT_ROLE = "";

      function selectedMenuIds(){
        return Array.from(menusBox.querySelectorAll('input[type="checkbox"]:checked')).map(x=>x.value);
      }

      function renderRoles(){
        roleSel.innerHTML = ROLES.map(r =>
          `<option value="${esc(r.id)}">${esc(r.name)}</option>`
        ).join("");
        if(CURRENT_ROLE){
          roleSel.value = CURRENT_ROLE;
        }else if(ROLES.length){
          CURRENT_ROLE = String(ROLES[0].id);
          roleSel.value = CURRENT_ROLE;
        }
      }

      function renderMenus(){
        const roots = buildTree(MENUS);
        const flat = flattenTree(roots);

        const allowedIds = Array.isArray(ROLE_MENUS_MAP[CURRENT_ROLE])
          ? ROLE_MENUS_MAP[CURRENT_ROLE]
          : [];

        menusBox.innerHTML = flat.map(m=>{
          const checked = allowedIds.includes(String(m.id)) ? "checked" : "";
          const pad = 10 + (m.__depth * 18);
          return `
            <label class="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-darkBorder px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5" style="padding-left:${pad}px">
              <input type="checkbox" value="${esc(m.id)}" ${checked}>
              <div class="min-w-0">
                <div class="text-xs font-black truncate">${esc(m.label || m.code || m.id)}</div>
                <div class="text-[11px] text-slate-500 truncate">${esc(m.path || "")}</div>
              </div>
            </label>
          `;
        }).join("") || `<div class="text-xs text-slate-500">No menus.</div>`;
      }

      async function reload(){
        msg.className = "mt-3 text-xs text-slate-500";
        msg.textContent = "Loading...";
        const r = await loadBundle();

        if(r.status!=="ok"){
          msg.className = "mt-3 text-xs text-red-500";
          msg.textContent = "Failed: " + r.status;
          return;
        }

        const d = r.data || {};
        ROLES = Array.isArray(d.roles) ? d.roles : [];
        MENUS = Array.isArray(d.menus) ? d.menus : [];

        // FIX utama: role_menus bisa object map, bukan array
        ROLE_MENUS_MAP = (d.role_menus && typeof d.role_menus === "object" && !Array.isArray(d.role_menus))
          ? d.role_menus
          : {};

        renderRoles();
        renderMenus();

        msg.className = "mt-3 text-xs text-emerald-600";
        msg.textContent = "Loaded.";
      }

      roleSel.onchange = ()=>{
        CURRENT_ROLE = roleSel.value || "";
        renderMenus();
      };

      host.querySelector("#btnReload").onclick = reload;

      host.querySelector("#btnSave").onclick = async ()=>{
        if(!CURRENT_ROLE){
          msg.className = "mt-3 text-xs text-red-500";
          msg.textContent = "Role required.";
          return;
        }

        const menu_ids = selectedMenuIds();
        if(!menu_ids.length){
          msg.className = "mt-3 text-xs text-red-500";
          msg.textContent = "Select at least one menu.";
          return;
        }

        msg.className = "mt-3 text-xs text-slate-500";
        msg.textContent = "Saving...";

        const r = await saveRoleMenus(CURRENT_ROLE, menu_ids);
        if(r.status!=="ok"){
          msg.className = "mt-3 text-xs text-red-500";
          msg.textContent = "Save failed: " + r.status;
          return;
        }

        msg.className = "mt-3 text-xs text-emerald-600";
        msg.textContent = "Saved.";
        await reload();
      };

      await reload();
    }
  };
}
