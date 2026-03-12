export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadManifest(from, to){
    const q = new URLSearchParams();
    if(from) q.set("from", String(from));
    if(to) q.set("to", String(to));
    return await Orland.api("/api/blogspot/evidence_archive_manifest" + (q.toString() ? `?${q.toString()}` : ""));
  }

  async function registerArchive(payload){
    return await Orland.api("/api/blogspot/archive_register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function loadRegistry(period_key = "", limit = 50){
    const q = new URLSearchParams();
    if(period_key) q.set("period_key", period_key);
    q.set("limit", String(limit || 50));
    return await Orland.api("/api/blogspot/archive_registry?" + q.toString());
  }

  async function createSeal(payload){
    return await Orland.api("/api/blogspot/archive_monthly_seal_create", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function loadSeals(period_key = "", limit = 24){
    const q = new URLSearchParams();
    if(period_key) q.set("period_key", period_key);
    q.set("limit", String(limit || 24));
    return await Orland.api("/api/blogspot/archive_monthly_seals?" + q.toString());
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function toUnixStart(dateStr){
    if(!dateStr) return 0;
    try{
      return Math.floor(new Date(dateStr + "T00:00:00").getTime() / 1000);
    }catch{
      return 0;
    }
  }

  function toUnixEnd(dateStr){
    if(!dateStr) return 0;
    try{
      return Math.floor(new Date(dateStr + "T23:59:59").getTime() / 1000);
    }catch{
      return 0;
    }
  }

  function periodKeyGuess(fromDate, toDate){
    const ref = toDate || fromDate;
    if(!ref) return "";
    const s = String(ref);
    if(s.length >= 7) return s.slice(0, 7);
    return "";
  }

  function sigBadge(mode){
    const s = String(mode || "").toLowerCase();
    if(s === "hmac"){
      return `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">signed</span>`;
    }
    return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">unsigned</span>`;
  }

  function hashLine(label, value){
    return `
      <div class="text-[11px] break-all text-slate-600">
        <span class="font-bold">${esc(label)}:</span> ${esc(value || "-")}
      </div>
    `;
  }

  function renderRegistryItems(items){
    if(!items.length){
      return `<div class="text-sm text-slate-500">No archive registry.</div>`;
    }

    return items.map(x => `
      <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class="flex gap-2 flex-wrap">
              <span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">${esc(x.period_key || "-")}</span>
              ${sigBadge(x.bundle_signature_mode)}
            </div>

            <div class="text-sm font-extrabold mt-3">${esc(x.archive_no || "-")}</div>
            <div class="text-xs text-slate-500 mt-1">${esc(x.archive_name || "-")} • ${esc(x.archive_version || "-")}</div>
            <div class="text-xs text-slate-500 mt-2">
              range: ${esc(fmtTs(x.range_from))} → ${esc(fmtTs(x.range_to))}
            </div>
            <div class="text-xs text-slate-500 mt-1">
              logs=${esc(x.item_logs_count)} • approvals=${esc(x.item_approvals_count)} • delete=${esc(x.item_delete_requests_count)} • risk=${esc(x.item_risk_count)}
            </div>
            <div class="text-[11px] text-slate-400 mt-2">
              registered_at: ${esc(fmtTs(x.registered_at))}
            </div>
            ${x.note ? `<div class="text-[11px] text-slate-500 mt-2">${esc(x.note)}</div>` : ``}
          </div>
        </div>

        <details class="mt-3">
          <summary class="cursor-pointer text-xs font-black text-slate-500">Checksums</summary>
          <div class="mt-3 space-y-2">
            ${hashLine("snapshot", x.snapshot_hash)}
            ${hashLine("logs", x.logs_hash)}
            ${hashLine("approvals", x.approvals_hash)}
            ${hashLine("delete_requests", x.delete_requests_hash)}
            ${hashLine("risk_register", x.risk_register_hash)}
          </div>
        </details>
      </div>
    `).join("");
  }

  function renderSealItems(items){
    if(!items.length){
      return `<div class="text-sm text-slate-500">No monthly seals.</div>`;
    }

    return items.map(x => `
      <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class="flex gap-2 flex-wrap">
              <span class="px-2 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black">${esc(x.period_key || "-")}</span>
              ${sigBadge(x.seal_signature_mode)}
            </div>

            <div class="text-sm font-extrabold mt-3">${esc(x.seal_no || "-")}</div>
            <div class="text-xs text-slate-500 mt-1">archive_count: ${esc(x.archive_count || 0)}</div>
            <div class="text-[11px] text-slate-400 mt-2">sealed_at: ${esc(fmtTs(x.sealed_at))}</div>
            ${x.note ? `<div class="text-[11px] text-slate-500 mt-2">${esc(x.note)}</div>` : ``}
          </div>
        </div>

        <details class="mt-3">
          <summary class="cursor-pointer text-xs font-black text-slate-500">Seal Digest</summary>
          <div class="mt-3 text-[11px] break-all text-slate-600">${esc(x.registry_digest || "-")}</div>
        </details>
      </div>
    `).join("");
  }

  return {
    title: "Blogspot Archive Center",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Archive Center</div>
                <div class="text-sm text-slate-500 mt-1">Register signed evidence archive and create monthly seal.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnEvidenceCenter" class="px-4 py-3 rounded-2xl border border-sky-200 text-sky-700 font-black text-sm">
                  <i class="fa-solid fa-folder-open mr-2"></i>Evidence Center
                </button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Archive Range</div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">From Date</label>
                <input id="fromDate" type="date" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">To Date</label>
                <input id="toDate" type="date" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Period Key</label>
                <input id="periodKey" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="2026-03">
              </div>
              <div class="flex items-end">
                <button id="btnLoadManifest" class="w-full px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Load Manifest</button>
              </div>
            </div>
          </div>

          <div id="rangeInfo" class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 text-sm text-slate-600">
            Range: all time
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Archive Manifest</div>
                <button id="btnRegisterArchive" class="px-4 py-2.5 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">
                  Register Archive
                </button>
              </div>
              <pre id="manifestBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Monthly Seal Action</div>
                <button id="btnCreateSeal" class="px-4 py-2.5 rounded-2xl border border-violet-200 text-violet-700 font-black text-sm">
                  Create Seal
                </button>
              </div>
              <div class="mt-4 rounded-2xl border border-slate-200 dark:border-darkBorder p-4 text-sm text-slate-600">
                Create monthly seal after all archives in selected period are final.
              </div>
              <pre id="actionBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Archive Registry</div>
                <button id="btnRefreshRegistry" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Refresh</button>
              </div>
              <div id="registryBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Monthly Seal History</div>
                <button id="btnRefreshSeals" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Refresh</button>
              </div>
              <div id="sealBox" class="mt-4 space-y-3"></div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let MANIFEST = null;

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function getRange(){
        const fromDate = String(q("fromDate").value || "");
        const toDate = String(q("toDate").value || "");
        const periodKey = String(q("periodKey").value || "").trim() || periodKeyGuess(fromDate, toDate);

        return {
          fromDate,
          toDate,
          periodKey,
          from: toUnixStart(fromDate),
          to: toUnixEnd(toDate)
        };
      }

      async function renderRegistry(){
        const { periodKey } = getRange();
        const r = await loadRegistry(periodKey, 50);

        if(r.status !== "ok"){
          q("registryBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          return;
        }

        q("registryBox").innerHTML = renderRegistryItems(Array.isArray(r.data?.items) ? r.data.items : []);
      }

      async function renderSeals(){
        const { periodKey } = getRange();
        const r = await loadSeals(periodKey, 24);

        if(r.status !== "ok"){
          q("sealBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          return;
        }

        q("sealBox").innerHTML = renderSealItems(Array.isArray(r.data?.items) ? r.data.items : []);
      }

      async function renderAll(loadNewManifest = true){
        const rg = getRange();

        q("rangeInfo").textContent = rg.from || rg.to
          ? `Range: ${rg.fromDate || "-"} sampai ${rg.toDate || "-"} • period_key=${rg.periodKey || "-"}`
          : `Range: all time • period_key=${rg.periodKey || "-"}`;

        if(loadNewManifest){
          setMsg("muted", "Loading archive manifest...");
          const manifestRes = await loadManifest(rg.from, rg.to);
          MANIFEST = manifestRes;
          q("manifestBox").textContent = JSON.stringify(manifestRes, null, 2);

          if(manifestRes.status !== "ok"){
            setMsg("error", "Load manifest failed: " + manifestRes.status);
          }else{
            setMsg("success", "Archive manifest loaded.");
          }
        }

        await Promise.all([renderRegistry(), renderSeals()]);
      }

      q("btnLoadManifest").onclick = ()=>renderAll(true);
      q("btnReload").onclick = ()=>renderAll(true);
      q("btnRefreshRegistry").onclick = renderRegistry;
      q("btnRefreshSeals").onclick = renderSeals;
      q("btnEvidenceCenter").onclick = ()=>Orland.navigate("/integrations/blogspot/evidence-center");

      q("btnRegisterArchive").onclick = async ()=>{
        const rg = getRange();

        if(!MANIFEST || MANIFEST.status !== "ok"){
          setMsg("error", "Load manifest first.");
          return;
        }

        const data = MANIFEST.data || {};
        const summary = data.summary || {};
        const signature = data.signature || {};
        const checksums = summary.checksums || {};

        if(!checksums.snapshot || !checksums.logs || !checksums.approvals || !checksums.delete_requests || !checksums.risk_register){
          setMsg("error", "Manifest checksums incomplete.");
          return;
        }

        const note = window.prompt("Archive note (optional):") || "";

        setMsg("muted", "Registering archive...");
        const r = await registerArchive({
          archive_name: data.archive?.name || "blogspot_evidence_bundle",
          archive_version: data.archive?.version || "v1",
          period_key: rg.periodKey || "",
          range_from: rg.from || 0,
          range_to: rg.to || 0,
          checksums,
          summary: {
            logs_count: Number(summary.counts?.logs || 0),
            approvals_count: Number(summary.counts?.approvals || 0),
            delete_requests_count: Number(summary.counts?.delete_requests || 0),
            risk_register_count: Number(summary.counts?.risk_register || 0)
          },
          signature,
          note
        });

        q("actionBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Archive register failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Archive registered.");
        await renderRegistry();
      };

      q("btnCreateSeal").onclick = async ()=>{
        const rg = getRange();

        if(!rg.periodKey){
          setMsg("error", "Period key required.");
          return;
        }

        const note = window.prompt("Monthly seal note (optional):") || "";

        setMsg("muted", "Creating monthly seal...");
        const r = await createSeal({
          period_key: rg.periodKey,
          note
        });

        q("actionBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Create seal failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Monthly seal created.");
        await renderSeals();
      };

      await renderAll(true);
    }
  };
}
