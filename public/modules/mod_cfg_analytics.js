export default function(Orland){
  async function apiGet(){ return await Orland.api("/api/config/analytics"); }
  async function apiSave(payload){
    return await Orland.api("/api/config/analytics", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"Analytics Settings",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-5xl">
          <div>
            <div class="text-2xl font-extrabold ui-title-gradient">Analytics Settings</div>
            <div class="text-slate-500 mt-1">Konfigurasi Cloudflare analytics backend.</div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5 space-y-4">
            <label class="flex items-center gap-3">
              <input id="enabled" type="checkbox">
              <span class="font-bold">Enable Analytics</span>
            </label>

            <div>
              <label class="block text-sm font-bold text-slate-500 mb-2">CF Account ID</label>
              <input id="cf_account_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
            </div>

            <div>
              <label class="block text-sm font-bold text-slate-500 mb-2">CF Zone Tag</label>
              <input id="cf_zone_tag" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
            </div>

            <div>
              <label class="block text-sm font-bold text-slate-500 mb-2">CF API Token</label>
              <input id="cf_api_token" type="password" placeholder="Isi hanya saat update" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              <div id="tokenInfo" class="text-sm text-slate-500 mt-2"></div>
            </div>

            <div class="flex gap-3 flex-wrap">
              <button id="btnSave" class="px-6 py-3 rounded-2xl bg-primary text-white font-black">Save</button>
              <button id="btnReload" class="px-6 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">Reload</button>
            </div>

            <div id="msg" class="text-sm text-slate-500"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);

      async function load(){
        const r = await apiGet();
        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Failed: " + r.status;
          return;
        }
        const d = r.data || {};
        q("enabled").checked = !!d.enabled;
        q("cf_account_id").value = d.cf_account_id || "";
        q("cf_zone_tag").value = d.cf_zone_tag || "";
        q("tokenInfo").textContent = d.cf_api_token_configured ? ("Token saved " + (d.cf_api_token_masked || "")) : "Token not saved";
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Loaded.";
      }

      q("btnReload").onclick = load;
      q("btnSave").onclick = async ()=>{
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Saving...";
        const r = await apiSave({
          enabled: q("enabled").checked,
          cf_account_id: q("cf_account_id").value.trim(),
          cf_zone_tag: q("cf_zone_tag").value.trim(),
          cf_api_token: q("cf_api_token").value.trim()
        });
        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Save failed: " + r.status;
          return;
        }
        q("cf_api_token").value = "";
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Saved.";
        await load();
      };

      await load();
    }
  };
}
