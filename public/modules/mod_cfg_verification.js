export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm font-bold">Verification Settings</div>
        <div class="text-xs text-slate-500">2 langkah: email/phone/pin + optional KTP/selfie</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <label class="flex items-center gap-2 text-xs"><input id="re" type="checkbox"> <span>Require Email</span></label>
        <label class="flex items-center gap-2 text-xs"><input id="rp" type="checkbox"> <span>Require Phone</span></label>
        <label class="flex items-center gap-2 text-xs"><input id="rpin" type="checkbox"> <span>Require PIN</span></label>
        <label class="flex items-center gap-2 text-xs"><input id="rktp" type="checkbox"> <span>Require KTP (optional)</span></label>
        <label class="flex items-center gap-2 text-xs"><input id="rselfie" type="checkbox"> <span>Require Selfie (optional)</span></label>

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

  const st = await api("/api/config/verification");
  document.getElementById("dbg").textContent = JSON.stringify(st,null,2);
  if(st.status==="ok"){
    document.getElementById("re").checked = !!st.data.require_email;
    document.getElementById("rp").checked = !!st.data.require_phone;
    document.getElementById("rpin").checked = !!st.data.require_pin;
    document.getElementById("rktp").checked = !!st.data.require_ktp;
    document.getElementById("rselfie").checked = !!st.data.require_selfie;
    document.getElementById("cfg").value = st.data.config_json || "{}";
  }

  document.getElementById("save").onclick = async ()=>{
    const cfgRaw = document.getElementById("cfg").value || "{}";
    try{ JSON.parse(cfgRaw); }catch{ toast("config_json invalid JSON","error"); return; }

    const payload = {
      require_email: document.getElementById("re").checked,
      require_phone: document.getElementById("rp").checked,
      require_pin: document.getElementById("rpin").checked,
      require_ktp: document.getElementById("rktp").checked,
      require_selfie: document.getElementById("rselfie").checked,
      config_json: cfgRaw
    };

    const r = await api("/api/config/verification", { method:"PUT", body: JSON.stringify(payload) });
    document.getElementById("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };
}
