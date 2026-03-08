export default function BlogspotSettings(Orland){
  return {
    title: "Blogspot • API Settings",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-bold">Blogspot Integration</div>
              <div class="text-xs text-slate-500">Simpan API key/credential di config_json (D1). Mode: inactive/active.</div>
            </div>
            <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">Reload</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <div>
              <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Status</label>
              <select id="status" class="w-full mt-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder">
                <option value="inactive">inactive</option>
                <option value="active">active</option>
              </select>
            </div>

            <div>
              <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Blog ID (optional)</label>
              <input id="blog_id" placeholder="contoh: 1234567890" class="w-full mt-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder">
            </div>

            <div class="md:col-span-2">
              <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Config JSON</label>
              <textarea id="cfg" rows="8" class="w-full mt-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder font-mono text-xs"
                placeholder='{"api_key":"...","client_id":"...","client_secret":"...","redirect_uri":"..."}'></textarea>
            </div>
          </div>

          <div class="flex gap-2 mt-4">
            <button id="btnSave" class="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white">Save</button>
            <button id="btnDisable" class="px-4 py-2 rounded-lg text-xs font-bold bg-danger text-white">Disable</button>
          </div>

          <details class="mt-4">
            <summary class="text-xs text-slate-500">Debug</summary>
            <pre id="out" class="text-[11px] whitespace-pre-wrap text-slate-500 mt-2"></pre>
          </details>
        </div>
      `;

      const out = host.querySelector("#out");
      const load = async ()=>{
        const r = await Orland.api("/api/integrations/blogspot");
        out.textContent = JSON.stringify(r,null,2);
        if(r.status!=="ok") return Orland.toast("Load failed: "+r.status,"error");
        const acc = r.data.account || {};
        host.querySelector("#status").value = acc.status || "inactive";

        const cfg = acc.config || {};
        host.querySelector("#blog_id").value = cfg.blog_id || "";
        host.querySelector("#cfg").value = JSON.stringify(cfg, null, 2);
      };

      host.querySelector("#btnReload").onclick = load;

      host.querySelector("#btnDisable").onclick = async ()=>{
        const rr = await Orland.api("/api/integrations/blogspot", {
          method:"POST",
          body: JSON.stringify({ status:"inactive", config:{} })
        });
        out.textContent = JSON.stringify(rr,null,2);
        Orland.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") await load();
      };

      host.querySelector("#btnSave").onclick = async ()=>{
        let cfg = {};
        try{ cfg = JSON.parse(host.querySelector("#cfg").value || "{}"); }catch{ return Orland.toast("Config JSON invalid","error"); }
        const blog_id = (host.querySelector("#blog_id").value||"").trim();
        if(blog_id) cfg.blog_id = blog_id;

        const status = host.querySelector("#status").value;
        const rr = await Orland.api("/api/integrations/blogspot", {
          method:"POST",
          body: JSON.stringify({ status, config: cfg })
        });
        out.textContent = JSON.stringify(rr,null,2);
        Orland.toast(rr.status, rr.status==="ok"?"success":"error");
      };

      await load();
    }
  };
}
