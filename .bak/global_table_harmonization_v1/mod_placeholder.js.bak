export default function(orland){
  return {
    title: "Placeholder",
    async mount(host){
      const p = (orland?.state?.path || location.pathname || "/").replace(/\/+$/,"") || "/";
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="text-sm font-extrabold">Module belum tersedia</div>
          <div class="text-xs opacity-70 mt-2">Path: <code>${p}</code></div>
          <div class="text-xs opacity-70 mt-3">Buat modul di <code>public/modules/mod_*.js</code> dan pastikan route ada di <code>/api/registry</code> (diambil dari D1 menus).</div>
        </div>
      `;
    }
  };
}
