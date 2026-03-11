export default function(Orland){
  async function apiGet(){ return await Orland.api("/api/config/otp"); }
  async function apiSave(payload){
    return await Orland.api("/api/config/otp", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"OTP Settings",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-5xl">
          <div>
            <div class="text-2xl font-extrabold ui-title-gradient">OTP Settings</div>
            <div class="text-slate-500 mt-1">Konfigurasi OTP global berbasis config.</div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5 space-y-4">
            <label class="flex items-center gap-3">
              <input id="enabled" type="checkbox">
              <span class="font-bold">Enable OTP</span>
            </label>

            <div>
              <label class="block text-sm font-bold text-slate-500 mb-2">Provider</label>
              <select id="provider" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
                <option value="none">none</option>
                <option value="email">email</option>
                <option value="sms">sms</option>
              </select>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">TTL Sec</label>
                <input id="ttl_sec" type="number" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Max Attempts</label>
                <input id="max_attempts" type="number" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Resend Sec</label>
                <input id="resend_sec" type="number" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              </div>
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
        q("provider").value = d.provider || "none";
        q("ttl_sec").value = d.ttl_sec || 300;
        q("max_attempts").value = d.max_attempts || 5;
        q("resend_sec").value = d.resend_sec || 60;
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Loaded.";
      }

      q("btnReload").onclick = load;
      q("btnSave").onclick = async ()=>{
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Saving...";
        const r = await apiSave({
          enabled: q("enabled").checked,
          provider: q("provider").value,
          ttl_sec: Number(q("ttl_sec").value || 300),
          max_attempts: Number(q("max_attempts").value || 5),
          resend_sec: Number(q("resend_sec").value || 60)
        });
        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Save failed: " + r.status;
          return;
        }
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Saved.";
        await load();
      };

      await load();
    }
  };
}
