import { fmtTs, esc } from "./security_shared.js";

export default function SecurityAdminModule({ api, mount, toast }) {
  const state = { policy:null, lockouts:[], offenders:[] };

  async function boot(){
    const me = await api("/api/me");
    if(me.status !== "ok") return mount(`<div class="text-slate-500">Unauthorized</div>`);
    const roles = me.data.roles || [];
    if(!roles.includes("super_admin")) {
      return mount(`<div class="text-slate-500">Only super_admin can open this module.</div>`);
    }

    await loadAll();
    render();
    bind();
  }

  async function loadAll(){
    const p = await api("/api/security/policy");
    state.policy = (p.status==="ok") ? p.data : { lock_after_fail:10, lock_minutes:30, ip_fail_window_min:15, ip_fail_threshold:20 };

    const l = await api("/api/security/lockouts?limit=100");
    state.lockouts = (l.status==="ok") ? (l.data.rows||[]) : [];

    const o = await api("/api/security/rate-limits?kind=password_fail&minutes=240&limit=30");
    state.offenders = (o.status==="ok") ? (o.data.rows||[]) : [];
  }

  function render(){
    mount(`
      <div class="space-y-5">
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5 shadow-sm">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div class="text-lg font-bold text-slate-900 dark:text-white">Security Admin</div>
              <div class="text-xs text-slate-500 mt-1">Rate limit + lock policy + offenders.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 dark:bg-black/20 hover:bg-slate-200 dark:hover:bg-black/30">
                Reload
              </button>
              <button id="btnPurgeIp" class="px-3 py-2 rounded-lg text-xs font-bold bg-danger text-white hover:opacity-90">
                Purge IP Window
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
            <div class="border border-slate-200 dark:border-darkBorder rounded-xl p-4">
              <div class="font-bold mb-2">Account Lock Policy</div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <label class="text-xs font-bold">
                  Lock after fail
                  <input id="lock_after_fail" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder"
                    type="number" min="3" max="50" value="${esc(state.policy.lock_after_fail)}">
                </label>
                <label class="text-xs font-bold">
                  Lock minutes
                  <input id="lock_minutes" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder"
                    type="number" min="1" max="1440" value="${esc(state.policy.lock_minutes)}">
                </label>
                <label class="text-xs font-bold">
                  IP window (min)
                  <input id="ip_fail_window_min" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder"
                    type="number" min="1" max="1440" value="${esc(state.policy.ip_fail_window_min)}">
                </label>
                <label class="text-xs font-bold">
                  IP threshold
                  <input id="ip_fail_threshold" class="mt-1 w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder"
                    type="number" min="5" max="1000" value="${esc(state.policy.ip_fail_threshold)}">
                </label>
              </div>

              <button id="btnSavePolicy" class="mt-4 w-full px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">
                Save Policy
              </button>
              <div class="text-[11px] text-slate-500 mt-2">
                Policy disimpan di KV (plug & play). Enforcement penuh bisa ditambahkan di login.js nanti.
              </div>
            </div>

            <div class="border border-slate-200 dark:border-darkBorder rounded-xl p-4">
              <div class="font-bold mb-2">Top Offender IP (password_fail)</div>
              <div class="text-[11px] text-slate-500">Window: 240 minutes</div>

              <div class="overflow-x-auto mt-3">
                <table class="w-full text-left text-xs">
                  <thead class="text-slate-500">
                    <tr>
                      <th class="py-2 pr-3">IP Hash</th>
                      <th class="py-2 pr-3">Total</th>
                      <th class="py-2 pr-3">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
                    ${(state.offenders||[]).map(x=>`
                      <tr>
                        <td class="py-2 pr-3"><code>${esc(x.ip_hash||"")}</code></td>
                        <td class="py-2 pr-3 font-bold">${esc(x.total||0)}</td>
                        <td class="py-2 pr-3 text-slate-500">${esc(fmtTs(x.last_seen_at))}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>

              <div class="text-[11px] text-slate-500 mt-3">
                Purge akan menghapus record window dari ip_activity untuk offenders.
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5 shadow-sm">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="font-bold">Account Lockouts</div>
              <div class="text-xs text-slate-500 mt-1">Daftar akun terkunci (manual policy/flag di masa depan).</div>
            </div>
          </div>

          <div class="overflow-x-auto mt-3">
            <table class="w-full text-left text-xs">
              <thead class="text-slate-500">
                <tr>
                  <th class="py-2 pr-3">User</th>
                  <th class="py-2 pr-3">Reason</th>
                  <th class="py-2 pr-3">Until</th>
                  <th class="py-2 pr-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
                ${(state.lockouts||[]).map(x=>`
                  <tr>
                    <td class="py-2 pr-3">
                      <div class="font-bold">${esc(x.email_norm||x.user_id||"")}</div>
                      <div class="text-[11px] text-slate-500"><code>${esc(x.user_id||"")}</code></div>
                    </td>
                    <td class="py-2 pr-3">${esc(x.reason||"lockout")}</td>
                    <td class="py-2 pr-3 text-slate-500">${esc(fmtTs(x.unlock_at))}</td>
                    <td class="py-2 pr-3 text-right">
                      <button class="btnUnlock px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-black/20 hover:bg-slate-200 dark:hover:bg-black/30"
                        data-uid="${esc(x.user_id||"")}">
                        Unlock
                      </button>
                    </td>
                  </tr>
                `).join("")}
                ${state.lockouts?.length ? "" : `<tr><td class="py-3 text-slate-500" colspan="4">No lockouts.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `);
  }

  function bind(){
    document.getElementById("btnReload")?.addEventListener("click", async ()=>{
      await loadAll(); render(); bind(); toast("reloaded","info");
    });

    document.getElementById("btnSavePolicy")?.addEventListener("click", async ()=>{
      const payload = {
        lock_after_fail: Number(document.getElementById("lock_after_fail")?.value||10),
        lock_minutes: Number(document.getElementById("lock_minutes")?.value||30),
        ip_fail_window_min: Number(document.getElementById("ip_fail_window_min")?.value||15),
        ip_fail_threshold: Number(document.getElementById("ip_fail_threshold")?.value||20),
      };
      const r = await api("/api/security/policy", { method:"POST", body: JSON.stringify(payload) });
      toast(r.status, r.status==="ok"?"success":"error");
      if(r.status==="ok"){ state.policy = r.data; }
    });

    document.getElementById("btnPurgeIp")?.addEventListener("click", async ()=>{
      if(!confirm("Purge offenders window?")) return;
      const r = await api("/api/security/rate-limits/purge", { method:"POST", body: JSON.stringify({ kind:"password_fail", minutes:240 }) });
      toast(r.status, r.status==="ok"?"success":"error");
      await loadAll(); render(); bind();
    });

    document.querySelectorAll(".btnUnlock").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const user_id = btn.getAttribute("data-uid");
        const r = await api("/api/security/lockouts/unlock", { method:"POST", body: JSON.stringify({ user_id }) });
        toast(r.status, r.status==="ok"?"success":"error");
        await loadAll(); render(); bind();
      });
    });
  }

  boot();
}
