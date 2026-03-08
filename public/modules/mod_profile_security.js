export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
  <div class="space-y-4">
    <div>
      <div class="text-sm font-bold">Security & Password</div>
      <div class="text-xs text-slate-500">2-step flags (email/phone/pin) + set PIN</div>
    </div>

    <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <label class="text-xs flex items-center gap-2">
          <input id="reqEmail" type="checkbox"> Require Email
        </label>
        <label class="text-xs flex items-center gap-2">
          <input id="reqPhone" type="checkbox"> Require Phone
        </label>
        <label class="text-xs flex items-center gap-2">
          <input id="reqPin" type="checkbox"> Require PIN
        </label>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input id="newPin" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="Set new PIN (digits 4-12)">
        <button id="btnSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Save</button>
        <button id="btnVerify" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white">Test PIN</button>
      </div>

      <details>
        <summary class="text-xs text-slate-500">Debug</summary>
        <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap mt-2"></pre>
      </details>
    </div>

    <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4">
      <div class="text-xs font-bold mb-1">Catatan</div>
      <div class="text-xs text-slate-500">
        Ini modul untuk admin. Kamu bisa aktifkan kapan saja. Untuk Talent/Client nanti bisa pakai OTP/SSO.
      </div>
    </div>
  </div>
  `;

  const el=(id)=>document.getElementById(id);

  async function load(){
    const r = await api("/api/profile/security");
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }
    el("reqEmail").checked = !!r.data.require_email;
    el("reqPhone").checked = !!r.data.require_phone;
    el("reqPin").checked = !!r.data.require_pin;
  }

  el("btnSave").onclick = async ()=>{
    const payload = {
      require_email: el("reqEmail").checked,
      require_phone: el("reqPhone").checked,
      require_pin: el("reqPin").checked,
      new_pin: String(el("newPin").value||"").trim() || null
    };
    const r = await api("/api/profile/security", { method:"PUT", body: JSON.stringify(payload) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    el("newPin").value="";
    await load();
  };

  el("btnVerify").onclick = async ()=>{
    const pin = prompt("Enter PIN to test:");
    if(!pin) return;
    const r = await api("/api/profile/security", { method:"POST", body: JSON.stringify({ pin }) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.data?.ok ? "PIN OK" : "PIN FAIL", r.data?.ok ? "success":"error");
  };

  await load();
}
