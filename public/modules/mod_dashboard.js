export async function mount(ctx){
  const { host, api } = ctx;
  host.innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      ${card("Users","k_users")}
      ${card("Roles","k_roles")}
      ${card("Menus","k_menus")}
      ${card("Active IP Blocks","k_ipblocks")}
    </div>

    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm h-80 flex flex-col mt-6">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-bold">Ops Status</h3>
        <button id="btnRefresh" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Refresh</button>
      </div>
      <div class="text-xs text-slate-500 mt-2">Data from /api/ops/status</div>
      <div id="opsBox" class="mt-4 text-xs text-slate-500">Loading…</div>
    </div>
  `;

  async function load(){
    const r = await api("/api/ops/status");
    if(r.status !== "ok"){
      document.getElementById("opsBox").textContent = "Failed: " + r.status;
      return;
    }
    set("k_users", r.data.users);
    set("k_roles", r.data.roles);
    set("k_menus", r.data.menus);
    set("k_ipblocks", r.data.ip_blocks_active);

    document.getElementById("opsBox").innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        ${mini("Incidents open", r.data.incidents_open)}
        ${mini("Role menus", r.data.role_menus)}
        ${mini("Now", r.data.now)}
      </div>
    `;
  }
  document.getElementById("btnRefresh")?.addEventListener("click", load);
  await load();
}

function card(label, id){
  return `
  <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
    <div class="text-xs font-medium text-slate-500">${label}</div>
    <div id="${id}" class="text-2xl font-bold text-slate-900 dark:text-white mt-1">—</div>
  </div>`;
}
function mini(label, val){
  return `
  <div class="p-4 rounded-xl border border-slate-200 dark:border-darkBorder bg-slate-50/50 dark:bg-white/5">
    <div class="text-[11px] text-slate-500">${label}</div>
    <div class="text-lg font-bold text-slate-900 dark:text-white mt-1">${val ?? "—"}</div>
  </div>`;
}
function set(id, v){
  const el = document.getElementById(id);
  if(el) el.textContent = (v ?? "—");
}
