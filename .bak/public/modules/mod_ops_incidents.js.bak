export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  const fmtTs = (n)=>{
    try{
      return new Intl.DateTimeFormat("id-ID", {
        dateStyle:"medium",
        timeStyle:"short"
      }).format(new Date(Number(n||0) * 1000));
    }catch{
      return String(n||"");
    }
  };

  async function apiList(status="", severity=""){
    const q = new URLSearchParams();
    if(status) q.set("status", status);
    if(severity) q.set("severity", severity);
    q.set("limit", "100");
    return await Orland.api("/api/incidents/list?" + q.toString());
  }

  async function apiCreate(payload){
    return await Orland.api("/api/incidents/create", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function apiUpdate(payload){
    return await Orland.api("/api/incidents/update", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function apiComments(incident_id){
    return await Orland.api("/api/incidents/comments?incident_id=" + encodeURIComponent(incident_id));
  }

  async function apiAddComment(payload){
    return await Orland.api("/api/incidents/comments", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  function sevBadge(sev){
    const s = String(sev||"").toLowerCase();
    if(s==="critical") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">critical</span>`;
    if(s==="high") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-700 border border-amber-200">high</span>`;
    if(s==="medium") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-sky-100 text-sky-700 border border-sky-200">medium</span>`;
    return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">${esc(s||"low")}</span>`;
  }

  function statusBadge(st){
    const s = String(st||"").toLowerCase();
    if(s==="closed") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">closed</span>`;
    if(s==="acknowledged") return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-violet-100 text-violet-700 border border-violet-200">acknowledged</span>`;
    return `<span class="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">open</span>`;
  }

  return {
    title:"Incidents",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xl font-extrabold text-slate-900 dark:text-white">Incident Manager</div>
              <div class="text-sm text-slate-500">Create, triage, acknowledge, close, and comment incidents.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnReload" class="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                Reload
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div class="xl:col-span-2 space-y-4">
              <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Status</label>
                    <select id="fStatus" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                      <option value="">All</option>
                      <option value="open">Open</option>
                      <option value="acknowledged">Acknowledged</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Severity</label>
                    <select id="fSeverity" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                      <option value="">All</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div class="md:col-span-2 flex items-end gap-2">
                    <button id="btnApply" class="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white">Apply Filter</button>
                    <button id="btnClear" class="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder">Reset</button>
                  </div>
                </div>
              </div>

              <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
                <div class="text-sm font-extrabold">Create Incident</div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Severity</label>
                    <select id="cSeverity" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                      <option value="low">Low</option>
                      <option value="medium" selected>Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Type</label>
                    <input id="cType" value="security" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                  </div>
                  <div>
                    <label class="text-[11px] font-bold text-slate-500">Owner User ID</label>
                    <input id="cOwner" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="optional">
                  </div>
                  <div class="md:col-span-3">
                    <label class="text-[11px] font-bold text-slate-500">Summary</label>
                    <input id="cSummary" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Suspicious login burst">
                  </div>
                  <div class="md:col-span-3">
                    <label class="text-[11px] font-bold text-slate-500">Details JSON</label>
                    <textarea id="cDetails" rows="4" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder='{"ip":"1.2.3.4","source":"manual"}'></textarea>
                  </div>
                </div>
                <div class="mt-4 flex gap-2">
                  <button id="btnCreate" class="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white">Create Incident</button>
                  <div id="createMsg" class="text-xs self-center"></div>
                </div>
              </div>

              <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl overflow-hidden">
                <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between">
                  <div class="text-sm font-extrabold">Incident List</div>
                  <div id="listInfo" class="text-[11px] text-slate-500">—</div>
                </div>
                <div id="listBox" class="divide-y divide-slate-100 dark:divide-darkBorder"></div>
              </div>
            </div>

            <div class="space-y-4">
              <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
                <div class="text-sm font-extrabold">Selected Incident</div>
                <div id="selBox" class="mt-3 text-xs text-slate-500">No incident selected.</div>
              </div>

              <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
                <div class="text-sm font-extrabold">Comments</div>
                <div id="commentsBox" class="mt-3 space-y-3 max-h-[380px] overflow-auto"></div>
                <div class="mt-4">
                  <textarea id="commentBody" rows="4" class="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Add comment..."></textarea>
                  <div class="mt-2 flex gap-2">
                    <button id="btnComment" class="px-4 py-2 rounded-xl text-xs font-black bg-primary text-white">Add Comment</button>
                    <div id="commentMsg" class="text-xs self-center"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);
      let ITEMS = [];
      let SELECTED = null;

      function parseDetails(v){
        try{
          if(!v) return null;
          return typeof v === "string" ? JSON.parse(v) : v;
        }catch{
          return null;
        }
      }

      function renderList(){
        const box = q("listBox");
        q("listInfo").textContent = ITEMS.length + " incident(s)";

        if(!ITEMS.length){
          box.innerHTML = `<div class="p-4 text-xs text-slate-500">No incidents found.</div>`;
          return;
        }

        box.innerHTML = ITEMS.map(it=>`
          <button data-id="${esc(it.id)}" class="incidentRow w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-white/5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-extrabold truncate">${esc(it.summary || "Untitled incident")}</div>
                <div class="text-[11px] text-slate-500 mt-1">
                  <span>${esc(it.type || "-")}</span>
                  <span class="mx-1">•</span>
                  <span>${esc(fmtTs(it.updated_at || it.created_at))}</span>
                </div>
              </div>
              <div class="flex gap-2 shrink-0">
                ${sevBadge(it.severity)}
                ${statusBadge(it.status)}
              </div>
            </div>
          </button>
        `).join("");

        box.querySelectorAll(".incidentRow").forEach(btn=>{
          btn.onclick = async ()=>{
            const id = btn.getAttribute("data-id");
            SELECTED = ITEMS.find(x => String(x.id) === String(id)) || null;
            renderSelected();
            await loadComments();
          };
        });
      }

      function renderSelected(){
        const box = q("selBox");
        if(!SELECTED){
          box.innerHTML = "No incident selected.";
          return;
        }

        const details = parseDetails(SELECTED.details_json);
        box.innerHTML = `
          <div class="space-y-3">
            <div>
              <div class="text-sm font-extrabold">${esc(SELECTED.summary || "-")}</div>
              <div class="text-[11px] text-slate-500 mt-1">${esc(SELECTED.type || "-")} • ${esc(fmtTs(SELECTED.created_at))}</div>
            </div>

            <div class="flex gap-2 flex-wrap">
              ${sevBadge(SELECTED.severity)}
              ${statusBadge(SELECTED.status)}
            </div>

            <div class="text-[11px] text-slate-500">
              Owner: ${esc(SELECTED.owner_user_id || "-")}
            </div>

            <div>
              <div class="text-[11px] font-bold text-slate-500">Details</div>
              <pre class="mt-1 text-[11px] whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-xl p-3">${esc(JSON.stringify(details, null, 2) || "{}")}</pre>
            </div>

            <div class="flex gap-2 flex-wrap">
              <button id="btnAck" class="px-3 py-2 rounded-xl text-xs font-black border border-violet-200 text-violet-700 hover:bg-violet-50">Acknowledge</button>
              <button id="btnClose" class="px-3 py-2 rounded-xl text-xs font-black border border-emerald-200 text-emerald-700 hover:bg-emerald-50">Close</button>
            </div>

            <div id="selMsg" class="text-xs"></div>
          </div>
        `;

        q("btnAck").onclick = async ()=>{
          const r = await apiUpdate({ incident_id: SELECTED.id, status: "acknowledged" });
          const m = q("selMsg");
          if(r.status !== "ok"){
            m.className = "text-xs text-red-500";
            m.textContent = "Failed: " + r.status;
            return;
          }
          m.className = "text-xs text-emerald-600";
          m.textContent = "Incident acknowledged.";
          await reloadList(true);
        };

        q("btnClose").onclick = async ()=>{
          const r = await apiUpdate({ incident_id: SELECTED.id, status: "closed" });
          const m = q("selMsg");
          if(r.status !== "ok"){
            m.className = "text-xs text-red-500";
            m.textContent = "Failed: " + r.status;
            return;
          }
          m.className = "text-xs text-emerald-600";
          m.textContent = "Incident closed.";
          await reloadList(true);
        };
      }

      async function loadComments(){
        const box = q("commentsBox");
        if(!SELECTED){
          box.innerHTML = `<div class="text-xs text-slate-500">Select an incident first.</div>`;
          return;
        }

        box.innerHTML = `<div class="text-xs text-slate-500">Loading...</div>`;
        const r = await apiComments(SELECTED.id);

        if(r.status !== "ok"){
          box.innerHTML = `<div class="text-xs text-red-500">Failed: ${esc(r.status)}</div>`;
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        if(!items.length){
          box.innerHTML = `<div class="text-xs text-slate-500">No comments yet.</div>`;
          return;
        }

        box.innerHTML = items.map(c=>`
          <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="text-[11px] text-slate-500">${esc(c.author_user_id || "-")} • ${esc(fmtTs(c.created_at))}</div>
            <div class="text-xs mt-2 whitespace-pre-wrap break-words">${esc(c.body || "")}</div>
          </div>
        `).join("");
      }

      async function reloadList(keepSelected=false){
        const status = q("fStatus").value || "";
        const severity = q("fSeverity").value || "";
        const r = await apiList(status, severity);

        if(r.status !== "ok"){
          q("listBox").innerHTML = `<div class="p-4 text-xs text-red-500">Failed: ${esc(r.status)}</div>`;
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        renderList();

        if(keepSelected && SELECTED){
          SELECTED = ITEMS.find(x => String(x.id) === String(SELECTED.id)) || null;
        }else if(!SELECTED && ITEMS.length){
          SELECTED = ITEMS[0];
        }

        renderSelected();
        await loadComments();
      }

      q("btnReload").onclick = ()=>reloadList(true);
      q("btnApply").onclick = ()=>reloadList(false);
      q("btnClear").onclick = ()=>{
        q("fStatus").value = "";
        q("fSeverity").value = "";
        reloadList(false);
      };

      q("btnCreate").onclick = async ()=>{
        const msg = q("createMsg");
        msg.className = "text-xs text-slate-500";
        msg.textContent = "Creating...";

        let details_json = null;
        const raw = q("cDetails").value.trim();
        if(raw){
          try{
            details_json = JSON.parse(raw);
          }catch{
            msg.className = "text-xs text-red-500";
            msg.textContent = "Details JSON invalid.";
            return;
          }
        }

        const r = await apiCreate({
          severity: q("cSeverity").value,
          type: q("cType").value.trim(),
          summary: q("cSummary").value.trim(),
          owner_user_id: q("cOwner").value.trim(),
          details_json
        });

        if(r.status !== "ok"){
          msg.className = "text-xs text-red-500";
          msg.textContent = "Failed: " + r.status;
          return;
        }

        msg.className = "text-xs text-emerald-600";
        msg.textContent = "Incident created.";

        q("cSummary").value = "";
        q("cDetails").value = "";
        q("cOwner").value = "";

        await reloadList(false);
      };

      q("btnComment").onclick = async ()=>{
        const msg = q("commentMsg");
        if(!SELECTED){
          msg.className = "text-xs text-red-500";
          msg.textContent = "Select an incident first.";
          return;
        }

        const body = q("commentBody").value.trim();
        if(!body){
          msg.className = "text-xs text-red-500";
          msg.textContent = "Comment required.";
          return;
        }

        msg.className = "text-xs text-slate-500";
        msg.textContent = "Sending...";

        const r = await apiAddComment({
          incident_id: SELECTED.id,
          body
        });

        if(r.status !== "ok"){
          msg.className = "text-xs text-red-500";
          msg.textContent = "Failed: " + r.status;
          return;
        }

        msg.className = "text-xs text-emerald-600";
        msg.textContent = "Comment added.";
        q("commentBody").value = "";
        await loadComments();
        await reloadList(true);
      };

      await reloadList(false);
    }
  };
}
