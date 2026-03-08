export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  return {
    title: 'Talent Directory',
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-base font-bold">Talent Directory</div>
              <div class="text-xs text-slate-500 mt-1">Module siap dipakai. Jika endpoint sudah ada, tinggal sambungkan.</div>
            </div>
            <button id="btnTest" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">
              Load Sample
            </button>
          </div>

          <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</div>
              <div class="mt-2 text-sm font-semibold">Under Construction</div>
              <div class="text-xs text-slate-500 mt-1">Tidak error walau data belum ada.</div>
            </div>
            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-xs font-bold text-slate-500 uppercase tracking-widest">Route</div>
              <div class="mt-2 text-xs"><code>${esc(location.pathname)}</code></div>
            </div>
            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-xs font-bold text-slate-500 uppercase tracking-widest">User</div>
              <div class="mt-2 text-xs text-slate-500"><code>${esc(Orland.state?.me?.email_norm||"-")}</code></div>
            </div>
          </div>

          <div class="mt-4">
            <div class="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Output</div>
            <pre id="out" class="text-xs bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-darkBorder rounded-xl p-3 overflow-auto" style="max-height:320px;">(empty)</pre>
          </div>
        </div>
      `;

      const btn = host.querySelector("#btnTest");
      const out = host.querySelector("#out");
      btn?.addEventListener("click", async ()=>{
        out.textContent = "Loading /api/me ...";
        const r = await Orland.api("/api/me");
        out.textContent = JSON.stringify(r, null, 2);
      });
    }
  };
}
