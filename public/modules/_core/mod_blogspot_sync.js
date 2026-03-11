export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadStatus(){
    return await Orland.api("/api/blogspot/sync_status");
  }

  async function loadLogs(params = {}){
    const q = new URLSearchParams();
    if(params.limit) q.set("limit", String(params.limit));
    if(params.status) q.set("status", String(params.status));
    if(params.kind) q.set("kind", String(params.kind));
    if(params.direction) q.set("direction", String(params.direction));
    return await Orland.api("/api/blogspot/sync_logs?" + q.toString());
  }

  async function runSync(){
    return await Orland.api("/api/blogspot/sync_run", {
      method:"POST",
      body: JSON.stringify({})
    });
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function badgeStatus(v){
    const s = String(v || "").toLowerCase();
    if(s === "ok") return `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">ok</span>`;
    if(s === "error") return `<span class="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black">error</span>`;
    if(s === "running") return `<span class="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-black">running</span>`;
    if(s === "skipped") return `<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-black">skipped</span>`;
    if(s === "noop") return `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">noop</span>`;
    return `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">${esc(s || "unknown")}</span>`;
  }

  function badgeDirection(v){
    const s = String(v || "").toLowerCase();
    if(s === "push") return `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">push</span>`;
    if(s === "pull") return `<span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">pull</span>`;
    if(s === "system") return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">system</span>`;
    return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(s || "-")}</span>`;
  }

  return {
    title:"Blogspot Sync Monitor",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-7xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Sync Monitor</div>
              <div class="text-sm text-slate-500">State sync, manual run, dan histori log sinkronisasi.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
              <button id="btnRunSync" class="px-4 py-3 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">
                <i class="fa-solid fa-play mr-2"></i>Run Sync
              </button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Last Run</div>
              <div id="kLastRun" class="text-sm font-extrabold mt-2">-</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Last Success</div>
              <div id="kLastSuccess" class="text-sm font-extrabold mt-2">-</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Last Status</div>
              <div id="kLastStatus" class="mt-2">-</div>
            </div>
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xs text-slate-500 font-bold">Last Message</div>
              <div id="kLastMessage" class="text-sm font-extrabold mt-2 break-words">-</div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-xl font-extrabold">Filters</div>
                <div class="text-sm text-slate-500 mt-1">Saring histori log sinkronisasi.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <select id="fStatus" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="">All status</option>
                  <option value="ok">ok</option>
                  <option value="error">error</option>
                  <option value="running">running</option>
                  <option value="skipped">skipped</option>
                  <option value="noop">noop</option>
                </select>
                <select id="fKind" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="">All kind</option>
                  <option value="system">system</option>
                  <option value="post">post</option>
                  <option value="page">page</option>
                </select>
                <select id="fDirection" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="">All direction</option>
                  <option value="system">system</option>
                  <option value="push">push</option>
                  <option value="pull">pull</option>
                </select>
                <select id="fLimit" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="20">20</option>
                  <option value="30" selected>30</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Sync Logs</div>
            <div id="logsBox" class="mt-4 space-y-3"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Raw Status</div>
            <pre id="rawBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
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

      function renderLogs(items){
        if(!items.length){
          q("logsBox").innerHTML = `<div class="text-sm text-slate-500">No sync logs.</div>`;
          return;
        }

        q("logsBox").innerHTML = items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex gap-2 flex-wrap">
                  ${badgeStatus(x.status)}
                  ${badgeDirection(x.direction)}
                  <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.kind || "-")}</span>
                  <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.action || "-")}</span>
                </div>
                <div class="text-sm font-extrabold mt-3 break-words">${esc(x.message || "-")}</div>
                <div class="text-xs text-slate-500 mt-2">
                  ${esc(fmtTs(x.created_at))} • local: ${esc(x.local_id || "-")} • remote: ${esc(x.remote_id || "-")}
                </div>
              </div>
            </div>
            <pre class="mt-3 text-[11px] whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-3">${esc(JSON.stringify(x.payload_json || {}, null, 2))}</pre>
          </div>
        `).join("");
      }

      async function render(){
        setMsg("muted", "Loading sync monitor...");
        const [statusRes, logsRes] = await Promise.all([
          loadStatus(),
          loadLogs({
            limit: q("fLimit").value,
            status: q("fStatus").value,
            kind: q("fKind").value,
            direction: q("fDirection").value
          })
        ]);

        if(statusRes.status !== "ok"){
          setMsg("error", "Load status failed: " + statusRes.status);
          q("rawBox").textContent = JSON.stringify(statusRes, null, 2);
          return;
        }

        const st = statusRes.data || {};
        const state = st.state || {};

        q("kLastRun").textContent = fmtTs(state.last_run_at);
        q("kLastSuccess").textContent = fmtTs(state.last_success_at);
        q("kLastStatus").innerHTML = badgeStatus(state.last_status || "idle");
        q("kLastMessage").textContent = state.last_message || "-";
        q("rawBox").textContent = JSON.stringify(statusRes, null, 2);

        if(logsRes.status !== "ok"){
          q("logsBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(logsRes, null, 2))}</pre>`;
          setMsg("error", "Load logs failed: " + logsRes.status);
          return;
        }

        renderLogs(Array.isArray(logsRes.data?.items) ? logsRes.data.items : []);
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;

      q("btnRunSync").onclick = async ()=>{
        setMsg("muted", "Running sync...");
        q("rawBox").textContent = "Running...";
        const r = await runSync();
        q("rawBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Run sync failed: " + r.status);
          return;
        }
        setMsg("success", "Sync executed.");
        await render();
      };

      q("fStatus").onchange = render;
      q("fKind").onchange = render;
      q("fDirection").onchange = render;
      q("fLimit").onchange = render;

      await render();
    }
  };
}
