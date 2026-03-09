export default function(Orland){
  async function loadCfg(){
    return await Orland.api("/api/settings/analytics");
  }

  async function saveCfg(payload){
    return await Orland.api("/api/settings/analytics", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function testVisitors(){
    return await Orland.api("/api/analytics/visitors?minutes=15");
  }

  return {
    title:"Analytics Settings",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div>
            <div class="text-xl font-extrabold text-slate-900 dark:text-white">Cloudflare Analytics Settings</div>
            <div class="text-sm text-slate-500">Konfigurasi visitor realtime dashboard.</div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <label class="flex items-center justify-between rounded-xl border border-slate-200 dark:border-darkBorder px-4 py-3 cursor-pointer">
              <div>
                <div class="text-sm font-extrabold">Enable Visitor Analytics</div>
                <div class="text-[11px] text-slate-500">Ambil data visitor dari Cloudflare GraphQL Analytics API</div>
              </div>
              <div class="flex items-center gap-3">
                <span id="enabledText" class="text-xs font-bold text-slate-500">OFF</span>
                <input id="f_enabled" type="checkbox" class="sr-only peer">
                <div class="relative w-11 h-6 bg-slate-200 rounded-full peer dark:bg-slate-700 peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
              </div>
            </label>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label class="text-[11px] font-bold text-slate-500">Account ID</label>
                <input id="f_account_id" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Cloudflare Account ID">
              </div>

              <div>
                <label class="text-[11px] font-bold text-slate-500">Zone Tag</label>
                <input id="f_zone_tag" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Cloudflare Zone ID">
              </div>

              <div class="md:col-span-2">
                <label class="text-[11px] font-bold text-slate-500">API Token</label>
                <input id="f_token" type="password" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Isi hanya saat update">
                <div id="tokenStatus" class="mt-2 text-[11px] text-slate-500"></div>
              </div>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button id="btnSave" class="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white">Save</button>
              <button id="btnReload" class="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder">Reload</button>
              <button id="btnTest" class="px-4 py-2 rounded-xl text-xs font-black border border-emerald-200 text-emerald-700">Test Visitors API</button>
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
      const fEnabled = host.querySelector("#f_enabled");
      const enabledText = host.querySelector("#enabledText");

      function syncToggleText(){
        enabledText.textContent = fEnabled.checked ? "ON" : "OFF";
        enabledText.className = fEnabled.checked
          ? "text-xs font-bold text-emerald-600"
          : "text-xs font-bold text-slate-500";
      }
      fEnabled.addEventListener("change", syncToggleText);

      async function reload(){
        const r = await loadCfg();
        if(r.status!=="ok"){
          msg.className = "mt-3 text-xs text-red-500";
          msg.textContent = "Load failed: " + r.status;
          return;
        }
        const d = r.data || {};
        fEnabled.checked = !!d.enabled;
        syncToggleText();
        host.querySelector("#f_account_id").value = d.account_id || "";
        host.querySelector("#f_zone_tag").value = d.zone_tag || "";
        host.querySelector("#f_token").value = "";
        host.querySelector("#tokenStatus").textContent = d.token_configured ? "Token saved" : "Token not saved";
        msg.className = "mt-3 text-xs text-slate-500";
        msg.textContent = "Loaded.";
      }

      host.querySelector("#btnReload").onclick = reload;

      host.querySelector("#btnSave").onclick = async ()=>{
        msg.className = "mt-3 text-xs text-slate-500";
        msg.textContent = "Saving...";

        const r = await saveCfg({
          enabled: fEnabled.checked,
          account_id: host.querySelector("#f_account_id").value.trim(),
          zone_tag: host.querySelector("#f_zone_tag").value.trim(),
          token: host.querySelector("#f_token").value.trim()
        });

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
        const r = await testVisitors();
        testBox.textContent = JSON.stringify(r, null, 2);
      };

      await reload();
    }
  };
}
