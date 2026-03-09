export default function(Orland){
  async function loadCfg(){ return await Orland.api("/api/config/blogspot"); }
  async function saveCfg(payload){ return await Orland.api("/api/config/blogspot",{ method:"POST", body: JSON.stringify(payload) }); }
  async function testCfg(){ return await Orland.api("/api/blogspot/sites"); }

  return {
    title:"Blogspot Settings",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div>
            <div class="text-xl font-extrabold text-slate-900 dark:text-white">Blogspot Settings</div>
            <div class="text-sm text-slate-500">Konfigurasi integrasi Blogger API read-only via backend.</div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2 flex items-center justify-between rounded-xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                <div>
                  <div class="text-sm font-extrabold">Enable Blogspot Bundle</div>
                  <div class="text-[11px] text-slate-500">Aktifkan integrasi Blogspot</div>
                </div>
                <label class="inline-flex items-center cursor-pointer">
                  <input id="f_enabled" type="checkbox" class="sr-only peer">
                  <div class="relative w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                </label>
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-500">Blog ID</label>
                <input id="f_blog_id" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-500">API Key</label>
                <input id="f_api_key" type="password" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Isi hanya saat update">
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-500">Client ID</label>
                <input id="f_client_id" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-500">Client Secret</label>
                <input id="f_client_secret" type="password" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Isi hanya saat update">
              </div>

              <div class="md:col-span-2">
                <label class="text-[11px] font-bold text-slate-500">Service Account</label>
                <input id="f_service_account" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>
            </div>

            <div class="mt-4 flex gap-2 flex-wrap">
              <button id="btnSave" class="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white">Save</button>
              <button id="btnReload" class="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder">Reload</button>
              <button id="btnTest" class="px-4 py-2 rounded-xl text-xs font-black border border-emerald-200 text-emerald-700">Test</button>
            </div>

            <div id="msg" class="mt-3 text-xs"></div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <div class="text-sm font-extrabold">Test Result</div>
            <pre id="testBox" class="mt-3 text-[11px] whitespace-pre-wrap text-slate-600 dark:text-slate-300">Belum ada test.</pre>
          </div>
        </div>
      `;

      const msg = host.querySelector("#msg");
      const testBox = host.querySelector("#testBox");

      async function reload(){
        const r = await loadCfg();
        if(r.status!=="ok"){
          msg.className = "mt-3 text-xs text-red-500";
          msg.textContent = "Load failed: " + r.status;
          return;
        }
        const d = r.data || {};
        host.querySelector("#f_enabled").checked = !!d.enabled;
        host.querySelector("#f_blog_id").value = d.blog_id || "";
        host.querySelector("#f_api_key").value = "";
        host.querySelector("#f_client_id").value = d.client_id || "";
        host.querySelector("#f_client_secret").value = "";
        host.querySelector("#f_service_account").value = d.service_account || "";
        msg.className = "mt-3 text-xs text-slate-500";
        msg.textContent = "Loaded. API key configured: " + (d.api_key_configured ? "yes" : "no");
      }

      host.querySelector("#btnReload").onclick = reload;

      host.querySelector("#btnSave").onclick = async ()=>{
        const payload = {
          enabled: host.querySelector("#f_enabled").checked,
          blog_id: host.querySelector("#f_blog_id").value.trim(),
          api_key: host.querySelector("#f_api_key").value.trim(),
          client_id: host.querySelector("#f_client_id").value.trim(),
          client_secret: host.querySelector("#f_client_secret").value.trim(),
          service_account: host.querySelector("#f_service_account").value.trim()
        };
        const r = await saveCfg(payload);
        if(r.status!=="ok"){
          msg.className = "mt-3 text-xs text-red-500";
          msg.textContent = "Save failed: " + r.status;
          return;
        }
        msg.className = "mt-3 text-xs text-emerald-600";
        msg.textContent = "Saved.";
        await reload();
      };

      host.querySelector("#btnTest").onclick = async ()=>{
        testBox.textContent = "Testing...";
        const r = await testCfg();
        testBox.textContent = JSON.stringify(r, null, 2);
      };

      await reload();
    }
  };
}
