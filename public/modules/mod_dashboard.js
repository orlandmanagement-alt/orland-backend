export function moduleFactory(){
  return {
    title: "Module",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="text-sm font-bold">Module placeholder</div>
          <div class="text-xs text-slate-500 mt-1">File modul ini belum diisi. Aman untuk sementara.</div>
        </div>
      `;
    }
  };
}
