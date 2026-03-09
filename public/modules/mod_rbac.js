export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  function toast(msg, type="info"){
    const host = document.getElementById("toast-host");
    if(!host){ alert(msg); return; }
    const div = document.createElement("div");
    div.className = "fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    div.innerHTML = `<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(div);
    setTimeout(()=>div.remove(), 2800);
  }

  async function loadBundle(){
    return await Orland.api("/api/rbac/bundle");
  }

  return {
    title: "RBAC Manager",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-base font-bold">RBAC Manager</div>
              <div class="text-xs text-slate-500 mt-1">Assign menus ke role (role_menus).</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnSave" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
                <i class="fa-solid fa-floppy-disk mr-2"></i>Save
              </button>
              <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="md:col-span-1">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Role</div>
              <select id="roleSelect" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs"></select>
            </div>
            <div class="md:col-span-2">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Info</div>
              <div class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs text-slate-500">
                Checklist menu → Save untuk set menu_ids.
              </div>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3" id="checks"></div>
        </div>
      `;

      const sel = host.querySelector("#roleSelect");
      const checks = host.querySelector("#checks");

      let roles = [];
      let menus = [];
      let role_menus = [];

      function renderChecks(){
        const rid = sel.value;
        const set = new Set(role_menus.filter(x=>String(x.role_id)===String(rid)).map(x=>String(x.menu_id)));
        checks.innerHTML = (menus||[]).map(m=>{
          const checked = set.has(String(m.id)) ? "checked" : "";
          const icon = m.icon ? `<i class="${esc(m.icon)} mr-2"></i>` : `<i class="fa-solid fa-circle-dot mr-2 opacity-60"></i>`;
          return `
            <label class="rounded-xl border border-slate-200 dark:border-darkBorder p-3 flex gap-3 items-start hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
              <input type="checkbox" class="mt-1" data-mid="${esc(m.id)}" ${checked}>
              <div class="min-w-0">
                <div class="text-sm font-bold text-slate-900 dark:text-white">${icon}${esc(m.label||m.code||"menu")}</div>
                <div class="text-[10px] text-slate-500 mt-1"><code>${esc(m.path||"")}</code> • <code>${esc(m.code||"")}</code></div>
              </div>
            </label>
          `;
        }).join("");
      }

      async function load(){
        checks.innerHTML = `<div class="text-slate-500 text-xs">Loading…</div>`;
        const r = await loadBundle();
        if(r.status !== "ok"){
          checks.innerHTML = `<div class="text-red-400 text-xs">Failed: ${esc(r.status)}</div>`;
          return;
        }
        roles = r.data?.roles || [];
        menus = r.data?.menus || [];
        role_menus = r.data?.role_menus || [];

        sel.innerHTML = roles.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
        renderChecks();
      }

      sel.addEventListener("change", renderChecks);

      host.querySelector("#btnReload")?.addEventListener("click", load);

      host.querySelector("#btnSave")?.addEventListener("click", async ()=>{
        const rid = sel.value;
        const menu_ids = Array.from(checks.querySelectorAll("input[type=checkbox]"))
          .filter(cb=>cb.checked)
          .map(cb=>cb.getAttribute("data-mid"))
          .filter(Boolean);

        const rr = await Orland.api("/api/role-menus/set", { method:"POST", body: JSON.stringify({ role_id: rid, menu_ids }) });
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") await load();
      });

      await load();
    }
  };
}
