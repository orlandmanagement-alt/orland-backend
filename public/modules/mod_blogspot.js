export default function(Orland){
  return {
    title:"Blogspot CMS",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div>
            <div class="text-xl font-extrabold text-slate-900 dark:text-white">Blogspot CMS</div>
            <div class="text-sm text-slate-500">Hub integrasi Blogger.</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <button id="goSettings" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">API Settings</div>
              <div class="text-[11px] text-slate-500 mt-1">Blog ID, API key, service account</div>
            </button>
            <button id="goPosts" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Manage Posts</div>
              <div class="text-[11px] text-slate-500 mt-1">List post dari Blogger API</div>
            </button>
            <button id="goPages" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Static Pages</div>
              <div class="text-[11px] text-slate-500 mt-1">List static pages</div>
            </button>
            <button id="goWidgets" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Widgets / Home</div>
              <div class="text-[11px] text-slate-500 mt-1">Home fallback</div>
            </button>
          </div>
        </div>
      `;

      host.querySelector("#goSettings").onclick = ()=>Orland.navigate("/integrations/blogspot/settings");
      host.querySelector("#goPosts").onclick = ()=>Orland.navigate("/integrations/blogspot/posts");
      host.querySelector("#goPages").onclick = ()=>Orland.navigate("/integrations/blogspot/pages");
      host.querySelector("#goWidgets").onclick = ()=>Orland.navigate("/integrations/blogspot/widgets");
    }
  };
}
