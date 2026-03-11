export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadSummary(){
    return await Orland.api("/api/blogspot/summary");
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function statusBadge(v){
    const s = String(v || "").toLowerCase();
    if(s === "ok") return `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">ok</span>`;
    if(s === "error") return `<span class="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black">error</span>`;
    if(s === "running") return `<span class="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-black">running</span>`;
    if(s === "skipped") return `<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-black">skipped</span>`;
    if(s === "noop") return `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">noop</span>`;
    return `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">${esc(s || "idle")}</span>`;
  }

  function card(title, id, hint=""){
    return `
      <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
        <div class="text-xs text-slate-500 font-bold">${title}</div>
        <div id="${id}" class="text-2xl font-extrabold mt-2">—</div>
        ${hint ? `<div class="text-[11px] text-slate-500 mt-2">${hint}</div>` : ``}
      </div>
    `;
  }

  return {
    title:"Blogspot CMS",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-7xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot CMS</div>
              <div class="text-sm text-slate-500">Hub integrasi Blogger, local CMS, widgets, dan sync monitor.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-2 xl:grid-cols-5 gap-4">
            ${card("Local Posts", "kPosts", "Jumlah post local CMS")}
            ${card("Local Pages", "kPages", "Jumlah static page local")}
            ${card("Active Widgets", "kWidgets", "Widget home block aktif")}
            ${card("Dirty Items", "kDirty", "Post/page belum sinkron")}
            ${card("Remote Deleted", "kDeleted", "Remote hilang / terhapus")}
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Connection</div>
              <div class="mt-4 space-y-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Bundle Enabled</span>
                  <span id="vEnabled" class="font-black">—</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Configured</span>
                  <span id="vConfigured" class="font-black">—</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Blog ID</span>
                  <span id="vBlogId" class="font-black break-all text-right">—</span>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Sync Status</div>
              <div class="mt-4 space-y-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Last Status</span>
                  <span id="vLastStatus">—</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Last Run</span>
                  <span id="vLastRun" class="font-black text-right">—</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Last Success</span>
                  <span id="vLastSuccess" class="font-black text-right">—</span>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Last Message</div>
              <div id="vLastMsg" class="mt-4 text-sm text-slate-500 break-words">—</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <button id="goSettings" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">API Settings</div>
              <div class="text-[11px] text-slate-500 mt-1">Blog ID, API key, OAuth, sync</div>
            </button>

            <button id="goPosts" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Manage Posts</div>
              <div class="text-[11px] text-slate-500 mt-1">Local CMS + remote publish</div>
            </button>

            <button id="goPages" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Static Pages</div>
              <div class="text-[11px] text-slate-500 mt-1">Page builder + remote publish</div>
            </button>

            <button id="goWidgets" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Widgets / Home</div>
              <div class="text-[11px] text-slate-500 mt-1">Widget placeholder / home blocks</div>
            </button>

            <button id="goSync" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">Sync Monitor</div>
              <div class="text-[11px] text-slate-500 mt-1">Logs, state, latest runner</div>
            </button>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function render(){
        setMsg("muted", "Loading summary...");
        const r = await loadSummary();

        if(r.status !== "ok"){
          setMsg("error", "Load summary failed: " + r.status);
          return;
        }

        const d = r.data || {};
        const s = d.sync || {};

        q("kPosts").textContent = String(d.local_posts ?? 0);
        q("kPages").textContent = String(d.local_pages ?? 0);
        q("kWidgets").textContent = String(d.active_widgets ?? 0);
        q("kDirty").textContent = String(d.dirty_total ?? 0);
        q("kDeleted").textContent = String(d.remote_deleted_total ?? 0);

        q("vEnabled").textContent = d.enabled ? "yes" : "no";
        q("vConfigured").textContent = d.configured ? "yes" : "no";
        q("vBlogId").textContent = d.blog_id || "-";
        q("vLastStatus").innerHTML = statusBadge(s.last_status || "idle");
        q("vLastRun").textContent = fmtTs(s.last_run_at);
        q("vLastSuccess").textContent = fmtTs(s.last_success_at);
        q("vLastMsg").textContent = s.last_message || "-";

        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      host.querySelector("#goSettings").onclick = ()=>Orland.navigate("/integrations/blogspot/settings");
      host.querySelector("#goPosts").onclick = ()=>Orland.navigate("/integrations/blogspot/posts");
      host.querySelector("#goPages").onclick = ()=>Orland.navigate("/integrations/blogspot/pages");
      host.querySelector("#goWidgets").onclick = ()=>Orland.navigate("/integrations/blogspot/widgets");
      host.querySelector("#goSync").onclick = ()=>Orland.navigate("/integrations/blogspot/sync");

      await render();
    }
  };
}
