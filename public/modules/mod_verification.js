export async function mount(ctx){
  const { host, api, toast } = ctx;
  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="text-sm font-bold">Verification Settings</div>
      <div class="text-xs text-slate-500 mt-2">Saved in system_settings key: verify_global</div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
        ${ck("require_email","Email")}
        ${ck("require_phone","Phone")}
        ${ck("require_pin","PIN")}
        ${ck("require_ktp","KTP")}
        ${ck("require_selfie","Selfie")}
      </div>

      <button id="vfSave" class="mt-3 text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Save</button>

      <textarea id="vfConfig" class="mt-3 w-full h-32 text-[11px] bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-xl p-3" spellcheck="false">{}</textarea>
      <pre id="vfOut" class="mt-3 text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
    </div>
  `;

  async function load(){
    const r = await api("/api/config/verification");
    if(r.status!=="ok"){ toast("verify get failed: "+r.status,"error"); return; }
    const v = r.data.value || {};
    set("require_email", v.require_email);
    set("require_phone", v.require_phone);
    set("require_pin", v.require_pin);
    set("require_ktp", v.require_ktp);
    set("require_selfie", v.require_selfie);
    document.getElementById("vfConfig").value = JSON.stringify(v.config||{}, null, 2);
  }

  document.getElementById("vfSave").onclick = async ()=>{
    let cfg = {};
    try{ cfg = JSON.parse(document.getElementById("vfConfig").value||"{}"); }catch{ return toast("config_json invalid","error"); }
    const payload = {
      require_email: get("require_email"),
      require_phone: get("require_phone"),
      require_pin: get("require_pin"),
      require_ktp: get("require_ktp"),
      require_selfie: get("require_selfie"),
      config: cfg
    };
    const r = await api("/api/config/verification",{ method:"POST", body: JSON.stringify(payload) });
    document.getElementById("vfOut").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };

  await load();
}

function ck(id,label){
  return `<label class="flex items-center gap-2"><input id="${id}" type="checkbox"> <span>${label}</span></label>`;
}
function set(id,v){ document.getElementById(id).checked = !!Number(v||0); }
function get(id){ return document.getElementById(id).checked ? 1 : 0; }
