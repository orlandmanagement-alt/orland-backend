export default function(Orland){
  async function apiGet(){ return await Orland.api("/api/config/verify"); }
  async function apiSave(payload){
    return await Orland.api("/api/config/verify", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"Verification Settings",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-5xl">
          <div>
            <div class="text-2xl font-extrabold ui-title-gradient">Verification Settings</div>
            <div class="text-slate-500 mt-1">Atur requirement verifikasi global.</div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5 space-y-4">
            <label class="flex items-center gap-3"><input id="require_email" type="checkbox"><span class="font-bold">Require Email</span></label>
            <label class="flex items-center gap-3"><input id="require_phone" type="checkbox"><span class="font-bold">Require Phone</span></label>
            <label class="flex items-center gap-3"><input id="require_pin" type="checkbox"><span class="font-bold">Require PIN</span></label>
            <label class="flex items-center gap-3"><input id="require_ktp" type="checkbox"><span class="font-bold">Require KTP</span></label>
            <label class="flex items-center gap-3"><input id="require_selfie" type="checkbox"><span class="font-bold">Require Selfie</span></label>

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
        q("require_email").checked = !!d.require_email;
        q("require_phone").checked = !!d.require_phone;
        q("require_pin").checked = !!d.require_pin;
        q("require_ktp").checked = !!d.require_ktp;
        q("require_selfie").checked = !!d.require_selfie;
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Loaded.";
      }

      q("btnReload").onclick = load;
      q("btnSave").onclick = async ()=>{
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Saving...";
        const r = await apiSave({
          require_email: q("require_email").checked,
          require_phone: q("require_phone").checked,
          require_pin: q("require_pin").checked,
          require_ktp: q("require_ktp").checked,
          require_selfie: q("require_selfie").checked
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
