export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  const fmt = (n)=> (n==null? "—" : String(n));
  async function safeGet(url){
    const r = await Orland.api(url);
    if(r.status!=="ok") return null;
    return r.data || r;
  }

  return {
    title: "Security",
    async mount(host){
      host.innerHTML = `
<div class="space-y-4">
  <div>
    <div class="text-xl font-extrabold text-slate-900 dark:text-white">Security</div>
    <div class="text-sm text-slate-500">Ringkasan keamanan & metric (basic).</div>
  </div>

  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
    <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
      <div class="text-[11px] font-bold text-slate-500">Rate limited</div>
      <div id="k1" class="text-2xl font-black mt-1">—</div>
    </div>
    <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
      <div class="text-[11px] font-bold text-slate-500">Lockouts</div>
      <div id="k2" class="text-2xl font-black mt-1">—</div>
    </div>
    <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
      <div class="text-[11px] font-bold text-slate-500">OTP verify fail</div>
      <div id="k3" class="text-2xl font-black mt-1">—</div>
    </div>
  </div>

  <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
    <div class="text-sm font-extrabold">Notes</div>
    <div class="text-xs text-slate-500 mt-1">
      Kalau endpoint metrics belum ada, nilai akan tetap <b>—</b>. Nanti bisa kita sambungkan ke <code>daily_metrics</code>/<code>hourly_metrics</code>.
    </div>
  </div>
</div>`;
      // Try fetch (optional). If endpoint missing, ignore (no crash).
      try{
        const d = await safeGet("/api/security/metrics?days=7");
        if(d){
          host.querySelector("#k1").textContent = fmt(d.rate_limited ?? d.rate_limited_total ?? d.rate_limited_7d);
          host.querySelector("#k2").textContent = fmt(d.lockouts ?? d.lockouts_total ?? d.lockouts_7d);
          host.querySelector("#k3").textContent = fmt(d.otp_verify_fail ?? d.otp_verify_fail_total ?? d.otp_verify_fail_7d);
        }
      }catch{}
    }
  };
}
