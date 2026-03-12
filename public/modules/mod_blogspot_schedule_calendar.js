export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadSchedules(params = {}){
    const q = new URLSearchParams();
    if(params.item_kind) q.set("item_kind", params.item_kind);
    if(params.status) q.set("status", params.status);
    if(params.q) q.set("q", params.q);
    q.set("limit", String(params.limit || 100));
    return await Orland.api("/api/blogspot/schedule_jobs?" + q.toString());
  }

  async function saveSchedule(payload){
    return await Orland.api("/api/blogspot/schedule_jobs", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function runPlanner(){
    return await Orland.api("/api/blogspot/schedule_plan_run", {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function toInputDateTime(ts){
    const n = Number(ts || 0);
    if(!n) return "";
    const d = new Date(n * 1000);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }

  function fromInputDateTime(v){
    const ms = new Date(String(v || "")).getTime();
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
  }

  function statusBadge(v){
    const s = String(v || "").toLowerCase();
    if(s === "scheduled") return `<span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">scheduled</span>`;
    if(s === "queued") return `<span class="px-2 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black">queued</span>`;
    if(s === "completed") return `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">completed</span>`;
    if(s === "cancelled") return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">cancelled</span>`;
    if(s === "failed") return `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">failed</span>`;
    return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(s || "-")}</span>`;
  }

  return {
    title: "Blogspot Schedule Calendar",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">Blogspot Scheduled Publishing</div>
                <div class="text-sm text-slate-500 mt-1">Plan delayed publish jobs for post/page.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border font-black text-sm">Reload</button>
                <button id="btnPlanner" class="px-4 py-3 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">Run Planner</button>
                <button id="btnNew" class="px-4 py-3 rounded-2xl bg-black text-white font-black text-sm">New Schedule</button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 p-5">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Item Kind</label>
                <select id="fKind" class="w-full px-4 py-3 rounded-2xl border">
                  <option value="">all</option>
                  <option value="post">post</option>
                  <option value="page">page</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Status</label>
                <select id="fStatus" class="w-full px-4 py-3 rounded-2xl border">
                  <option value="">all</option>
                  <option value="scheduled">scheduled</option>
                  <option value="queued">queued</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                  <option value="failed">failed</option>
                </select>
              </div>
              <div class="md:col-span-2">
                <label class="block text-sm font-bold text-slate-500 mb-2">Search</label>
                <input id="fQ" class="w-full px-4 py-3 rounded-2xl border" placeholder="item_id / note">
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
            <div class="rounded-3xl border border-slate-200 p-5">
              <div class="text-xl font-extrabold">Schedule Form</div>
              <form id="formBox" class="mt-4 space-y-4">
                <input id="xId" type="hidden">

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">Item Kind</label>
                    <select id="xItemKind" class="w-full px-4 py-3 rounded-2xl border">
                      <option value="post">post</option>
                      <option value="page">page</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">Job Type</label>
                    <select id="xJobType" class="w-full px-4 py-3 rounded-2xl border">
                      <option value="publish_post">publish_post</option>
                      <option value="publish_page">publish_page</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">Item ID</label>
                  <input id="xItemId" class="w-full px-4 py-3 rounded-2xl border" placeholder="post_xxx / page_xxx">
                </div>

                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">Planned At</label>
                    <input id="xPlannedAt" type="datetime-local" class="w-full px-4 py-3 rounded-2xl border">
                  </div>
                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">Timezone</label>
                    <input id="xTimezone" class="w-full px-4 py-3 rounded-2xl border" value="Asia/Jakarta">
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">Note</label>
                  <textarea id="xNote" rows="4" class="w-full px-4 py-3 rounded-2xl border"></textarea>
                </div>

                <div class="flex gap-2 flex-wrap">
                  <button class="px-4 py-3 rounded-2xl bg-black text-white font-black text-sm">Save Schedule</button>
                  <button type="button" id="btnCancelSchedule" class="px-4 py-3 rounded-2xl border border-amber-200 text-amber-700 font-black text-sm">Cancel Schedule</button>
                  <button type="button" id="btnDeleteSchedule" class="px-4 py-3 rounded-2xl border border-rose-200 text-rose-700 font-black text-sm">Delete</button>
                  <button type="button" id="btnResetForm" class="px-4 py-3 rounded-2xl border font-black text-sm">Reset</button>
                </div>
              </form>
            </div>

            <div class="rounded-3xl border border-slate-200 p-5">
              <div class="text-xl font-extrabold">Agenda List</div>
              <div id="listBox" class="mt-4 space-y-3"></div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 p-5">
            <div class="text-xl font-extrabold">Planner Output</div>
            <pre id="rawBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 rounded-2xl p-4">{}</pre>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let ITEMS = [];

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function resetForm(){
        q("xId").value = "";
        q("xItemKind").value = "post";
        q("xJobType").value = "publish_post";
        q("xItemId").value = "";
        q("xPlannedAt").value = "";
        q("xTimezone").value = "Asia/Jakarta";
        q("xNote").value = "";
      }

      function fillForm(row){
        q("xId").value = row.id || "";
        q("xItemKind").value = row.item_kind || "post";
        q("xJobType").value = row.job_type || (row.item_kind === "page" ? "publish_page" : "publish_post");
        q("xItemId").value = row.item_id || "";
        q("xPlannedAt").value = toInputDateTime(row.planned_at || 0);
        q("xTimezone").value = row.timezone || "Asia/Jakarta";
        q("xNote").value = row.note || "";
      }

      function renderList(){
        const kind = String(q("fKind").value || "").trim();
        const status = String(q("fStatus").value || "").trim();
        const keyword = String(q("fQ").value || "").trim().toLowerCase();

        const rows = ITEMS.filter(x => {
          const okKind = !kind || x.item_kind === kind;
          const okStatus = !status || x.status === status;
          const hay = [x.item_id, x.note, x.job_type, x.status].join(" ").toLowerCase();
          const okQ = !keyword || hay.includes(keyword);
          return okKind && okStatus && okQ;
        });

        if(!rows.length){
          q("listBox").innerHTML = `<div class="text-sm text-slate-500">No schedule data.</div>`;
          return;
        }

        q("listBox").innerHTML = rows.map(x => `
          <button class="w-full text-left rounded-2xl border border-slate-200 p-4 hover:bg-slate-50 itemRow" data-id="${esc(x.id)}">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex gap-2 flex-wrap">
                  ${statusBadge(x.status)}
                  <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.item_kind)}</span>
                  <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.job_type)}</span>
                </div>
                <div class="text-sm font-extrabold mt-3">${esc(x.item_id || "-")}</div>
                <div class="text-xs text-slate-500 mt-1">planned=${esc(fmtTs(x.planned_at))} • tz=${esc(x.timezone || "-")}</div>
                <div class="text-xs text-slate-500 mt-1">queued_job=${esc(x.queued_job_id || "-")}</div>
                ${x.note ? `<div class="text-xs text-slate-500 mt-2">${esc(x.note)}</div>` : ``}
                ${x.last_error ? `<div class="text-xs text-rose-600 mt-2">${esc(x.last_error)}</div>` : ``}
              </div>
            </div>
          </button>
        `).join("");

        q("listBox").querySelectorAll(".itemRow").forEach(btn => {
          btn.onclick = ()=>{
            const row = ITEMS.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(!row) return;
            fillForm(row);
          };
        });
      }

      async function render(){
        setMsg("muted", "Loading schedules...");
        const r = await loadSchedules({ limit: 200 });
        q("rawBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + r.status);
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        renderList();
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("btnNew").onclick = resetForm;
      q("btnResetForm").onclick = resetForm;
      q("fKind").onchange = renderList;
      q("fStatus").onchange = renderList;
      q("fQ").oninput = renderList;

      q("xItemKind").onchange = ()=>{
        q("xJobType").value = q("xItemKind").value === "page" ? "publish_page" : "publish_post";
      };

      q("formBox").onsubmit = async (e)=>{
        e.preventDefault();

        const id = String(q("xId").value || "").trim();
        const payload = {
          action: id ? "update" : "create",
          id,
          item_kind: q("xItemKind").value,
          item_id: q("xItemId").value.trim(),
          job_type: q("xJobType").value,
          planned_at: fromInputDateTime(q("xPlannedAt").value),
          timezone: q("xTimezone").value.trim() || "Asia/Jakarta",
          note: q("xNote").value.trim()
        };

        setMsg("muted", "Saving schedule...");
        const r = await saveSchedule(payload);
        q("rawBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Save failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Schedule saved.");
        resetForm();
        await render();
      };

      q("btnCancelSchedule").onclick = async ()=>{
        const id = String(q("xId").value || "").trim();
        if(!id){
          setMsg("error", "Select schedule first.");
          return;
        }

        setMsg("muted", "Cancelling schedule...");
        const r = await saveSchedule({ action:"cancel", id });
        q("rawBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Cancel failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Schedule cancelled.");
        resetForm();
        await render();
      };

      q("btnDeleteSchedule").onclick = async ()=>{
        const id = String(q("xId").value || "").trim();
        if(!id){
          setMsg("error", "Select schedule first.");
          return;
        }

        setMsg("muted", "Deleting schedule...");
        const r = await saveSchedule({ action:"delete", id });
        q("rawBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Delete failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Schedule deleted.");
        resetForm();
        await render();
      };

      q("btnPlanner").onclick = async ()=>{
        setMsg("muted", "Running schedule planner...");
        const r = await runPlanner();
        q("rawBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Planner failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Planner executed.");
        await render();
      };

      resetForm();
      await render();
    }
  };
}
