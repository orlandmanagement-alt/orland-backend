function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

export default function BlogspotSettings(Orland){
  async function getAccount(){ return await Orland.api("/api/integrations/blogspot/account"); }
  async function saveAccount(payload){ return await Orland.api("/api/integrations/blogspot/account",{ method:"POST", body: JSON.stringify(payload) }); }

  return {
    title:"Blogspot API Settings",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="text-sm font-extrabold">Blogspot API Settings</div>
          <div class="text-xs opacity-70 mt-1">Simpan config di D1 (integration_accounts). Tidak panggil API Blogspot dulu—ini “local CMS store”.</div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
              <div class="text-xs font-bold">Status</div>
              <select id="st" class="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                <option value="inactive">inactive</option>
                <option value="active">active</option>
              </select>

              <div class="text-xs font-bold mt-3">Config JSON</div>
              <textarea id="cfg" class="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" style="min-height:220px"
                placeholder='{"blog_id":"...","api_key":"...","oauth":{"client_id":"...","client_secret":"..."}}'></textarea>

              <div class="flex gap-2 mt-3">
                <button id="btnSave" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">Save</button>
                <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
              <div class="text-xs font-bold">Notes</div>
              <div class="text-xs opacity-70 mt-2">
                <div>• Ini menyimpan parameter integrasi.</div>
                <div>• Konten post/page disimpan di tabel <code>cms_items</code>.</div>
                <div>• Widget/Home disimpan di <code>cms_widgets</code>.</div>
                <div class="mt-2">Jika nanti mau sync ke Blogspot asli, tinggal tambah worker task/cron (plugin cron).</div>
              </div>
              <details class="mt-3">
                <summary class="text-xs opacity-70 cursor-pointer">Debug</summary>
                <pre id="dbg" class="text-[11px] opacity-70 mt-2 whitespace-pre-wrap"></pre>
              </details>
            </div>
          </div>
        </div>
      `;

      const $ = (id)=>host.querySelector(id);
      const dbg = $("#dbg");

      async function reload(){
        const r = await getAccount();
        dbg.textContent = JSON.stringify(r,null,2);
        if(r.status!=="ok") return Orland.toast?.("Load failed: "+r.status,"error");
        const acc = r.data.account;
        $("#st").value = acc.status || "inactive";
        try{
          const j = JSON.parse(acc.config_json || "{}");
          $("#cfg").value = JSON.stringify(j, null, 2);
        }catch{
          $("#cfg").value = acc.config_json || "{}";
        }
      }

      $("#btnReload").onclick = reload;
      $("#btnSave").onclick = async ()=>{
        let cfgRaw = $("#cfg").value || "{}";
        // normalize json
        try{ cfgRaw = JSON.stringify(JSON.parse(cfgRaw), null, 0); }catch{}
        const r = await saveAccount({ status: $("#st").value, config_json: cfgRaw });
        dbg.textContent = JSON.stringify(r,null,2);
        if(r.status==="ok") Orland.toast?.("Saved","success");
        else Orland.toast?.("Save failed: "+r.status,"error");
      };

      await reload();
    }
  };
}
