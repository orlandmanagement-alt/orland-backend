export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadSites(){
    return await Orland.api("/api/blogspot/sites_multi");
  }

  async function loadStatus(siteId = ""){
    const q = new URLSearchParams();
    if(siteId) q.set("site_id", siteId);
    return await Orland.api("/api/blogspot/sync_status?" + q.toString());
  }

  async function loadSummary(siteId = ""){
    const q = new URLSearchParams();
    if(siteId) q.set("site_id", siteId);
    return await Orland.api("/api/blogspot/summary?" + q.toString());
  }

  async function loadLogs(params = {}){
    const q = new URLSearchParams();
    if(params.site_id) q.set("site_id", params.site_id);
    if(params.limit) q.set("limit", String(params.limit));
    if(params.status) q.set("status", String(params.status));
    if(params.kind) q.set("kind", String(params.kind));
    if(params.direction) q.set("direction", String(params.direction));
    return await Orland.api("/api/blogspot/sync_logs?" + q.toString());
  }

  async function runSync(siteId = ""){
    return await Orland.api("/api/blogspot/sync_run", {
      method:"POST",
      body: JSON.stringify({ site_id: siteId || null })
    });
  }

  async function runPlanner(){
    return await Orland.api("/api/blogspot/schedule_plan_run", {
      method:"POST",
      body: JSON.stringify({})
    });
  }

  async function runQueueBatch(){
    return await Orland.api("/api/blogspot/job_run_batch", {
      method:"POST",
      body: JSON.stringify({ limit: 10 })
    });
  }

  async function loadQueue(limit = 20){
    return await Orland.api("/api/blogspot/job_queue?limit=" + encodeURIComponent(String(limit || 20)));
  }

  async function loadDead(limit = 20){
    return await Orland.api("/api/blogspot/job_dead_letter?limit=" + encodeURIComponent(String(limit || 20)));
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
    if(s === "queued") return `<span class="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-black">queued</span>`;
    if(s === "success") return `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">success</span>`;
    if(s === "dead_letter") return `<span class="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-black">dead letter</span>`;
    return `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">${esc(s || "unknown")}</span>`;
  }

  function badgeDirection(v){
    const s = String(v || "").toLowerCase();
    if(s === "push") return `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">push</span>`;
    if(s === "pull") return `<span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">pull</span>`;
    if(s === "system") return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">system</span>`;
    return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(s || "-")}</span>`;
  }

  function card(title, id, hint = ""){
    return `
      <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
        <div class="text-xs text-slate-500 font-bold">${esc(title)}</div>
        <div id="${id}" class="text-2xl font-extrabold mt-2">—</div>
        ${hint ? `<div class="text-[11px] text-slate-500 mt-2">${esc(hint)}</div>` : ``}
      </div>
    `;
  }

  return {
    title:"Blogspot Sync Monitor",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Sync Monitor</div>
              <div class="text-sm text-slate-500">Status, logs, queue, dead letter, planner, dan runner.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <select id="sitePicker" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold min-w-[220px]">
                <option value="">Loading site...</option>
              </select>
              <button id="btnReload" class="px-4 py-3 rounded-2xl border font-black text-sm">Reload</button>
              <button id="btnRunSync" class="px-4 py-3 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">Run Sync</button>
              <button id="btnRunPlanner" class="px-4 py-3 rounded-2xl border border-sky-200 text-sky-700 font-black text-sm">Run Planner</button>
              <button id="btnRunQueue" class="px-4 py-3 rounded-2xl border border-violet-200 text-violet-700 font-black text-sm">Run Queue</button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-2 xl:grid-cols-6 gap-4">
            ${card("Last Run", "kLastRun")}
            ${card("Last Success", "kLastSuccess")}
            ${card("Pending Queue", "kPending")}
            ${card("Running Queue", "kRunning")}
            ${card("Dead Letter", "kDead")}
            ${card("Dirty Total", "kDirty")}
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Status</div>
              <div class="mt-4 space-y-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Site ID</span>
                  <span id="vSite" class="font-black break-all text-right">—</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Last Status</span>
                  <span id="vStatus">—</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Last Message</span>
                  <span id="vMessage" class="font-black break-all text-right">—</span>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Logs Filter</div>
              <div class="mt-4 space-y-3">
                <select id="fStatus" class="w-full px-4 py-3 rounded-2xl border">
                  <option value="">All status</option>
                  <option value="ok">ok</option>
                  <option value="error">error</option>
                  <option value="running">running</option>
                  <option value="skipped">skipped</option>
                </select>
                <select id="fKind" class="w-full px-4 py-3 rounded-2xl border">
                  <option value="">All kind</option>
                  <option value="system">system</option>
                  <option value="post">post</option>
                  <option value="page">page</option>
                </select>
                <select id="fDirection" class="w-full px-4 py-3 rounded-2xl border">
                  <option value="">All direction</option>
                  <option value="system">system</option>
                  <option value="push">push</option>
                  <option value="pull">pull</option>
                </select>
                <select id="fLimit" class="w-full px-4 py-3 rounded-2xl border">
                  <option value="20">20</option>
                  <option value="30" selected>30</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            </div>

            <div class="xl:col-span-2 rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Runner Output</div>
              <pre id="rawBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border rounded-2xl p-4">{}</pre>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Sync Logs</div>
              <div id="logsBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="space-y-4">
              <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
                <div class="text-xl font-extrabold">Queue Snapshot</div>
                <div id="queueBox" class="mt-4 space-y-3"></div>
              </div>

              <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
                <div class="text-xl font-extrabold">Dead Letter Snapshot</div>
                <div id="deadBox" class="mt-4 space-y-3"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = id => host.querySelector("#" + id);
      let ACTIVE_SITE_ID = "";

      function setMsg(kind, text){
        q("msg").className = "text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function renderSitePicker(){
        const r = await loadSites();
        if(r.status !== "ok"){
          q("sitePicker").innerHTML = `<option value="">Site load failed</option>`;
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        const active = items.find(x => Number(x.is_default || 0) === 1) || items[0] || null;
        if(!ACTIVE_SITE_ID && active) ACTIVE_SITE_ID = String(active.id || "");

        q("sitePicker").innerHTML = items.length
          ? items.map(x => `<option value="${esc(x.id)}" ${String(x.id) === String(ACTIVE_SITE_ID) ? "selected" : ""}>${esc(x.blog_name || x.id)} (${esc(x.id)})</option>`).join("")
          : `<option value="">No site</option>`;
      }

      function renderLogs(items){
        q("logsBox").innerHTML = !items.length
          ? `<div class="text-sm text-slate-500">No sync logs.</div>`
          : items.map(x => `
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="flex gap-2 flex-wrap">
                ${badgeStatus(x.status)}
                ${badgeDirection(x.direction)}
                <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.kind || "-")}</span>
                <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.action || "-")}</span>
              </div>
              <div class="text-sm font-extrabold mt-3 break-words">${esc(x.message || "-")}</div>
              <div class="text-xs text-slate-500 mt-2">${esc(fmtTs(x.created_at))} • site: ${esc(x.site_id || "-")}</div>
              <pre class="mt-3 text-[11px] whitespace-pre-wrap break-words bg-slate-50 rounded-2xl p-3">${esc(JSON.stringify(x.payload_json || {}, null, 2))}</pre>
            </div>
          `).join("");
      }

      function renderQueue(items){
        q("queueBox").innerHTML = !items.length
          ? `<div class="text-sm text-slate-500">No queue items.</div>`
          : items.slice(0, 8).map(x => `
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="flex gap-2 flex-wrap">
                ${badgeStatus(x.status)}
                <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.job_type || "-")}</span>
              </div>
              <div class="text-xs text-slate-500 mt-2">${esc(x.id || "-")}</div>
            </div>
          `).join("");
      }

      function renderDead(items){
        q("deadBox").innerHTML = !items.length
          ? `<div class="text-sm text-slate-500">No dead letter items.</div>`
          : items.slice(0, 8).map(x => `
            <div class="rounded-2xl border border-rose-200 p-4">
              <div class="flex gap-2 flex-wrap">
                <span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">dead letter</span>
                <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.job_type || "-")}</span>
              </div>
              <div class="text-xs text-slate-500 mt-2">${esc(x.source_job_id || "-")}</div>
              <div class="text-xs text-rose-600 mt-2 break-words">${esc(x.last_error || "-")}</div>
            </div>
          `).join("");
      }

      async function render(){
        setMsg("muted", "Loading sync monitor...");
        await renderSitePicker();

        const [statusRes, summaryRes, logsRes, queueRes, deadRes] = await Promise.all([
          loadStatus(ACTIVE_SITE_ID),
          loadSummary(ACTIVE_SITE_ID),
          loadLogs({
            site_id: ACTIVE_SITE_ID,
            limit: q("fLimit").value,
            status: q("fStatus").value,
            kind: q("fKind").value,
            direction: q("fDirection").value
          }),
          loadQueue(20),
          loadDead(20)
        ]);

        q("rawBox").textContent = JSON.stringify({
          statusRes,
          summaryRes
        }, null, 2);

        if(statusRes.status !== "ok"){
          setMsg("error", "Load status failed: " + statusRes.status);
          return;
        }

        const st = statusRes.data || {};
        const state = st.state || {};
        const sum = summaryRes.status === "ok" ? (summaryRes.data || {}) : {};

        q("kLastRun").textContent = fmtTs(state.last_run_at);
        q("kLastSuccess").textContent = fmtTs(state.last_success_at);
        q("kDirty").textContent = String(sum.dirty_total || 0);

        const queueItems = Array.isArray(queueRes.data?.items) ? queueRes.data.items : [];
        const deadItems = Array.isArray(deadRes.data?.items) ? deadRes.data.items : [];

        q("kPending").textContent = String(queueItems.filter(x => String(x.status || "") === "queued").length);
        q("kRunning").textContent = String(queueItems.filter(x => String(x.status || "") === "running").length);
        q("kDead").textContent = String(deadItems.length);

        q("vSite").textContent = ACTIVE_SITE_ID || st.site_id || "-";
        q("vStatus").innerHTML = badgeStatus(state.last_status || "idle");
        q("vMessage").textContent = state.last_message || "-";

        if(logsRes.status === "ok"){
          renderLogs(Array.isArray(logsRes.data?.items) ? logsRes.data.items : []);
        }else{
          q("logsBox").innerHTML = `<div class="text-sm text-red-500">Load logs failed.</div>`;
        }

        renderQueue(queueItems);
        renderDead(deadItems);

        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("sitePicker").onchange = async ()=>{
        ACTIVE_SITE_ID = String(q("sitePicker").value || "");
        await render();
      };
      q("fStatus").onchange = render;
      q("fKind").onchange = render;
      q("fDirection").onchange = render;
      q("fLimit").onchange = render;

      q("btnRunSync").onclick = async ()=>{
        setMsg("muted", "Running sync...");
        const r = await runSync(ACTIVE_SITE_ID);
        q("rawBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Run sync failed: " + r.status);
          return;
        }
        setMsg("success", "Sync executed.");
        await render();
      };

      q("btnRunPlanner").onclick = async ()=>{
        setMsg("muted", "Running planner...");
        const r = await runPlanner();
        q("rawBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Planner failed: " + r.status);
          return;
        }
        setMsg("success", "Planner executed.");
        await render();
      };

      q("btnRunQueue").onclick = async ()=>{
        setMsg("muted", "Running queue batch...");
        const r = await runQueueBatch();
        q("rawBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Queue runner failed: " + r.status);
          return;
        }
        setMsg("success", "Queue batch executed.");
        await render();
      };

      await render();
    }
  };
}
