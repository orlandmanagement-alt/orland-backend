export default function ProfileSecurityModule(ctx){
  const { api, toast, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Security & Password</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Admin security policy (future). Password change is active now.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
      <!-- Change password (ACTIVE) -->
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
        <div class="font-bold text-slate-900 dark:text-white">Change Password</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Min 10 chars.</p>

        <div class="mt-3 flex gap-2">
          <input id="pw" type="password"
            class="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs"
            placeholder="New password">
          <button id="pwEye" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">
            <i class="fa-solid fa-eye"></i>
          </button>
        </div>
        <button id="btnPw" class="mt-3 w-full px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Update Password</button>

        <details class="mt-3">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="outPw" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>

      <!-- 2-step flags (NOT enforced for admin yet) -->
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
        <div class="font-bold text-slate-900 dark:text-white">2-Step Verification (Policy)</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Ini <b>belum</b> memblok login admin. Untuk talent/client nanti bisa diaktifkan.
          Edit hanya untuk <b>Super Admin</b>.
        </p>

        <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <label class="flex items-center gap-2 text-xs font-bold"><input id="reqEmail" type="checkbox" class="rounded"> Require Email</label>
          <label class="flex items-center gap-2 text-xs font-bold"><input id="reqPhone" type="checkbox" class="rounded"> Require Phone</label>
          <label class="flex items-center gap-2 text-xs font-bold"><input id="reqPin" type="checkbox" class="rounded"> Require PIN</label>
          <div class="md:col-span-2">
            <div class="text-[11px] text-slate-500 mb-1">PIN Min Length</div>
            <input id="pinLen" type="number" min="4" max="12"
              class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          </div>
          <div class="md:col-span-2">
            <div class="text-[11px] text-slate-500 mb-1">Config JSON</div>
            <textarea id="cfg" class="w-full h-24 p-3 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs font-mono">{}</textarea>
          </div>
        </div>

        <div class="mt-3 flex gap-2">
          <button id="btnSave" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Save Policy</button>
          <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
        </div>

        <details class="mt-3">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    </div>
  `;

  function bindPwEye(){
    const pw = el.querySelector("#pw");
    const eye = el.querySelector("#pwEye");
    if(!pw || !eye) return;
    eye.onclick = ()=>{
      const isPw = pw.type === "password";
      pw.type = isPw ? "text" : "password";
      eye.innerHTML = isPw ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    };
  }

  async function loadPolicy(){
    const r = await api("/api/profile/security");
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Load failed: "+r.status,"error"); return; }
    const row = r.data.row || {};
    el.querySelector("#reqEmail").checked = !!row.require_email;
    el.querySelector("#reqPhone").checked = !!row.require_phone;
    el.querySelector("#reqPin").checked = !!row.require_pin;
    el.querySelector("#pinLen").value = String(row.pin_min_len || 6);
    el.querySelector("#cfg").value = row.config_json || "{}";
  }

  function bindActions(){
    bindPwEye();

    el.querySelector("#btnPw").onclick = async ()=>{
      const new_password = String(el.querySelector("#pw").value||"");
      if(new_password.length < 10){ toast("Password min 10","error"); return; }
      const r = await api("/api/profile/password", { method:"POST", body: JSON.stringify({ new_password }) });
      el.querySelector("#outPw").textContent = JSON.stringify(r,null,2);
      toast(r.status, r.status==="ok"?"success":"error");
      if(r.status==="ok") el.querySelector("#pw").value = "";
    };

    el.querySelector("#btnReload").onclick = loadPolicy;

    el.querySelector("#btnSave").onclick = async ()=>{
      const require_email = el.querySelector("#reqEmail").checked;
      const require_phone = el.querySelector("#reqPhone").checked;
      const require_pin = el.querySelector("#reqPin").checked;
      const pin_min_len = Number(el.querySelector("#pinLen").value||6);
      const config_json = el.querySelector("#cfg").value || "{}";
      try{ JSON.parse(config_json); }catch{ toast("config_json invalid","error"); return; }

      const r = await api("/api/profile/security", { method:"PUT", body: JSON.stringify({ require_email, require_phone, require_pin, pin_min_len, config_json }) });
      el.querySelector("#out").textContent = JSON.stringify(r,null,2);
      toast(r.status, r.status==="ok"?"success":"error");
      if(r.status==="ok") await loadPolicy();
    };
  }

  return {
    mount(host){
      setBreadcrumb("/ profile / security");
      host.innerHTML="";
      host.appendChild(el);
      bindActions();
      loadPolicy();
    },
    unmount(){}
  };
}
