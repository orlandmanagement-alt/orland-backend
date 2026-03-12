export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadQueue(filters = {}){
    const q = new URLSearchParams();
    if(filters.item_kind) q.set("item_kind", String(filters.item_kind));
    if(filters.sync_state) q.set("sync_state", String(filters.sync_state));
    if(filters.approval_status) q.set("approval_status", String(filters.approval_status));
    if(filters.q) q.set("q", String(filters.q));
    q.set("limit", String(filters.limit || 100));
    return await Orland.api("/api/blogspot/drift_queue?" + q.toString());
  }

  async function batchResolve(payload){
    return await Orland.api("/api/blogspot/batch_conflict_resolve", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function badge(tone, text){
    const map = {
      amber: "bg-amber-100 text-amber-700",
      cyan: "bg-cyan-100 text-cyan-700",
      rose: "bg-rose-100 text-rose-700",
      sky: "bg-sky-100 text-sky-700",
      violet: "bg-violet-100 text-violet-700",
      emerald: "bg-emerald-100 text-emerald-700",
      slate: "bg-slate-100 text-slate-700"
    };
    return `<span class="px-2 py-1 rounded-full text-[11px] font-black ${map[tone] || map.slate}">${esc(text)}</span>`;
  }

  function kindBadge(kind){
    return kind === "post" ? badge("amber", "post") : badge("cyan", "page");
  }

  function stateBadge(state){
    const s = String(state || "").toLowerCase();
    if(s === "error") return badge("rose", "error");
    if(s === "conflict_remote_missing") return badge("rose", "remote missing");
    if(s === "conflict_possible") return badge("violet", "conflict");
    if(s === "drift_detected") return badge("sky", "drift");
    if(s === "approval_pending") return badge("amber", "approval pending");
    if(s === "resolved_keep_local") return badge("amber", "resolved keep local");
    if(s === "resolved_pull_remote") return badge("sky", "resolved pull remote");
    if(s === "resolved_manual") return badge("emerald", "resolved manual");
    if(s === "in_sync") return badge("emerald", "in sync");
    return badge("slate", s || "-");
  }

  return {
    title: "Blogspot Bulk Drift Review",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Bulk Drift Review</div>
                <div class="text-sm text-slate-500 mt-1">Review and batch resolve conflict, drift, remote missing, dirty, and approval-pending items.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnConflictResolver" class="px-4 py-3 rounded-2xl border border-violet-200 text-violet-700 font-black text-sm">
                  <i class="fa-solid fa-code-compare mr-2"></i>Single Resolver
                </button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Item Kind</label>
                <select id="fKind" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="">all</option>
                  <option value="post">post</option>
                  <option value="page">page</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Sync State</label>
                <select id="fState" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="">all</option>
                  <option value="conflict_possible">conflict_possible</option>
                  <option value="conflict_remote_missing">conflict_remote_missing</option>
                  <option value="drift_detected">drift_detected</option>
                  <option value="error">error</option>
                  <option value="approval_pending">approval_pending</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Approval</label>
                <select id="fApproval" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="">all</option>
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Search</label>
                <input id="fQ" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="title / item id / slug / remote id">
              </div>
              <div class="flex items-end">
                <button id="btnApply" class="w-full px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Apply Filter</button>
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-xl font-extrabold">Batch Actions</div>
                <div class="text-sm text-slate-500 mt-1">Apply action to selected items only.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnSelectAll" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder text-sm font-black">Select All</button>
                <button id="btnClearAll" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder text-sm font-black">Clear</button>
                <button id="btnBatchKeepLocal" class="px-4 py-2.5 rounded-2xl border border-amber-200 text-amber-700 text-sm font-black">Batch Keep Local</button>
                <button id="btnBatchPullRemote" class="px-4 py-2.5 rounded-2xl border border-sky-200 text-sky-700 text-sm font-black">Batch Pull Remote</button>
                <button id="btnBatchMarkResolved" class="px-4 py-2.5 rounded-2xl border border-emerald-200 text-emerald-700 text-sm font-black">Batch Mark Resolved</button>
              </div>
            </div>
            <pre id="actionBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Drift Queue</div>
            <div id="listBox" class="mt-4 space-y-3"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let ITEMS = [];
      const SELECTED = new Set();

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function selectedItems(){
        return ITEMS
          .filter(x => SELECTED.has(`${x.item_kind}|${x.item_id}`))
          .map(x => ({ item_kind: x.item_kind, item_id: x.item_id }));
      }

      function renderList(){
        if(!ITEMS.length){
          q("listBox").innerHTML = `<div class="text-sm text-slate-500">No queue items.</div>`;
          return;
        }

        q("listBox").innerHTML = ITEMS.map(x => {
          const key = `${x.item_kind}|${x.item_id}`;
          const checked = SELECTED.has(key);

          return `
            <label class="block rounded-2xl border border-slate-200 dark:border-darkBorder p-4 hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="flex items-start gap-3">
                <input type="checkbox" class="mt-1 rowCheck" data-key="${esc(key)}" ${checked ? "checked" : ""}>
                <div class="min-w-0 flex-1">
                  <div class="flex gap-2 flex-wrap">
                    ${kindBadge(x.item_kind)}
                    ${stateBadge(x.sync_state)}
                    ${x.deleted_remote ? badge("rose", "deleted_remote") : ""}
                    ${x.dirty ? badge("amber", "dirty") : ""}
                    ${x.approval_status ? badge("slate", `approval:${x.approval_status}`) : ""}
                  </div>
                  <div class="text-sm font-extrabold mt-3">${esc(x.title || x.item_id || "-")}</div>
                  <div class="text-xs text-slate-500 mt-1">${esc(x.item_id || "-")} • ${esc(x.slug || "-")}</div>
                  <div class="text-xs text-slate-500 mt-1">remote_id: ${esc(x.remote_id || "-")}</div>
                  <div class="text-xs text-slate-500 mt-1">updated: ${esc(fmtTs(x.item_updated_at))} • synced: ${esc(fmtTs(x.last_synced_at))}</div>
                  ${x.sync_error ? `<div class="text-xs text-rose-600 mt-2">${esc(x.sync_error)}</div>` : ``}
                </div>
              </div>
            </label>
          `;
        }).join("");

        q("listBox").querySelectorAll(".rowCheck").forEach(el => {
          el.onchange = ()=>{
            const key = String(el.getAttribute("data-key") || "");
            if(el.checked) SELECTED.add(key);
            else SELECTED.delete(key);
          };
        });
      }

      async function render(){
        setMsg("muted", "Loading drift queue...");
        const r = await loadQueue({
          item_kind: q("fKind").value,
          sync_state: q("fState").value,
          approval_status: q("fApproval").value,
          q: q("fQ").value.trim(),
          limit: 100
        });

        if(r.status !== "ok"){
          q("listBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          setMsg("error", "Load queue failed: " + r.status);
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        for(const key of Array.from(SELECTED)){
          const found = ITEMS.some(x => `${x.item_kind}|${x.item_id}` === key);
          if(!found) SELECTED.delete(key);
        }
        renderList();
        setMsg("success", `Loaded ${ITEMS.length} queue items.`);
      }

      async function doBatch(resolver){
        const items = selectedItems();
        if(!items.length){
          setMsg("error", "No selected items.");
          return;
        }

        const note = window.prompt(`Batch ${resolver} note:`) || "";
        setMsg("muted", `Running batch ${resolver}...`);

        const r = await batchResolve({
          resolver,
          note,
          items
        });

        q("actionBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Batch action failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", `Batch ${resolver} completed. success=${r.data?.success || 0}, failed=${r.data?.failed || 0}`);
        await render();
      }

      q("btnReload").onclick = render;
      q("btnApply").onclick = render;
      q("btnSelectAll").onclick = ()=>{
        ITEMS.forEach(x => SELECTED.add(`${x.item_kind}|${x.item_id}`));
        renderList();
      };
      q("btnClearAll").onclick = ()=>{
        SELECTED.clear();
        renderList();
      };
      q("btnBatchKeepLocal").onclick = ()=>doBatch("keep_local");
      q("btnBatchPullRemote").onclick = ()=>doBatch("pull_remote");
      q("btnBatchMarkResolved").onclick = ()=>doBatch("mark_resolved");
      q("btnConflictResolver").onclick = ()=>Orland.navigate("/integrations/blogspot/conflict-resolver");

      await render();
    }
  };
}
