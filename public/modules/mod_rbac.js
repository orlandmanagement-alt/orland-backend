export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-sm font-bold">RBAC Manager</div>
          <div class="text-xs text-slate-500 mt-1">Assign menus to roles</div>
        </div>
        <button id="rbReload" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
      </div>

      <div class="mt-4 flex flex-wrap gap-2 items-center">
        <div class="text-xs text-slate-500">Role:</div>
        <select id="rbRole" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2"></select>
        <button id="rbSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Save</button>
      </div>

      <div id="rbGrid" class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2"></div>
    </div>
  `;

  let bundle = null;

  async function load(){
    const r = await api("/api/rbac/bundle");
    if(r.status !== "ok"){
      toast("RBAC bundle failed: "+r.status, "error");
      return;
    }
    bundle = r.data;
    render();
  }

  function render(){
    const roles = bundle.roles || [];
    const menus = bundle.menus || [];
    const role_menus = bundle.role_menus || [];

    const sel = document.getElementById("rbRole");
    sel.innerHTML = roles.map(x=>`<option value="${x.id}">${x.name}</option>`).join("");

    function draw(){
      const rid = sel.value;
      const set = new Set(role_menus.filter(x=>x.role_id===rid).map(x=>x.menu_id));
      const grid = document.getElementById("rbGrid");
      grid.innerHTML = menus.map(m=>`
        <label class="flex gap-3 items-start p-3 rounded-xl border border-slate-200 dark:border-darkBorder bg-slate-50/50 dark:bg-white/5 cursor-pointer">
          <input type="checkbox" data-mid="${m.id}" ${set.has(m.id)?"checked":""} class="mt-1">
          <div class="min-w-0">
            <div class="text-xs font-bold text-slate-900 dark:text-white">${m.icon?`<i class="${m.icon} mr-2"></i>`:""}${m.label}</div>
            <div class="text-[11px] text-slate-500 truncate">${m.path} • <span class="opacity-70">${m.code}</span></div>
          </div>
        </label>
      `).join("");
    }

    sel.onchange = draw;
    draw();

    document.getElementById("rbSave").onclick = async ()=>{
      const rid = sel.value;
      const menu_ids = Array.from(document.querySelectorAll("#rbGrid input[type=checkbox]"))
        .filter(x=>x.checked)
        .map(x=>x.getAttribute("data-mid"));
      const rr = await api("/api/role-menus/set", { method:"POST", body: JSON.stringify({ role_id: rid, menu_ids }) });
      toast(rr.status, rr.status==="ok"?"success":"error");
      await load();
    };
  }

  document.getElementById("rbReload").onclick = load;
  await load();
}
