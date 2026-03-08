export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm font-bold">OTP Settings</div>
        <div class="text-xs text-slate-500">Disimpan di system_settings</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <label class="flex items-center gap-2 text-xs">
          <input id="enabled" type="checkbox">
          <span>Enable OTP</span>
        </label>

        <div class="text-xs font-bold">Provider</div>
        <select id="provider" class="w-full text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="none">none</option>
          <option value="wa">wa</option>
          <option value="sms">sms</option>
          <option value="email">email</option>
        </select>

        <div class="text-xs font-bold">config_json</div>
        <textarea id="cfg" class="w-full h-40 text-[11px] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">{}</textarea>

        <button id="save" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600 w-full">Save</button>

        <details>
          <summary class="text-xs text-slate-500">Debug</summary>
          <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
        </details>
      </div>
    </div>
  `;

  const st = await api("/api/config/otp");
  document.getElementById("dbg").textContent = JSON.stringify(st,null,2);
  if(st.status==="ok"){
    document.getElementById("enabled").checked = !!st.data.enabled;
    document.getElementById("provider").value = st.data.provider || "none";
    document.getElementById("cfg").value = st.data.config_json || "{}";
  }

  document.getElementById("save").onclick = async ()=>{
    const enabled = document.getElementById("enabled").checked;
    const provider = document.getElementById("provider").value;
    const cfgRaw = document.getElementById("cfg").value || "{}";
    try{ JSON.parse(cfgRaw); }catch{ toast("config_json invalid JSON","error"); return; }

    const r = await api("/api/config/otp", { method:"PUT", body: JSON.stringify({ enabled, provider, config_json: cfgRaw }) });
    document.getElementById("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };
}
