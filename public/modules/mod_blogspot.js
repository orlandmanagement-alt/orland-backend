export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function apiCfg(){
    return await Orland.api("/api/config/blogspot");
  }

  async function apiPosts(){
    return await Orland.api("/api/blogspot/posts");
  }

  async function apiPages(){
    return await Orland.api("/api/blogspot/pages");
  }

  async function apiWidgets(){
    return await Orland.api("/api/blogspot/widgets");
  }

  async function apiSyncStatus(){
    return await Orland.api("/api/blogspot/sync_status");
  }

  async function apiSite(){
    return await Orland.api("/api/blogspot/sites");
  }

  function card(title, value, hint = ""){
    return `
      <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
        <div class="text-xs text-slate-500 font-bold">${esc(title)}</div>
        <div class="text-2xl font-extrabold mt-2">${esc(value)}</div>
        ${hint ? `<div class="text-xs text-slate-500 mt-2">${esc(hint)}</div>` : ``}
      </div>
    `;
  }

  function statusBadge(ok, text){
    if(ok){
      return `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">${esc(text)}</span>`;
    }
    return `<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-black">${esc(text)}</span>`;
  }

  return {
    title:"Blogspot CMS",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-6xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot CMS</div>
              <div class="text-sm text-slate-500">Hub integrasi Blogger, local CMS, widget HTML, dan sync monitor.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
              <button id="goSettings" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
                <i class="fa-solid fa-gear mr-2"></i>Settings
              </button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div id="cardConfig"></div>
            <div id="cardSync"></div>
            <div id="cardBlog"></div>
            <div id="cardDriver"></div>
          </div>

          <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <div id="cardPosts"></div>
            <div id="cardPages"></div>
            <div id="cardWidgets"></div>
            <div id="cardBlocks"></div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <button id="goPosts" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-3xl p-5 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Manage Posts</div>
              <div class="text-[11px] text-slate-500 mt-1">Local CMS posts + remote preview</div>
            </button>

            <button id="goPages" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-3xl p-5 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Static Pages</div>
              <div class="text-[11px] text-slate-500 mt-1">Local CMS pages + remote preview</div>
            </button>

            <button id="goWidgets" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-3xl p-5 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Widgets / Home</div>
              <div class="text-[11px] text-slate-500 mt-1">Custom HTML widget dan block div</div>
            </button>

            <button id="goSync" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-3xl p-5 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Sync Monitor</div>
              <div class="text-[11px] text-slate-500 mt-1">State, logs, dan manual run</div>
            </button>

            <button id="btnRunSync" class="bg-white dark:bg-darkLighter border border-emerald-200 rounded-3xl p-5 text-left hover:bg-emerald-50">
              <div class="text-sm font-extrabold text-emerald-700">Run Sync Now</div>
              <div class="text-[11px] text-slate-500 mt-1">Generate sync summary manual</div>
            </button>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Config Summary</div>
              <pre id="cfgBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Sync Summary</div>
              <pre id="syncBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);

      async function render(){
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Loading...";

        const [cfg, posts, pages, widgets, syncStatus, site] = await Promise.all([
          apiCfg(),
          apiPosts(),
          apiPages(),
          apiWidgets(),
          apiSyncStatus(),
          apiSite()
        ]);

        const c = cfg.data || {};
        const pCount = Array.isArray(posts.data?.items) ? posts.data.items.length : 0;
        const pgCount = Array.isArray(pages.data?.items) ? pages.data.items.length : 0;
        const wCount = Array.isArray(widgets.data?.items) ? widgets.data.items.length : 0;
        const bCount = Array.isArray(widgets.data?.home_blocks) ? widgets.data.home_blocks.length : 0;
        const st = syncStatus.data?.state || {};
        const sc = syncStatus.data?.config || {};
        const blogName = site.status === "ok" ? (site.data?.blog?.name || "Configured") : "Not loaded";

        q("cardConfig").innerHTML = card("CONFIG", c.enabled ? "enabled" : "disabled", c.api_key_configured ? "API key saved" : "API key not saved");
        q("cardSync").innerHTML = card("SYNC STATUS", String(st.last_status || "idle"), st.last_message || "");
        q("cardBlog").innerHTML = card("BLOG", blogName, c.blog_id || "-");
        q("cardDriver").innerHTML = card("CRON DRIVER", sc.cron_driver || "cron_trigger", sc.cron_endpoint || "-");

        q("cardPosts").innerHTML = card("LOCAL POSTS", String(pCount), "cms_posts provider=blogspot");
        q("cardPages").innerHTML = card("LOCAL PAGES", String(pgCount), "cms_pages provider=blogspot");
        q("cardWidgets").innerHTML = card("WIDGETS", String(wCount), "cms_widgets provider=blogspot");
        q("cardBlocks").innerHTML = card("HOME BLOCKS", String(bCount), "blogspot_widget_home active");

        q("cfgBox").textContent = JSON.stringify(cfg, null, 2);
        q("syncBox").textContent = JSON.stringify(syncStatus, null, 2);

        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Loaded.";
      }

      q("btnReload").onclick = render;
      q("goSettings").onclick = ()=>Orland.navigate("/integrations/blogspot/settings");
      q("goPosts").onclick = ()=>Orland.navigate("/integrations/blogspot/posts");
      q("goPages").onclick = ()=>Orland.navigate("/integrations/blogspot/pages");
      q("goWidgets").onclick = ()=>Orland.navigate("/integrations/blogspot/widgets");
      q("goSync").onclick = ()=>Orland.navigate("/integrations/blogspot/sync");

      q("btnRunSync").onclick = async ()=>{
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Running sync...";
        const r = await Orland.api("/api/blogspot/sync_run", {
          method: "POST",
          body: JSON.stringify({})
        });
        q("syncBox").textContent = JSON.stringify(r, null, 2);
        q("msg").className = "text-sm " + (r.status === "ok" ? "text-emerald-600" : "text-red-500");
        q("msg").textContent = r.status === "ok" ? "Sync executed." : ("Run failed: " + r.status);
        await render();
      };

      await render();
    }
  };
}
