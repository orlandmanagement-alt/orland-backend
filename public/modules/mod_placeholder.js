export default function(orland){
  return {
    title: "Module",
    async mount(host){
      const p = (orland?.state?.path || location.pathname || "/").replace(/\/+$/,"") || "/";
      host.innerHTML = `
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div class="text-base font-bold mb-1">Module belum tersedia</div>
          <div class="text-sm opacity-80">Path: <code>${p}</code></div>
          <div class="text-xs opacity-70 mt-3">Buat file modul di <code>public/modules/</code> lalu mappingkan di endpoint <code>/api/registry</code>.</div>
        </div>
      `;
    }
  };
}
