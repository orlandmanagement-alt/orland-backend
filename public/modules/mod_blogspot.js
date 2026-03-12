export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadSummary(siteId = ""){
    const q = new URLSearchParams();
    if(siteId) q.set("site_id", siteId);
    return await Orland.api("/api/blogspot/summary" + (q.toString() ? "?" + q.toString() : ""));
  }

  async function loadSyncStatus(siteId = ""){
    const q = new URLSearchParams();
    if(siteId) q.set("site_id", siteId);
    return await Orland.api("/api/blogspot/sync_status" + (q.toString() ? "?" + q.toString() : ""));
  }

  async function loadAuditVerify(){
    return await Orland.api("/api/blogspot/audit_verify?limit=500");
  }

  async function loadSites(){
    return await Orland.api("/api/blogspot/sites_multi");
  }

  async function loadQueueStatus(){
    const [queue, dead] = await Promise.all([
      Orland.api("/api/blogspot/job_queue?limit=20"),
      Orland.api("/api/blogspot/job_dead_letter?limit=20")
    ]);

    const queueItems = Array.isArray(queue?.data?.items) ? queue.data.items : [];
    const deadItems = Array.isArray(dead?.data?.items) ? dead.data.items : [];

    return {
      ok: queue?.status === "ok" || dead?.status === "ok",
      queued: queueItems.filter(x => String(x.status || "") === "queued").length,
      running: queueItems.filter(x => String(x.status || "") === "running").length,
      success: queueItems.filter(x => String(x.status || "") === "success").length,
      dead_letter: deadItems.length
    };
  }

  async function loadScheduleStatus(siteId = ""){
    const q = new URLSearchParams();
    if(siteId) q.set("site_id", siteId);
    q.set("limit", "200");

    const r = await Orland.api("/api/blogspot/schedule_jobs?" + q.toString());
    if(r.status !== "ok"){
      return {
        ok: false,
        scheduled: 0,
        queued: 0,
        failed: 0,
        cancelled: 0,
        upcoming: 0
      };
    }

    const items = Array.isArray(r.data?.items) ? r.data.items : [];
    const now = Math.floor(Date.now() / 1000);

    return {
      ok: true,
      scheduled: items.filter(x => String(x.status || "") === "scheduled").length,
      queued: items.filter(x => String(x.status || "") === "queued").length,
      failed: items.filter(x => String(x.status || "") === "failed").length,
      cancelled: items.filter(x => String(x.status || "") === "cancelled").length,
      upcoming: items.filter(x => Number(x.planned_at || 0) > now).length
    };
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
    if(s === "idle") return `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">idle</span>`;
    return `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">${esc(s || "-")}</span>`;
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

  function navCard(id, title, hint){
    return `
      <button id="${id}" class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4 text-left hover:bg-slate-50 dark:hover:bg-white/5">
        <div class="text-sm font-extrabold">${esc(title)}</div>
        <div class="text-[11px] text-slate-500 mt-1">${esc(hint)}</div>
      </button>
    `;
  }

  return {
    title:"Blogspot CMS",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot CMS</div>
              <div class="text-sm text-slate-500">Hub operasional Blogspot final: content, queue, schedule, audit, dan multi-site.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <select id="sitePicker" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold min-w-[220px]">
                <option value="">Loading site...</option>
              </select>
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
            ${card("Dirty Items", "kDirty", "Item belum sinkron")}
            ${card("Remote Deleted", "kDeleted", "Remote hilang / terhapus")}
          </div>

          <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
            ${card("Queue Pending", "kQueuePending", "Job queued")}
            ${card("Queue Running", "kQueueRunning", "Job sedang berjalan")}
            ${card("Dead Letter", "kDeadLetter", "Job gagal final")}
            ${card("Scheduled", "kScheduled", "Agenda publish")}
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-4 gap-4">
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
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Site ID</span>
                  <span id="vSiteId" class="font-black break-all text-right">—</span>
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
              <div class="text-xl font-extrabold">Schedule Status</div>
              <div class="mt-4 space-y-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Upcoming</span>
                  <span id="vUpcoming" class="font-black">—</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Queued</span>
                  <span id="vScheduleQueued" class="font-black">—</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Failed</span>
                  <span id="vScheduleFailed" class="font-black">—</span>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Audit Integrity</div>
              <div class="mt-4 space-y-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Ledger Verify</span>
                  <span id="vLedgerVerify">—</span>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span class="text-slate-500">Checked Rows</span>
                  <span id="vLedgerRows" class="font-black">—</span>
                </div>
                <div class="text-xs text-slate-500" id="vLedgerHint">—</div>
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Last Message</div>
            <div id="vLastMsg" class="mt-4 text-sm text-slate-500 break-words">—</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            ${navCard("goSettings", "API Settings", "Blog ID, API key, OAuth, sync")}
            ${navCard("goPosts", "Manage Posts", "Local CMS + remote publish")}
            ${navCard("goPages", "Static Pages", "Page builder + remote publish")}
            ${navCard("goWidgets", "Widgets / Home", "Widget placeholder / home blocks")}
            ${navCard("goSync", "Sync Monitor", "Logs, state, latest runner")}
            ${navCard("goQueuePolicy", "Queue Policy", "Rate limit guard dan policy")}
            ${navCard("goIdempotency", "Job Idempotency", "Dedup dan job uniqueness")}
            ${navCard("goBreaker", "Circuit Breaker", "Quota monitor dan breaker state")}
            ${navCard("goSchedule", "Schedule Calendar", "Scheduled publishing planner")}
            ${navCard("goAuditLedger", "Audit Ledger", "Tamper-evident integrity chain")}
            ${navCard("goSites", "Multi Site", "Tenant isolation dan site selector")}
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
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

        if(!ACTIVE_SITE_ID && active){
          ACTIVE_SITE_ID = String(active.id || "");
        }

        q("sitePicker").innerHTML = items.length
          ? items.map(x => `
              <option value="${esc(x.id)}" ${String(x.id) === String(ACTIVE_SITE_ID) ? "selected" : ""}>
                ${esc(x.blog_name || x.id)} (${esc(x.id)})
              </option>
            `).join("")
          : `<option value="">No site</option>`;
      }

      async function render(){
        setMsg("muted", "Loading summary...");
        await renderSitePicker();

        const [summaryRes, syncRes, ledgerRes, queueRes, scheduleRes] = await Promise.all([
          loadSummary(ACTIVE_SITE_ID),
          loadSyncStatus(ACTIVE_SITE_ID),
          loadAuditVerify(),
          loadQueueStatus(),
          loadScheduleStatus(ACTIVE_SITE_ID)
        ]);

        if(summaryRes.status !== "ok"){
          setMsg("error", "Load summary failed: " + summaryRes.status);
          return;
        }

        const d = summaryRes.data || {};
        const s = d.sync || {};
        const syncData = syncRes.status === "ok" ? (syncRes.data || {}) : {};
        const ledger = ledgerRes.status === "ok" ? (ledgerRes.data || {}) : {};

        q("kPosts").textContent = String(d.local_posts ?? 0);
        q("kPages").textContent = String(d.local_pages ?? 0);
        q("kWidgets").textContent = String(d.active_widgets ?? 0);
        q("kDirty").textContent = String(d.dirty_total ?? 0);
        q("kDeleted").textContent = String(d.remote_deleted_total ?? 0);

        q("kQueuePending").textContent = String(queueRes.queued ?? 0);
        q("kQueueRunning").textContent = String(queueRes.running ?? 0);
        q("kDeadLetter").textContent = String(queueRes.dead_letter ?? 0);
        q("kScheduled").textContent = String(scheduleRes.scheduled ?? 0);

        q("vEnabled").textContent = d.enabled ? "yes" : "no";
        q("vConfigured").textContent = d.configured ? "yes" : "no";
        q("vBlogId").textContent = d.blog_id || "-";
        q("vSiteId").textContent = d.site_id || ACTIVE_SITE_ID || "-";

        q("vLastStatus").innerHTML = statusBadge(s.last_status || "idle");
        q("vLastRun").textContent = fmtTs(s.last_run_at);
        q("vLastSuccess").textContent = fmtTs(s.last_success_at);
        q("vLastMsg").textContent = s.last_message || "-";

        q("vUpcoming").textContent = String(scheduleRes.upcoming ?? 0);
        q("vScheduleQueued").textContent = String(scheduleRes.queued ?? 0);
        q("vScheduleFailed").textContent = String(scheduleRes.failed ?? 0);

        q("vLedgerVerify").innerHTML = statusBadge(ledger.ok ? "ok" : "error");
        q("vLedgerRows").textContent = String(ledger.total ?? 0);
        q("vLedgerHint").textContent = ledger.ok
          ? "Ledger chain valid."
          : ("Broken rows: " + String((ledger.broken || []).length || 0));

        if(syncRes.status === "ok" && syncData.site_id && !ACTIVE_SITE_ID){
          ACTIVE_SITE_ID = String(syncData.site_id || "");
        }

        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("sitePicker").onchange = async ()=>{
        ACTIVE_SITE_ID = String(q("sitePicker").value || "");
        await render();
      };

      host.querySelector("#goSettings").onclick = ()=>Orland.navigate("/integrations/blogspot/settings");
      host.querySelector("#goPosts").onclick = ()=>Orland.navigate("/integrations/blogspot/posts");
      host.querySelector("#goPages").onclick = ()=>Orland.navigate("/integrations/blogspot/pages");
      host.querySelector("#goWidgets").onclick = ()=>Orland.navigate("/integrations/blogspot/widgets");
      host.querySelector("#goSync").onclick = ()=>Orland.navigate("/integrations/blogspot/sync");
      host.querySelector("#goQueuePolicy").onclick = ()=>Orland.navigate("/integrations/blogspot/job-policy");
      host.querySelector("#goIdempotency").onclick = ()=>Orland.navigate("/integrations/blogspot/job-idempotency");
      host.querySelector("#goBreaker").onclick = ()=>Orland.navigate("/integrations/blogspot/job-breaker");
      host.querySelector("#goSchedule").onclick = ()=>Orland.navigate("/integrations/blogspot/schedule-calendar");
      host.querySelector("#goAuditLedger").onclick = ()=>Orland.navigate("/integrations/blogspot/audit-ledger");
      host.querySelector("#goSites").onclick = ()=>Orland.navigate("/integrations/blogspot/sites-multi");

      await render();
    }
  };
}
