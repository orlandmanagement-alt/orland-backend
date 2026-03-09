export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  async function metrics(){ return await Orland.api("/api/security/metrics?days=7"); }

  return {
    title: "Security",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
          <div class="text-lg font-black">Security</div>
          <div class="text-xs text-slate-500 mt-1">Ringkasan security events & policy.</div>
          <div class="mt-4" id="boxSec">Loading…</div>
        </div>
      `;

      const box = host.querySelector("#boxSec");
      const r = await metrics();
      if(r.status!=="ok"){
        box.innerHTML = `<div class="text-sm text-red-500">Failed: ${esc(r.status)}</div><pre class="text-[11px] mt-2 whitespace-pre-wrap">${esc(JSON.stringify(r.data||{},null,2))}</pre>`;
        return;
      }

      const m = r.data || {};
      box.innerHTML = `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="text-[11px] text-slate-500">Rate limited</div>
            <div class="text-2xl font-black">${esc(m.rate_limited||0)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="text-[11px] text-slate-500">Lockouts</div>
            <div class="text-2xl font-black">${esc(m.lockouts||0)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="text-[11px] text-slate-500">OTP verify fail</div>
            <div class="text-2xl font-black">${esc(m.otp_verify_fail||0)}</div>
          </div>
          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="text-[11px] text-slate-500">Password fail</div>
            <div class="text-2xl font-black">${esc(m.password_fail||0)}</div>
          </div>
        </div>
        <div class="mt-4 text-xs text-slate-500">
          Tip: buka <b>Security Policy</b> di Configuration untuk lock policy / rate limit.
        </div>
      `;
    }
  };
}
