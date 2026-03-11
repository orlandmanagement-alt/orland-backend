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
  async function apiGetSync(){
    return await Orland.api("/api/blogspot/sync_config");
  }
  async function apiSaveSync(payload){
    return await Orland.api("/api/blogspot/sync_config", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }
  async function apiRunSync(){
    return await Orland.api("/api/blogspot/sync_run", {
      method:"POST",
      body: JSON.stringify({})
    });
  }
  async function apiStatus(){
    return await Orland.api("/api/blogspot/sync_status");
  }
  async function apiTest(){
    return await Orland.api("/api/blogspot/posts?source=remote&maxResults=5");
  }

  return {
    title:"Blogspot Settings",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-6xl">
          <div>
            <div class="text-2xl font-extrabold">Blogspot Settings</div>
            <div class="text-slate-500 mt-1">Read-only Blogger API + local CMS bundle + sync settings.</div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">API Config</div>
            <div class="mt-4 space-y-4">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <div class="text-xl font-extrabold">Enable Blogspot Bundle</div>
                    <div class="text-slate-500 mt-1">Aktifkan integrasi Blogspot dan local CMS</div>
                  </div>
                  <label class="inline-flex items-center cursor-pointer">
                    <input id="enabled" type="checkbox" class="sr-only peer">
                    <div class="w-14 h-8 bg-slate-200 rounded-full peer peer-checked:bg-primary relative">
                      <span class="absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition peer-checked:translate-x-6"></span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Blog ID</label>
                <input id="blog_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">API Key</label>
                <input id="api_key" type="password" placeholder="Isi hanya saat update" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
                <div id="apiInfo" class="text-sm text-slate-500 mt-2"></div>
              </div>

              <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                API Key hanya untuk read-only Blogger API. Write ke Blogger nanti butuh OAuth user auth.
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Sync / Cron Settings</div>
            <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <input id="sync_enabled" type="checkbox">
                <div>
                  <div class="font-black">Enable Sync</div>
                  <div class="text-xs text-slate-500">Aktifkan sync runner</div>
                </div>
              </label>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <input id="auto_sync_enabled" type="checkbox">
                <div>
                  <div class="font-black">Auto Sync</div>
                  <div class="text-xs text-slate-500">Untuk cron / worker trigger</div>
                </div>
              </label>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Sync Interval (minutes)</label>
                <input id="sync_interval_min" type="number" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Sync Direction</label>
                <select id="sync_direction" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
                  <option value="pull">pull</option>
                  <option value="push">push</option>
                  <option value="bidirectional">bidirectional</option>
                </select>
              </div>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <input id="sync_posts_enabled" type="checkbox">
                <div><div class="font-black">Sync Posts</div></div>
              </label>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <input id="sync_pages_enabled" type="checkbox">
                <div><div class="font-black">Sync Pages</div></div>
              </label>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <input id="sync_widgets_enabled" type="checkbox">
                <div><div class="font-black">Sync Widgets</div></div>
              </label>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Cron Driver</label>
                <select id="cron_driver" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
                  <option value="cron_trigger">cron_trigger</option>
                  <option value="worker_http">worker_http</option>
                  <option value="queue">queue</option>
                  <option value="manual">manual</option>
                </select>
              </div>

              <div class="lg:col-span-2">
                <label class="block text-sm font-bold text-slate-500 mb-2">Cron Endpoint / Worker Route</label>
                <input id="cron_endpoint" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark" placeholder="/api/cron/blogspot-sync or worker url">
              </div>
            </div>

            <div class="mt-5 flex gap-3 flex-wrap">
              <button id="btnSave" class="px-6 py-3 rounded-2xl bg-primary text-white font-black">Save API Config</button>
              <button id="btnSaveSync" class="px-6 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">Save Sync</button>
              <button id="btnRunSync" class="px-6 py-3 rounded-2xl border border-emerald-200 text-emerald-700 font-black">Run Sync</button>
              <button id="btnReload" class="px-6 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">Reload</button>
              <button id="btnTest" class="px-6 py-3 rounded-2xl border border-amber-200 text-amber-700 font-black">Test Remote Posts</button>
            </div>

            <div id="msg" class="text-sm mt-4"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Sync Status</div>
            <pre id="statusBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Test Result</div>
            <pre id="testResult" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);

      async function loadData(){
        const [cfg, sync, status] = await Promise.all([
          apiGet(),
          apiGetSync(),
          apiStatus()
        ]);

        if(cfg.status !== "ok"){
          q("msg").className = "text-sm text-red-500 mt-4";
          q("msg").textContent = "Failed: " + cfg.status;
          return;
        }

        const d = cfg.data || {};
        q("enabled").checked = !!d.enabled;
        q("blog_id").value = d.blog_id || "";
        q("apiInfo").textContent = d.api_key_configured ? "API key saved" : "API key not saved";

        if(sync.status === "ok"){
          const s = sync.data || {};
          q("sync_enabled").checked = s.enabled === "1";
          q("auto_sync_enabled").checked = s.auto_sync_enabled === "1";
          q("sync_interval_min").value = s.sync_interval_min || "15";
          q("sync_direction").value = s.sync_direction || "bidirectional";
          q("sync_posts_enabled").checked = s.sync_posts_enabled !== "0";
          q("sync_pages_enabled").checked = s.sync_pages_enabled !== "0";
          q("sync_widgets_enabled").checked = s.sync_widgets_enabled !== "0";
          q("cron_driver").value = s.cron_driver || "cron_trigger";
          q("cron_endpoint").value = s.cron_endpoint || "";
        }

        q("statusBox").textContent = JSON.stringify(status, null, 2);
        q("msg").className = "text-sm text-emerald-600 mt-4";
        q("msg").textContent = "Loaded.";
      }

      q("btnReload").onclick = loadData;

      q("btnSave").onclick = async ()=>{
        q("msg").className = "text-sm text-slate-500 mt-4";
        q("msg").textContent = "Saving API config...";
        const r = await apiSave({
          enabled: q("enabled").checked,
          blog_id: q("blog_id").value.trim(),
          api_key: q("api_key").value.trim()
        });
        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500 mt-4";
          q("msg").textContent = "Save failed: " + r.status;
          return;
        }
        q("api_key").value = "";
        q("msg").className = "text-sm text-emerald-600 mt-4";
        q("msg").textContent = "API config saved.";
        await loadData();
      };

      q("btnSaveSync").onclick = async ()=>{
        q("msg").className = "text-sm text-slate-500 mt-4";
        q("msg").textContent = "Saving sync config...";
        const r = await apiSaveSync({
          enabled: q("sync_enabled").checked,
          auto_sync_enabled: q("auto_sync_enabled").checked,
          sync_interval_min: Number(q("sync_interval_min").value || 15),
          sync_posts_enabled: q("sync_posts_enabled").checked,
          sync_pages_enabled: q("sync_pages_enabled").checked,
          sync_widgets_enabled: q("sync_widgets_enabled").checked,
          sync_direction: q("sync_direction").value,
          cron_driver: q("cron_driver").value,
          cron_endpoint: q("cron_endpoint").value.trim()
        });
        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500 mt-4";
          q("msg").textContent = "Save sync failed: " + r.status;
          return;
        }
        q("msg").className = "text-sm text-emerald-600 mt-4";
        q("msg").textContent = "Sync config saved.";
        await loadData();
      };

      q("btnRunSync").onclick = async ()=>{
        q("statusBox").textContent = "Running...";
        const r = await apiRunSync();
        q("statusBox").textContent = JSON.stringify(r, null, 2);
        await loadData();
      };

      q("btnTest").onclick = async ()=>{
        q("testResult").textContent = "Loading...";
        const r = await apiTest();
        q("testResult").textContent = JSON.stringify(r, null, 2);
      };

      await loadData();
    }
  };
}
