export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function apiStatus(){
    return await Orland.api("/api/blogspot/sync_status");
  }

  async function apiRun(){
    return await Orland.api("/api/blogspot/sync_run", {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  async function apiLogs(){
    return await Orland.api("/api/blogspot/sync_logs");
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{
      return new Date(n * 1000).toLocaleString("id-ID");
    }catch{
      return String(v || "-");
    }
  }

  function badge(status){
    const s = String(status || "").toLowerCase();
    if(s === "ok") return `<span class="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700">ok</span>`;
    if(s === "running") return `<span class="px-3 py-1 rounded-full text-xs font-black bg-sky-100 text-sky-700">running</span>`;
    if(s === "skipped") return `<span class="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-700">skipped</span>`;
    if(s === "noop") return `<span class="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">noop</span>`;
    if(s === "error") return `<span class="px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-700">error</span>`;
    return `<span class="px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-700">${esc(s || "idle")}</span>`;
  }

  function boolText(v){
    return v === "1" || v === 1 || v === true ? "enabled" : "disabled";
  }

  return {
    title: "Blogspot Sync Monitor",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-6xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold">Blogspot Sync Monitor</div>
              <div class="text-slate-500 mt-1">Status sync, cron config, dan manual trigger.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
              <button id="btnRun" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
                <i class="fa-solid fa-play mr-2"></i>Run Sync
              </button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">LAST STATUS</div>
              <div id="kStatus" class="mt-3">-</div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">LAST RUN</div>
              <div id="kRun" class="text-sm font-black mt-3">-</div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">LAST SUCCESS</div>
              <div id="kSuccess" class="text-sm font-black mt-3">-</div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">LAST MESSAGE</div>
              <div id="kMessage" class="text-sm font-black mt-3 break-words">-</div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Sync Config</div>
              <div id="cfgBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Run Result</div>
              <pre id="runBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Recent Sync Logs</div>
            <div id="logsBox" class="mt-4 space-y-3"></div>
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

      function renderCfg(cfg){
        if(!cfg){
          q("cfgBox").innerHTML = `<div class="text-sm text-slate-500">No config.</div>`;
          return;
        }

        const rows = [
          ["enabled", boolText(cfg.enabled)],
          ["auto_sync_enabled", boolText(cfg.auto_sync_enabled)],
          ["sync_interval_min", String(cfg.sync_interval_min || "15")],
          ["sync_posts_enabled", boolText(cfg.sync_posts_enabled)],
          ["sync_pages_enabled", boolText(cfg.sync_pages_enabled)],
          ["sync_widgets_enabled", boolText(cfg.sync_widgets_enabled)],
          ["sync_direction", String(cfg.sync_direction || "bidirectional")],
          ["cron_driver", String(cfg.cron_driver || "cron_trigger")],
          ["cron_endpoint", String(cfg.cron_endpoint || "-")]
        ];

        q("cfgBox").innerHTML = rows.map(([k, v]) => `
          <div class="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
            <div class="text-xs text-slate-500 font-bold">${esc(k)}</div>
            <div class="text-sm font-black text-right break-all">${esc(v)}</div>
          </div>
        `).join("");
      }

      function renderLogs(items){
        if(!items.length){
          q("logsBox").innerHTML = `<div class="text-sm text-slate-500">No logs.</div>`;
          return;
        }

        q("logsBox").innerHTML = items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-sm font-extrabold">${esc(x.action || "run")} • ${esc(x.kind || "system")}</div>
                <div class="text-xs text-slate-500 mt-1">${esc(x.direction || "system")} • ${fmtTs(x.created_at)}</div>
              </div>
              <div>${badge(x.status)}</div>
            </div>
            <div class="text-sm text-slate-600 dark:text-slate-300 mt-3 break-words">${esc(x.message || "")}</div>
            <pre class="mt-3 text-[11px] whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-3">${esc(JSON.stringify(x.payload_json || {}, null, 2))}</pre>
          </div>
        `).join("");
      }

      async function renderAll(){
        setMsg("muted", "Loading...");

        const [statusRes, logsRes] = await Promise.all([
          apiStatus(),
          apiLogs()
        ]);

        if(statusRes.status !== "ok"){
          setMsg("error", "Load failed: " + statusRes.status);
          return;
        }

        const d = statusRes.data || {};
        const st = d.state || {};
        const cfg = d.config || {};

        q("kStatus").innerHTML = badge(st.last_status || "idle");
        q("kRun").textContent = fmtTs(st.last_run_at);
        q("kSuccess").textContent = fmtTs(st.last_success_at);
        q("kMessage").textContent = st.last_message || "-";

        renderCfg(cfg);

        if(logsRes.status === "ok"){
          renderLogs(Array.isArray(logsRes.data?.items) ? logsRes.data.items : []);
        }else{
          q("logsBox").innerHTML = `<div class="text-sm text-red-500">Logs failed: ${esc(logsRes.status)}</div>`;
        }

        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = renderAll;

      q("btnRun").onclick = async ()=>{
        setMsg("muted", "Running sync...");
        q("runBox").textContent = "Running...";

        const r = await apiRun();
        q("runBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Run failed: " + r.status);
          return;
        }

        setMsg("success", "Sync executed.");
        await renderAll();
      };

      await renderAll();
    }
  };
}
