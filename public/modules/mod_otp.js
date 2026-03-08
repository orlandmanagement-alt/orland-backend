export async function mount(ctx){
  const { host, api, toast } = ctx;
  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="text-sm font-bold">OTP Settings</div>
      <div class="text-xs text-slate-500 mt-2">Saved in system_settings key: otp_global</div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2">
        <label class="flex items-center gap-2 text-xs">
          <input id="otpEnabled" type="checkbox"> <span>Enabled</span>
        </label>
        <select id="otpProvider" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
          <option value="none">none</option>
          <option value="wa">wa</option>
          <option value="sms">sms</option>
          <option value="email">email</option>
        </select>
        <button id="otpSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Save</button>
      </div>

      <textarea id="otpConfig" class="mt-3 w-full h-40 text-[11px] bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-xl p-3" spellcheck="false">{}</textarea>
      <pre id="otpOut" class="mt-3 text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
    </div>
  `;

  async function load(){
    const r = await api("/api/config/otp");
    if(r.status!=="ok"){ toast("otp get failed: "+r.status,"error"); return; }
    const v = r.data.value || {};
    document.getElementById("otpEnabled").checked = !!v.enabled;
    document.getElementById("otpProvider").value = v.provider || "none";
    document.getElementById("otpConfig").value = JSON.stringify(v.config||{}, null, 2);
  }

  document.getElementById("otpSave").onclick = async ()=>{
    let cfg = {};
    try{ cfg = JSON.parse(document.getElementById("otpConfig").value||"{}"); }catch{ return toast("config_json invalid","error"); }
    const payload = {
      enabled: document.getElementById("otpEnabled").checked ? 1 : 0,
      provider: document.getElementById("otpProvider").value,
      config: cfg
    };
    const r = await api("/api/config/otp",{ method:"POST", body: JSON.stringify(payload) });
    document.getElementById("otpOut").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };

  await load();
}
