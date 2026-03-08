export default function VerificationSettingsModule(ctx){
  const { api, toast, esc, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Verification Settings</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Global policy (admin view). Write requires Super Admin.</p>
      </div>
      <div class="flex gap-2">
        <button id="btnSave" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Save</button>
        <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
      </div>
    </div>

    <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 mt-5 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label class="flex items-center gap-2 text-xs font-bold"><input id="require_email" type="checkbox" class="rounded"> Require Email Verified</label>
        <label class="flex items-center gap-2 text-xs font-bold"><input id="require_phone" type="checkbox" class="rounded"> Require Phone Verified</label>
        <label class="flex items-center gap-2 text-xs font-bold"><input id="require_pin" type="checkbox" class="rounded"> Require PIN (2nd factor)</label>
        <label class="flex items-center gap-2 text-xs font-bold"><input id="require_ktp" type="checkbox" class="rounded"> Require KTP</label>
        <label class="flex items-center gap-2 text-xs font-bold"><input id="require_selfie" type="checkbox" class="rounded"> Require Selfie</label>
      </div>

      <div>
        <div class="text-[11px] text-slate-500 mb-1">Config JSON</div>
        <textarea id="cfg" class="w-full h-32 p-3 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs font-mono" placeholder='{}'></textarea>
      </div>

      <details class="mt-2">
        <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
        <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
      </details>
    </div>
  `;

  async function load(){
    const r = await api("/api/config/verification");
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Load failed: "+r.status,"error"); return; }
    const row = r.data.row || {};
    el.querySelector("#require_email").checked = !!row.require_email;
    el.querySelector("#require_phone").checked = !!row.require_phone;
    el.querySelector("#require_pin").checked = !!row.require_pin;
    el.querySelector("#require_ktp").checked = !!row.require_ktp;
    el.querySelector("#require_selfie").checked = !!row.require_selfie;
    el.querySelector("#cfg").value = row.config_json || "{}";
  }

  el.querySelector("#btnReload").onclick = load;

  el.querySelector("#btnSave").onclick = async ()=>{
    const require_email = el.querySelector("#require_email").checked;
    const require_phone = el.querySelector("#require_phone").checked;
    const require_pin = el.querySelector("#require_pin").checked;
    const require_ktp = el.querySelector("#require_ktp").checked;
    const require_selfie = el.querySelector("#require_selfie").checked;
    const config_json = el.querySelector("#cfg").value || "{}";
    try{ JSON.parse(config_json); }catch(e){ toast("config_json invalid","error"); return; }

    const r = await api("/api/config/verification", { method:"PUT", body: JSON.stringify({ require_email, require_phone, require_pin, require_ktp, require_selfie, config_json }) });
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok") await load();
  };

  return {
    mount(host){
      setBreadcrumb("/ config / verification");
      host.innerHTML="";
      host.appendChild(el);
      load();
    },
    unmount(){}
  };
}
