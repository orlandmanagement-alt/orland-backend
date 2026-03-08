(function(){
  const M = window.Orland?.Modules;
  const API = window.Orland?.API;
  if(!M || !API) return;

  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  function downloadJson(obj, name){
    const blob = new Blob([JSON.stringify(obj,null,2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }

  M.register("/data/export", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-5">
        <div class="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Export Data</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Summary or full export (safe fields only).</p>
          </div>
          <div class="flex items-center gap-2">
            <select id="mode" class="px-3 py-2 rounded-lg bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder text-sm">
              <option value="summary" selected>summary</option>
              <option value="full">full</option>
            </select>
            <button id="btnExport" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">
              <i class="fa-solid fa-download mr-2"></i>Export
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <pre id="out" class="text-xs text-slate-500 whitespace-pre-wrap">—</pre>
        </div>
      </div>
    `;

    const out = document.getElementById("out");
    document.getElementById("btnExport").onclick = async ()=>{
      const mode = document.getElementById("mode").value;
      const r = await API.req("/api/data/export?mode="+encodeURIComponent(mode));
      out.textContent = JSON.stringify(r,null,2);
      if(r.status==="ok"){
        downloadJson(r.data, `orland_export_${mode}_${Date.now()}.json`);
      }else alert(r.status);
    };
  });

  M.register("/data/import", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-5">
        <div class="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Import Data</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">Super Admin only. Upsert menus & map role_menus safely.</p>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 space-y-3">
          <div class="text-xs text-slate-500">
            Format JSON:
            <pre class="mt-2 text-[11px] text-slate-500 whitespace-pre-wrap">
{
  "menus":[{"id":"...","code":"dashboard","label":"Dashboard","path":"/dashboard","parent_id":null,"sort_order":10,"icon":"fa-solid fa-gauge","created_at":1700000000}],
  "role_menus":[{"role_name":"admin","menu_code":"dashboard"}]
}
            </pre>
          </div>
          <textarea id="payload" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" rows="10" placeholder="paste JSON here..."></textarea>
          <button id="btnImport" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">
            <i class="fa-solid fa-upload mr-2"></i>Import
          </button>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="dbg" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    const dbg = document.getElementById("dbg");
    document.getElementById("btnImport").onclick = async ()=>{
      const raw = document.getElementById("payload").value.trim();
      if(!raw) return alert("paste JSON dulu");
      let obj=null;
      try{ obj=JSON.parse(raw); }catch{ return alert("JSON tidak valid"); }
      const r = await API.req("/api/data/import",{method:"POST",body:JSON.stringify(obj)});
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok") alert(r.status);
      else alert("OK: menus="+(r.data?.upserted_menus||0)+" mapped="+(r.data?.mapped_role_menus||0));
    };
  });
})();
