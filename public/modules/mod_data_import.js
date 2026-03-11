export default function(){
  return {
    title:"Data Import",
    async mount(host){
      host.innerHTML = `
        <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
          <div class="text-2xl font-extrabold ui-title-gradient">Data Import</div>
          <div class="text-slate-500 mt-2">Placeholder import module. Hubungkan ke endpoint import jika sudah siap.</div>
        </div>
      `;
    }
  };
}
