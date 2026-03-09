export default function(Orland){
  return {
    title: "OPS Management",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="text-sm font-bold">OPS Management</div>
          <div class="text-xs opacity-70 mt-1">Redirecting to Incidents & Alerts...</div>
        </div>
      `;
      setTimeout(()=> Orland.navigate("/ops/incidents", true), 50);
    }
  };
}
