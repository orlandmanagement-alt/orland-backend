export default {
  mount(ctx){
    const { el, title } = ctx;
    el.innerHTML = `
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-bold">${escapeHtml(title || "Module")}</div>
            <div class="text-xs text-slate-500 mt-1">
              Module ini belum diinstall / API belum dibuat. Tidak error, aman.
            </div>
          </div>
          <div class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder">
            Plug-n-play
          </div>
        </div>
        <div class="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Jika kamu sudah buat endpoint backend-nya, tinggal bikin file modul di <code>public/modules/</code> lalu daftarkan di <code>registry.js</code>.
        </div>
      </div>
    `;
  }
};

function escapeHtml(s){
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
