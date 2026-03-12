export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadConfig(){
    return await Orland.api("/api/blogspot/config");
  }

  async function saveConfig(payload){
    return await Orland.api("/api/blogspot/config", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function loadSyncConfig(){
    return await Orland.api("/api/blogspot/sync_config");
  }

  async function saveSyncConfig(payload){
    return await Orland.api("/api/blogspot/sync_config", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function loadSites(){
    return await Orland.api("/api/blogspot/sites_multi");
  }

  return {
    title:"Blogspot Settings",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-6xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold">Blogspot Settings</div>
              <div class="text-sm text-slate-500">API, OAuth, sync, queue, dan multi-site quick settings.</div>
            </div>
            <button id="btnReload" class="px-4 py-3 rounded-2xl border font-black text-sm">Reload</button>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <form id="cfgForm" class="rounded-3xl border p-5 space-y-4">
              <div class="text-xl font-extrabold">API / OAuth</div>
              <label class="flex items-center gap-3"><input id="enabled" type="checkbox"><span class="font-semibold text-sm">Blogspot Enabled</span></label>
              <input id="blog_id" class="w-full px-4 py-3 rounded-2xl border" placeholder="blog_id">
              <input id="api_key" class="w-full px-4 py-3 rounded-2xl border" placeholder="api_key">
              <label class="flex items-center gap-3"><input id="oauth_enabled" type="checkbox"><span class="font-semibold text-sm">OAuth Enabled</span></label>
              <input id="client_id" class="w-full px-4 py-3 rounded-2xl border" placeholder="client_id">
              <input id="client_secret" class="w-full px-4 py-3 rounded-2xl border" placeholder="client_secret">
              <input id="refresh_token" class="w-full px-4 py-3 rounded-2xl border" placeholder="refresh_token">
              <div class="flex gap-2">
                <button class="px-4 py-3 rounded-2xl bg-black text-white font-black text-sm">Save API/OAuth</button>
              </div>
            </form>

            <form id="syncForm" class="rounded-3xl border p-5 space-y-4">
              <div class="text-xl font-extrabold">Sync / Queue</div>
              <label class="flex items-center gap-3"><input id="sync_enabled" type="checkbox"><span class="font-semibold text-sm">Sync Enabled</span></label>
              <label class="flex items-center gap-3"><input id="auto_sync_enabled" type="checkbox"><span class="font-semibold text-sm">Auto Sync Enabled</span></label>
              <input id="sync_interval_min" type="number" class="w-full px-4 py-3 rounded-2xl border" placeholder="sync_interval_min">
              <select id="sync_direction" class="w-full px-4 py-3 rounded-2xl border">
                <option value="pull">pull</option>
                <option value="push">push</option>
                <option value="bidirectional">bidirectional</option>
              </select>
              <select id="cron_driver" class="w-full px-4 py-3 rounded-2xl border">
                <option value="cron_trigger">cron_trigger</option>
                <option value="worker_http">worker_http</option>
                <option value="queue">queue</option>
                <option value="manual">manual</option>
              </select>
              <input id="cron_endpoint" class="w-full px-4 py-3 rounded-2xl border" placeholder="cron_endpoint">
              <input id="cron_secret" class="w-full px-4 py-3 rounded-2xl border" placeholder="cron_secret">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label class="flex items-center gap-3"><input id="sync_posts_enabled" type="checkbox"><span class="font-semibold text-sm">Posts</span></label>
                <label class="flex items-center gap-3"><input id="sync_pages_enabled" type="checkbox"><span class="font-semibold text-sm">Pages</span></label>
                <label class="flex items-center gap-3"><input id="sync_widgets_enabled" type="checkbox"><span class="font-semibold text-sm">Widgets</span></label>
              </div>
              <div class="flex gap-2">
                <button class="px-4 py-3 rounded-2xl bg-black text-white font-black text-sm">Save Sync</button>
              </div>
            </form>
          </div>

          <div class="rounded-3xl border p-5">
            <div class="text-xl font-extrabold">Multi Site Snapshot</div>
            <div id="sitesBox" class="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"></div>
          </div>

          <div class="rounded-3xl border p-5">
            <div class="text-xl font-extrabold">Raw Output</div>
            <pre id="rawBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 rounded-2xl p-4">{}</pre>
          </div>
        </div>
      `;

      const q = id => host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderSites(items){
        q("sitesBox").innerHTML = !items.length
          ? `<div class="text-sm text-slate-500">No sites.</div>`
          : items.map(x => `
            <div class="rounded-2xl border p-4">
              <div class="text-sm font-extrabold">${esc(x.blog_name || "-")}</div>
              <div class="text-xs text-slate-500 mt-1">${esc(x.id || "-")}</div>
              <div class="text-xs text-slate-500 mt-1">${esc(x.blog_id || "-")}</div>
              <div class="text-xs text-slate-500 mt-1">${esc(x.blog_url || "-")}</div>
            </div>
          `).join("");
      }

      async function render(){
        setMsg("muted", "Loading settings...");
        const [cfgRes, syncRes, sitesRes] = await Promise.all([
          loadConfig(),
          loadSyncConfig(),
          loadSites()
        ]);

        q("rawBox").textContent = JSON.stringify({ cfgRes, syncRes, sitesRes }, null, 2);

        if(cfgRes.status === "ok"){
          const d = cfgRes.data || {};
          q("enabled").checked = !!d.enabled;
          q("blog_id").value = d.blog_id || "";
          q("api_key").value = d.api_key || "";
          q("oauth_enabled").checked = !!d.oauth_enabled;
          q("client_id").value = d.client_id || "";
          q("client_secret").value = d.client_secret || "";
          q("refresh_token").value = d.refresh_token || "";
        }

        if(syncRes.status === "ok"){
          const d = syncRes.data || {};
          q("sync_enabled").checked = String(d.enabled || "0") === "1";
          q("auto_sync_enabled").checked = String(d.auto_sync_enabled || "0") === "1";
          q("sync_interval_min").value = d.sync_interval_min || "15";
          q("sync_direction").value = d.sync_direction || "bidirectional";
          q("cron_driver").value = d.cron_driver || "cron_trigger";
          q("cron_endpoint").value = d.cron_endpoint || "";
          q("cron_secret").value = d.cron_secret || "";
          q("sync_posts_enabled").checked = String(d.sync_posts_enabled || "1") === "1";
          q("sync_pages_enabled").checked = String(d.sync_pages_enabled || "1") === "1";
          q("sync_widgets_enabled").checked = String(d.sync_widgets_enabled || "1") === "1";
        }

        renderSites(sitesRes.status === "ok" ? (Array.isArray(sitesRes.data?.items) ? sitesRes.data.items : []) : []);
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;

      q("cfgForm").onsubmit = async (e)=>{
        e.preventDefault();
        setMsg("muted", "Saving API/OAuth...");
        const r = await saveConfig({
          enabled: q("enabled").checked,
          blog_id: q("blog_id").value.trim(),
          api_key: q("api_key").value.trim(),
          oauth_enabled: q("oauth_enabled").checked,
          client_id: q("client_id").value.trim(),
          client_secret: q("client_secret").value.trim(),
          refresh_token: q("refresh_token").value.trim()
        });
        q("rawBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Save failed: " + r.status);
          return;
        }
        setMsg("success", "API/OAuth saved.");
        await render();
      };

      q("syncForm").onsubmit = async (e)=>{
        e.preventDefault();
        setMsg("muted", "Saving sync...");
        const r = await saveSyncConfig({
          enabled: q("sync_enabled").checked,
          auto_sync_enabled: q("auto_sync_enabled").checked,
          sync_interval_min: Number(q("sync_interval_min").value || 15),
          sync_direction: q("sync_direction").value,
          cron_driver: q("cron_driver").value,
          cron_endpoint: q("cron_endpoint").value.trim(),
          cron_secret: q("cron_secret").value.trim(),
          sync_posts_enabled: q("sync_posts_enabled").checked,
          sync_pages_enabled: q("sync_pages_enabled").checked,
          sync_widgets_enabled: q("sync_widgets_enabled").checked
        });
        q("rawBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Save failed: " + r.status);
          return;
        }
        setMsg("success", "Sync settings saved.");
        await render();
      };

      await render();
    }
  };
}
