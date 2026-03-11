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
  async function apiTest(){
    return await Orland.api("/api/blogspot/posts?maxResults=5");
  }

  return {
    title:"Blogspot Settings",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div>
            <div class="text-2xl font-extrabold">Blogspot Settings</div>
            <div class="text-slate-500 mt-1">Konfigurasi Blogger API read-only via backend.</div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-2xl font-extrabold">Enable Blogspot Bundle</div>
                  <div class="text-slate-500 mt-1">Aktifkan integrasi Blogspot read-only</div>
                </div>
                <label class="inline-flex items-center cursor-pointer">
                  <input id="enabled" type="checkbox" class="sr-only peer">
                  <div class="w-14 h-8 bg-slate-200 rounded-full peer peer-checked:bg-primary relative">
                    <span class="absolute top-1 left-1 bg-white w-6 h-6 rounded-full transition peer-checked:translate-x-6"></span>
                  </div>
                </label>
              </div>
            </div>

            <div class="mt-5 space-y-4">
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
                Untuk read-only Blogger API, cukup gunakan <b>Blog ID</b> dan <b>API Key</b>. Service account dan client secret tidak dipakai di mode ini.
              </div>

              <div class="flex gap-3 flex-wrap">
                <button id="btnSave" class="px-6 py-3 rounded-2xl bg-primary text-white font-black">Save</button>
                <button id="btnReload" class="px-6 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">Reload</button>
                <button id="btnTest" class="px-6 py-3 rounded-2xl border border-emerald-200 text-emerald-700 font-black">Test Posts API</button>
              </div>

              <div id="msg" class="text-sm"></div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">Test Result</div>
            <pre id="testResult" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
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
        q("apiInfo").textContent = d.api_key_configured ? "API key saved" : "API key not saved";
        q("msg").className = "text-sm text-slate-500";
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

      q("btnTest").onclick = async ()=>{
        q("testResult").textContent = "Loading...";
        const r = await apiTest();
        q("testResult").textContent = JSON.stringify(r, null, 2);
      };

      await loadData();
    }
  };
}
