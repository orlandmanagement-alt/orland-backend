export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadManifest(from, to){
    const q = new URLSearchParams();
    if(from) q.set("from", String(from));
    if(to) q.set("to", String(to));
    return await Orland.api("/api/blogspot/evidence_manifest" + (q.toString() ? `?${q.toString()}` : ""));
  }

  async function loadSnapshot(from, to){
    const q = new URLSearchParams();
    if(from) q.set("from", String(from));
    if(to) q.set("to", String(to));
    return await Orland.api("/api/blogspot/evidence_snapshot" + (q.toString() ? `?${q.toString()}` : ""));
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

  function copyText(text){
    return navigator.clipboard.writeText(String(text || ""));
  }

  function fileCard(item){
    return `
      <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
        <div class="text-sm font-extrabold">${esc(item.kind || "-")}</div>
        <div class="text-xs text-slate-500 mt-2 break-all">${esc(item.url || "-")}</div>
        <div class="mt-4 flex gap-2 flex-wrap">
          <a href="${esc(item.url || "#")}" target="_blank" rel="noopener noreferrer" class="px-3 py-2 rounded-xl bg-primary text-white text-xs font-black">Open</a>
          <button type="button" class="btnCopyUrl px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-url="${esc(item.url || "")}">Copy URL</button>
        </div>
      </div>
    `;
  }

  function kpiCard(title, value, hint = "", tone = "default"){
    const toneCls = tone === "danger"
      ? "border-red-200"
      : tone === "warn"
      ? "border-amber-200"
      : tone === "ok"
      ? "border-emerald-200"
      : "border-slate-200 dark:border-darkBorder";

    return `
      <div class="rounded-2xl border ${toneCls} bg-white dark:bg-darkLighter p-4">
        <div class="text-xs font-bold text-slate-500">${esc(title)}</div>
        <div class="text-2xl font-extrabold mt-2">${esc(value)}</div>
        ${hint ? `<div class="text-[11px] text-slate-500 mt-2">${esc(hint)}</div>` : ``}
      </div>
    `;
  }

  return {
    title:"Blogspot Evidence Center",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Evidence Center</div>
                <div class="text-sm text-slate-500 mt-1">Download compliance evidence, snapshot, logs, approval register, delete register, dan risk register.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnExecutive" class="px-4 py-3 rounded-2xl border border-sky-200 text-sky-700 font-black text-sm">
                  <i class="fa-solid fa-chart-simple mr-2"></i>Executive Audit
                </button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Range Filter</div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">From Date</label>
                <input id="fromDate" type="date" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">To Date</label>
                <input id="toDate" type="date" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              </div>
              <div class="flex items-end">
                <button id="btnApplyRange" class="w-full px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Apply Range</button>
              </div>
            </div>
          </div>

          <div id="rangeInfo" class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 text-sm text-slate-600">Range: all time</div>

          <div class="grid grid-cols-2 xl:grid-cols-5 gap-4" id="kpiBox"></div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Evidence Files</div>
              <div id="filesBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Snapshot Summary</div>
              <div id="summaryBox" class="mt-4 space-y-3"></div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Raw Manifest</div>
            <pre id="rawManifest" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Raw Snapshot</div>
            <pre id="rawSnapshot" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function currentRange(){
        const fromDate = String(q("fromDate").value || "");
        const toDate = String(q("toDate").value || "");
        return {
          fromDate,
          toDate,
          from: toUnixStart(fromDate),
          to: toUnixEnd(toDate)
        };
      }

      function renderSummary(snapshot){
        const d = snapshot?.data || {};
        const k = d.kpi || {};
        const s = d.sync || {};
        const safe = d.safety || {};

        q("kpiBox").innerHTML = [
          kpiCard("Dirty", k.dirty_total ?? 0, "Belum sinkron", (k.dirty_total || 0) > 0 ? "warn" : "ok"),
          kpiCard("Approval Pending", k.approval_pending_total ?? 0, "Menunggu review", (k.approval_pending_total || 0) > 0 ? "warn" : "ok"),
          kpiCard("Remote Deleted", k.remote_deleted_total ?? 0, "Konten remote hilang", (k.remote_deleted_total || 0) > 0 ? "danger" : "ok"),
          kpiCard("Drift", k.drift_total ?? 0, "Perubahan remote", (k.drift_total || 0) > 0 ? "danger" : "ok"),
          kpiCard("Delete Pending", k.delete_pending_total ?? 0, "Antrian delete", (k.delete_pending_total || 0) > 0 ? "warn" : "ok")
        ].join("");

        q("summaryBox").innerHTML = `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="text-sm font-extrabold">Operational Snapshot</div>
            <div class="mt-3 space-y-2 text-sm text-slate-600">
              <div><span class="font-bold">Local Posts:</span> ${esc(k.local_posts ?? 0)}</div>
              <div><span class="font-bold">Local Pages:</span> ${esc(k.local_pages ?? 0)}</div>
              <div><span class="font-bold">Active Widgets:</span> ${esc(k.active_widgets ?? 0)}</div>
              <div><span class="font-bold">Logs Total:</span> ${esc(k.logs_total ?? 0)}</div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="text-sm font-extrabold">Sync Health</div>
            <div class="mt-3 space-y-2 text-sm text-slate-600">
              <div><span class="font-bold">Last Run:</span> ${esc(fmtTs(s.last_run_at))}</div>
              <div><span class="font-bold">Last Success:</span> ${esc(fmtTs(s.last_success_at))}</div>
              <div><span class="font-bold">Last Status:</span> ${esc(s.last_status || "idle")}</div>
              <div><span class="font-bold">Last Message:</span> ${esc(s.last_message || "-")}</div>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="text-sm font-extrabold">Safety State</div>
            <div class="mt-3 space-y-2 text-sm text-slate-600">
              <div><span class="font-bold">Write Lock:</span> ${safe.write_lock_enabled ? "enabled" : "disabled"}</div>
              <div><span class="font-bold">Maintenance:</span> ${safe.maintenance_mode ? "enabled" : "disabled"}</div>
              <div><span class="font-bold">Delete Approval:</span> ${safe.remote_delete_requires_approval ? "required" : "not required"}</div>
            </div>
          </div>
        `;
      }

      function renderFiles(manifest){
        const items = Array.isArray(manifest?.data?.files) ? manifest.data.files : [];
        if(!items.length){
          q("filesBox").innerHTML = `<div class="text-sm text-slate-500">No evidence files.</div>`;
          return;
        }

        q("filesBox").innerHTML = items.map(fileCard).join("");

        q("filesBox").querySelectorAll(".btnCopyUrl").forEach(btn => {
          btn.onclick = async ()=>{
            try{
              await copyText(btn.getAttribute("data-url") || "");
              setMsg("success", "URL copied.");
            }catch{
              setMsg("error", "Copy failed.");
            }
          };
        });
      }

      async function render(){
        const rg = currentRange();

        q("rangeInfo").textContent = rg.from || rg.to
          ? `Range: ${rg.fromDate || "-"} sampai ${rg.toDate || "-"}`
          : "Range: all time";

        setMsg("muted", "Loading evidence center...");

        const [manifestRes, snapshotRes] = await Promise.all([
          loadManifest(rg.from, rg.to),
          loadSnapshot(rg.from, rg.to)
        ]);

        q("rawManifest").textContent = JSON.stringify(manifestRes, null, 2);
        q("rawSnapshot").textContent = JSON.stringify(snapshotRes, null, 2);

        if(manifestRes.status !== "ok"){
          setMsg("error", "Load manifest failed: " + manifestRes.status);
          return;
        }
        if(snapshotRes.status !== "ok"){
          setMsg("error", "Load snapshot failed: " + snapshotRes.status);
          return;
        }

        renderFiles(manifestRes);
        renderSummary(snapshotRes);
        setMsg("success", "Evidence center loaded.");
      }

      q("btnReload").onclick = render;
      q("btnApplyRange").onclick = render;
      q("btnExecutive").onclick = ()=>Orland.navigate("/integrations/blogspot/executive-audit");

      await render();
    }
  };
}
