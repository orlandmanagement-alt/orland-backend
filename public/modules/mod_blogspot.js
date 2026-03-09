export default function(Orland){
  return {
    title: "Blogspot CMS",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="text-sm font-bold">Blogspot CMS</div>
          <div class="text-xs opacity-70 mt-1">Redirecting to Blogspot Settings...</div>
        </div>
      `;
      setTimeout(()=> Orland.navigate("/integrations/blogspot/settings", true), 50);
    }
  };
}
