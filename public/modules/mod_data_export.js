export async function mount(ctx){
  const { host } = ctx;
  host.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm font-bold">Export Data</div>
        <div class="text-xs text-slate-500">Download JSON dari server</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <div class="text-xs font-bold">Choose dataset</div>
        <select id="kind" class="w-full text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="users">users</option>
          <option value="audit">audit_logs</option>
          <option value="incidents">incidents</option>
          <option value="ipblocks">ip_blocks</option>
          <option value="roles">roles</option>
          <option value="menus">menus</option>
          <option value="role_menus">role_menus</option>
        </select>
        <button id="go" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600 w-full">Download</button>
        <div class="text-[11px] text-slate-500">Endpoint: <code>/api/data/export?kind=...</code></div>
      </div>
    </div>
  `;

  document.getElementById("go").onclick = ()=>{
    const kind = document.getElementById("kind").value;
    window.location.href = "/api/data/export?kind=" + encodeURIComponent(kind);
  };
}
