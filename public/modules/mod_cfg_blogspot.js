export default function(Orland){
  async function apiGet(){
    return await Orland.api("/api/config/blogspot");
  }
  async function apiSave(payload){
    return await Orland.api("/api/config/blogspot", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"Blogspot Settings",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-5xl">
          <div>
            <div class="text-2xl font-extrabold">Blogspot Settings</div>
            <div class="text-slate-500 mt-1">Konfigurasi Blogger API via backend config.</div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5 space-y-4">
            <label class="flex items-center gap-3">
              <input id="enabled" type="checkbox">
              <span class="font-bold">Enable Blogspot</span>
            </label>

            <div>
              <label class="block text-sm font-bold text-slate-500 mb-2">Blog ID</label>
              <input id="blog_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
            </div>

            <div>
              <label class="block text-sm font-bold text-slate-500 mb-2">API Key</label>
              <input id="api_key" type="password" placeholder="Isi hanya saat update" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              <div id="apiInfo" class="text-sm text-slate-500 mt-2"></div>
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

      async function loadData(){
        const r = await apiGet();
        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Failed: " + r.status;
          return;
        }
        const d = r.data || {};
        q("enabled").checked = !!d.enabled;
        q("blog_id").value = d.blog_id || "";
        q("apiInfo").textContent = d.api_key_configured ? ("API key saved " + (d.api_key_masked || "")) : "API key not saved";
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Loaded.";
      }

      q("btnReload").onclick = loadData;

      q("btnSave").onclick = async ()=>{
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Saving...";
        const r = await apiSave({
          enabled: q("enabled").checked,
          blog_id: q("blog_id").value.trim(),
          api_key: q("api_key").value.trim()
        });
        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Save failed: " + r.status;
          return;
        }
        q("api_key").value = "";
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Saved.";
        await loadData();
      };

      await loadData();
    }
  };
}
