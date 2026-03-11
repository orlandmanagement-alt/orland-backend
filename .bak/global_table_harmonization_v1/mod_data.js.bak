export default function(Orland){
  return {
    title: "Data Management",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="text-sm font-bold">Data Management</div>
          <div class="text-xs opacity-70 mt-1">Redirecting to Export Data...</div>
        </div>
      `;
      setTimeout(()=> Orland.navigate("/data/export", true), 50);
    }
  };
}
