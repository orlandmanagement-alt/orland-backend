export default function(){
  return {
    title:"Data Export",
    async mount(host){
      host.innerHTML = `
        <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
          <div class="text-2xl font-extrabold">Data Export</div>
          <div class="text-slate-500 mt-2">Placeholder export module. Hubungkan ke endpoint export jika sudah siap.</div>
        </div>
      `;
    }
  };
}
