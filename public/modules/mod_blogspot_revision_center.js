export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadRevisions(item_kind = "", item_id = "", limit = 50){
    const q = new URLSearchParams();
    if(item_kind) q.set("item_kind", item_kind);
    if(item_id) q.set("item_id", item_id);
    q.set("limit", String(limit || 50));
    return await Orland.api("/api/blogspot/revisions?" + q.toString());
  }

  async function rollbackRevision(revision_id, note){
    return await Orland.api("/api/blogspot/revision_rollback", {
      method: "POST",
      body: JSON.stringify({ revision_id, note })
    });
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function actionBadge(v){
    const s = String(v || "").toLowerCase();
    if(s.includes("rollback")) return `<span class="px-2 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black">${esc(s)}</span>`;
    if(s === "create") return `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">create</span>`;
    if(s === "update" || s === "update_before") return `<span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">${esc(s)}</span>`;
    if(s === "delete" || s === "delete_before") return `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">${esc(s)}</span>`;
    return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(s || "-")}</span>`;
  }

  function kindBadge(v){
    const s = String(v || "").toLowerCase();
    if(s === "post") return `<span class="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-black">post</span>`;
    if(s === "page") return `<span class="px-2 py-1 rounded-full bg-cyan-100 text-cyan-700 text-[11px] font-black">page</span>`;
    return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(s || "-")}</span>`;
  }

  return {
    title: "Blogspot Revision Center",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Revision Center</div>
                <div class="text-sm text-slate-500 mt-1">Browse content revision history and rollback local post/page state.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnPosts" class="px-4 py-3 rounded-2xl border border-amber-200 text-amber-700 font-black text-sm">
                  <i class="fa-solid fa-pen mr-2"></i>Posts
                </button>
                <button id="btnPages" class="px-4 py-3 rounded-2xl border border-cyan-200 text-cyan-700 font-black text-sm">
                  <i class="fa-solid fa-file-lines mr-2"></i>Pages
                </button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Item Kind</label>
                <select id="fKind" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="">all</option>
                  <option value="post">post</option>
                  <option value="page">page</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Item ID</label>
                <input id="fItemId" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="post_xxx / page_xxx">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Limit</label>
                <select id="fLimit" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="20">20</option>
                  <option value="50" selected>50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                </select>
              </div>
              <div class="flex items-end">
                <button id="btnApply" class="w-full px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Apply Filter</button>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Revision History</div>
              <div id="listBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Revision Detail</div>
                <button id="btnRollback" class="px-4 py-2.5 rounded-2xl border border-violet-200 text-violet-700 font-black text-sm">Rollback</button>
              </div>
              <div id="detailMeta" class="mt-4 text-sm text-slate-500">No revision selected.</div>
              <pre id="detailBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let ITEMS = [];
      let ACTIVE = null;

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderDetail(){
        if(!ACTIVE){
          q("detailMeta").textContent = "No revision selected.";
          q("detailBox").textContent = "{}";
          return;
        }

        q("detailMeta").innerHTML = `
          <div class="flex gap-2 flex-wrap">
            ${kindBadge(ACTIVE.item_kind)}
            ${actionBadge(ACTIVE.source_action)}
            <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">rev #${esc(ACTIVE.revision_no)}</span>
          </div>
          <div class="mt-3 text-sm font-extrabold">${esc(ACTIVE.title || ACTIVE.item_id)}</div>
          <div class="mt-1 text-xs text-slate-500">${esc(ACTIVE.slug || "-")} • ${esc(fmtTs(ACTIVE.created_at))}</div>
          ${ACTIVE.note ? `<div class="mt-2 text-xs text-slate-500">${esc(ACTIVE.note)}</div>` : ``}
        `;
        q("detailBox").textContent = JSON.stringify(ACTIVE.snapshot_json || {}, null, 2);
      }

      function renderList(){
        if(!ITEMS.length){
          q("listBox").innerHTML = `<div class="text-sm text-slate-500">No revision history found.</div>`;
          renderDetail();
          return;
        }

        q("listBox").innerHTML = ITEMS.map(x => `
          <button class="w-full text-left rounded-2xl border p-4 hover:bg-slate-50 dark:hover:bg-white/5 revItem ${
            ACTIVE && ACTIVE.id === x.id
              ? "border-violet-300 ring-2 ring-violet-200"
              : "border-slate-200 dark:border-darkBorder"
          }" data-id="${esc(x.id)}">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex gap-2 flex-wrap">
                  ${kindBadge(x.item_kind)}
                  ${actionBadge(x.source_action)}
                  <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">rev #${esc(x.revision_no)}</span>
                </div>
                <div class="text-sm font-extrabold mt-3">${esc(x.title || x.item_id)}</div>
                <div class="text-xs text-slate-500 mt-1">${esc(x.slug || "-")} • ${esc(x.status || "-")}</div>
                <div class="text-[11px] text-slate-400 mt-2">${esc(fmtTs(x.created_at))}</div>
              </div>
            </div>
          </button>
        `).join("");

        q("listBox").querySelectorAll(".revItem").forEach(btn => {
          btn.onclick = ()=>{
            ACTIVE = ITEMS.find(x => String(x.id) === String(btn.getAttribute("data-id"))) || null;
            renderList();
            renderDetail();
          };
        });

        if(!ACTIVE) ACTIVE = ITEMS[0] || null;
        renderDetail();
      }

      async function render(){
        setMsg("muted", "Loading revision history...");
        const r = await loadRevisions(
          q("fKind").value,
          q("fItemId").value.trim(),
          q("fLimit").value
        );

        if(r.status !== "ok"){
          q("listBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          setMsg("error", "Load revisions failed: " + r.status);
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        if(ACTIVE){
          ACTIVE = ITEMS.find(x => String(x.id) === String(ACTIVE.id)) || null;
        }
        renderList();
        setMsg("success", "Revision history loaded.");
      }

      q("btnReload").onclick = render;
      q("btnApply").onclick = ()=>{ ACTIVE = null; render(); };
      q("btnPosts").onclick = ()=>Orland.navigate("/integrations/blogspot/posts");
      q("btnPages").onclick = ()=>Orland.navigate("/integrations/blogspot/pages");

      q("btnRollback").onclick = async ()=>{
        if(!ACTIVE){
          setMsg("error", "Select revision first.");
          return;
        }

        const note = window.prompt(`Rollback revision #${ACTIVE.revision_no} ? Enter note:`) || "";
        setMsg("muted", "Applying rollback...");
        const r = await rollbackRevision(ACTIVE.id, note);

        q("detailBox").textContent = JSON.stringify({
          selected_revision: ACTIVE,
          rollback_result: r
        }, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Rollback failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Rollback applied.");
        ACTIVE = null;
        await render();
      };

      await render();
    }
  };
}
