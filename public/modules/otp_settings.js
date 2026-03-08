export default function OtpSettingsModule(ctx){
  const { api, toast, esc, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">OTP Settings</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Global setting (admin view). Write requires Super Admin.</p>
      </div>
      <div class="flex gap-2">
        <button id="btnSave" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Save</button>
        <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
      </div>
    </div>

    <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 mt-5 space-y-3">
      <div class="flex items-center gap-3">
        <input id="enabled" type="checkbox" class="rounded">
        <label for="enabled" class="text-xs font-bold">Enable OTP</label>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div class="text-[11px] text-slate-500 mb-1">Provider</div>
          <select id="provider" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
            <option value="none">none</option>
            <option value="sms">sms</option>
            <option value="whatsapp">whatsapp</option>
            <option value="email">email</option>
            <option value="custom">custom</option>
          </select>
        </div>
        <div>
          <div class="text-[11px] text-slate-500 mb-1">Config JSON</div>
          <input id="cfgHint" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs" placeholder='e.g. {"api_key":"...","sender":"..."}'>
        </div>
      </div>

      <details class="mt-2">
        <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
        <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
      </details>
    </div>
  `;

  async function load(){
    const r = await api("/api/config/otp");
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Load failed: "+r.status,"error"); return; }
    const row = r.data.row || {};
    el.querySelector("#enabled").checked = !!row.enabled;
    el.querySelector("#provider").value = row.provider || "none";
    el.querySelector("#cfgHint").value = row.config_json || "{}";
  }

  el.querySelector("#btnReload").onclick = load;

  el.querySelector("#btnSave").onclick = async ()=>{
    const enabled = el.querySelector("#enabled").checked;
    const provider = el.querySelector("#provider").value;
    const config_json = el.querySelector("#cfgHint").value || "{}";
    // Validate JSON string
    try{ JSON.parse(config_json); }catch(e){ toast("config_json invalid","error"); return; }

    const r = await api("/api/config/otp", { method:"PUT", body: JSON.stringify({ enabled, provider, config_json }) });
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok") await load();
  };

  return {
    mount(host){
      setBreadcrumb("/ config / otp");
      host.innerHTML="";
      host.appendChild(el);
      load();
    },
    unmount(){}
  };
}
