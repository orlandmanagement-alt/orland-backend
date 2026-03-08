export default function SecurityPolicyModule(ctx){
  const { api, toast, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Security Policy</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Rate limit + lock policy. Only Super Admin can edit.</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">

      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
        <div class="font-bold text-slate-900 dark:text-white">Password Fail Lock</div>
        <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <div class="text-[11px] text-slate-500 mb-1">Fail Window (sec)</div>
            <input id="pw_fail_window_sec" type="number" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          </div>
          <div>
            <div class="text-[11px] text-slate-500 mb-1">Fail Max</div>
            <input id="pw_fail_max" type="number" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          </div>
          <div class="md:col-span-2">
            <div class="text-[11px] text-slate-500 mb-1">Lock Duration (sec)</div>
            <input id="lock_sec" type="number" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          </div>
        </div>

        <div class="mt-4 font-bold text-slate-900 dark:text-white">Rate Limit (soft)</div>
        <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          <div>
            <div class="text-[11px] text-slate-500 mb-1">Per minute</div>
            <input id="rate_limit_per_min" type="number" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          </div>
          <div>
            <div class="text-[11px] text-slate-500 mb-1">Burst</div>
            <input id="rate_limit_burst" type="number" class="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          </div>
        </div>

        <div class="mt-4 flex gap-2">
          <button id="btnSave" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">Save</button>
          <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
        </div>

        <details class="mt-3">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>

      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
        <div class="font-bold text-slate-900 dark:text-white">Quick Tools</div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Unlock account (admin/staff) by email.</p>

        <div class="mt-3 flex gap-2">
          <input id="unlockEmail" placeholder="email@domain.com"
            class="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          <button id="btnUnlock" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">
            Unlock
          </button>
        </div>

        <div class="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
          Catatan:
          <ul class="list-disc ml-4 mt-2 space-y-1">
            <li>Lock policy tidak berlaku untuk <b>super_admin</b>.</li>
            <li>Unlock hanya reset: pw_fail_count, pw_fail_last_at, locked_until, lock_reason.</li>
          </ul>
        </div>

        <details class="mt-3">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="out2" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>

    </div>
  `;

  async function load(){
    const r = await api("/api/security/policy");
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Load failed: "+r.status,"error"); return; }
    const row = r.data.row || {};
    el.querySelector("#pw_fail_window_sec").value = row.pw_fail_window_sec ?? 900;
    el.querySelector("#pw_fail_max").value = row.pw_fail_max ?? 5;
    el.querySelector("#lock_sec").value = row.lock_sec ?? 900;
    el.querySelector("#rate_limit_per_min").value = row.rate_limit_per_min ?? 60;
    el.querySelector("#rate_limit_burst").value = row.rate_limit_burst ?? 30;
  }

  async function save(){
    const payload = {
      pw_fail_window_sec: Number(el.querySelector("#pw_fail_window_sec").value||900),
      pw_fail_max: Number(el.querySelector("#pw_fail_max").value||5),
      lock_sec: Number(el.querySelector("#lock_sec").value||900),
      rate_limit_per_min: Number(el.querySelector("#rate_limit_per_min").value||60),
      rate_limit_burst: Number(el.querySelector("#rate_limit_burst").value||30),
      allowlist_json: "[]",
      denylist_json: "[]",
      config_json: "{}"
    };
    const r = await api("/api/security/policy", { method:"PUT", body: JSON.stringify(payload) });
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok") await load();
  }

  async function unlock(){
    const email = String(el.querySelector("#unlockEmail").value||"").trim().toLowerCase();
    if(!email.includes("@")){ toast("Email invalid","error"); return; }
    const r = await api("/api/users/admin", { method:"PUT", body: JSON.stringify({ action:"unlock", email }) });
    el.querySelector("#out2").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  }

  return {
    mount(host){
      setBreadcrumb("/ security / policy");
      host.innerHTML="";
      host.appendChild(el);
      el.querySelector("#btnReload").onclick = load;
      el.querySelector("#btnSave").onclick = save;
      el.querySelector("#btnUnlock").onclick = unlock;
      load();
    },
    unmount(){}
  };
}
