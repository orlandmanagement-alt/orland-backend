export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm font-bold">Security (Admin)</div>
        <div class="text-xs text-slate-500">Rate limit + account lock policy + security headers</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-4">
        <div class="text-xs font-bold">Rate Limit</div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select id="rl_enabled" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="1">enabled</option>
            <option value="0">disabled</option>
          </select>
          <input id="rl_max" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="max_per_min">
          <input id="rl_burst" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="burst">
          <button id="btnTest" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white">Test API</button>
        </div>

        <div class="text-xs font-bold">Account Lock Policy</div>
        <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select id="lk_enabled" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="1">enabled</option>
            <option value="0">disabled</option>
          </select>
          <input id="lk_max" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="max_fail">
          <input id="lk_window" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="window_min">
          <input id="lk_duration" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="duration_min">
        </div>

        <div class="text-xs font-bold">Security Headers</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <select id="hd_enabled" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="1">enabled</option>
            <option value="0">disabled</option>
          </select>
          <button id="btnSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Save Policy</button>
          <button id="btnReload" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Reload</button>
        </div>

        <details>
          <summary class="text-xs text-slate-500">Debug</summary>
          <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
        </details>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4">
        <div class="text-xs font-bold mb-2">Notes</div>
        <div class="text-xs text-slate-500 space-y-1">
          <div>- Rate limit berlaku untuk /api/* (best-effort, per PoP memory).</div>
          <div>- Account lock policy akan dipakai oleh login.js (punya kolom pw_fail_count, locked_until).</div>
          <div>- Security headers berlaku untuk seluruh response.</div>
        </div>
      </div>
    </div>
  `;

  const el=(id)=>document.getElementById(id);

  async function load(){
    const r = await api("/api/config/security-policy");
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }

    el("rl_enabled").value = r.data.rate_limit.enabled ? "1":"0";
    el("rl_max").value = String(r.data.rate_limit.max_per_min||120);
    el("rl_burst").value = String(r.data.rate_limit.burst||40);

    el("lk_enabled").value = r.data.lock.enabled ? "1":"0";
    el("lk_max").value = String(r.data.lock.max_fail||7);
    el("lk_window").value = String(r.data.lock.window_min||15);
    el("lk_duration").value = String(r.data.lock.duration_min||30);

    el("hd_enabled").value = r.data.headers.enabled ? "1":"0";
  }

  el("btnReload").onclick = load;

  el("btnSave").onclick = async ()=>{
    const payload = {
      rate_limit:{
        enabled: el("rl_enabled").value==="1",
        max_per_min: Number(el("rl_max").value||120),
        burst: Number(el("rl_burst").value||40),
      },
      lock:{
        enabled: el("lk_enabled").value==="1",
        max_fail: Number(el("lk_max").value||7),
        window_min: Number(el("lk_window").value||15),
        duration_min: Number(el("lk_duration").value||30),
      },
      headers:{ enabled: el("hd_enabled").value==="1" }
    };

    const r = await api("/api/config/security-policy", { method:"PUT", body: JSON.stringify(payload) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };

  el("btnTest").onclick = async ()=>{
    const r = await api("/api/security/ratelimit-test");
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
  };

  await load();
}
