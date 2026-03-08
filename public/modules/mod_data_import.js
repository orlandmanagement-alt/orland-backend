export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm font-bold">Import Data</div>
        <div class="text-xs text-slate-500">Upload JSON rows (hanya menus / role_menus)</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <div class="text-xs font-bold">Kind</div>
        <select id="kind" class="w-full text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="menus">menus</option>
          <option value="role_menus">role_menus</option>
        </select>

        <div class="text-xs font-bold">Paste JSON</div>
        <textarea id="json" class="w-full h-48 text-[11px] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder='{"kind":"menus","rows":[...]} OR paste only rows array [...]'></textarea>

        <button id="go" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600 w-full">Import</button>

        <details>
          <summary class="text-xs text-slate-500">Debug</summary>
          <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
        </details>
      </div>
    </div>
  `;

  document.getElementById("go").onclick = async ()=>{
    const kind = document.getElementById("kind").value;
    const raw = document.getElementById("json").value || "";
    let payload;
    try{
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)){
        payload = { kind, rows: parsed };
      }else{
        payload = parsed;
        if(!payload.kind) payload.kind = kind;
      }
    }catch{
      toast("Invalid JSON", "error");
      return;
    }

    const r = await api("/api/data/import", { method:"POST", body: JSON.stringify(payload) });
    document.getElementById("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };
}
