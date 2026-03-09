export default function(Orland){
  return {
    title: "Configuration",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="text-sm font-bold">Configuration</div>
          <div class="text-xs opacity-70 mt-1">Redirecting to Plugins...</div>
        </div>
      `;
      setTimeout(()=> Orland.navigate("/config/plugins", true), 50);
    }
  };
}
