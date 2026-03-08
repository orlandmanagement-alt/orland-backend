export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-2 justify-between">
        <div>
          <div class="text-sm font-bold">Incidents & Alerts</div>
          <div class="text-xs text-slate-500">CRUD incidents (open/ack/closed)</div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button id="btnReload" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Reload</button>
          <button id="btnNew" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white">New</button>
        </div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-2">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input id="q" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="search summary/type">
          <select id="status" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="">all status</option>
            <option value="open">open</option>
            <option value="ack">ack</option>
            <option value="closed">closed</option>
          </select>
          <select id="severity" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="">all severity</option>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
          <button id="btnFilter" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Apply</button>
        </div>
        <div id="tbl" class="text-[12px] text-slate-500">Loading…</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-2">
        <div class="text-xs font-bold">Edit / Create</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input id="id" disabled class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="id">
          <input id="type" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="type (e.g. outage)">
          <select id="sev" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option>low</option><option selected>medium</option><option>high</option><option>critical</option>
          </select>
          <select id="st" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option>open</option><option>ack</option><option>closed</option>
          </select>
        </div>
        <input id="summary" class="w-full text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="summary">
        <textarea id="details" class="w-full h-28 text-[11px] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">{}</textarea>

        <div class="flex gap-2 flex-wrap">
          <button id="btnSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Save</button>
          <button id="btnAck" class="text-xs px-3 py-2 rounded-lg bg-warning text-white">Ack</button>
          <button id="btnClose" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white">Close</button>
          <button id="btnReopen" class="text-xs px-3 py-2 rounded-lg bg-info text-white">Reopen</button>
          <button id="btnDel" class="text-xs px-3 py-2 rounded-lg bg-danger text-white">Delete</button>
          <button id="btnClear" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Clear</button>
        </div>

        <details><summary class="text-xs text-slate-500">Debug</summary><pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre></details>
      </div>
    </div>
  `;

  const el=(id)=>document.getElementById(id);
  const clear=()=>{
    el("id").value=""; el("type").value="general"; el("sev").value="medium"; el("st").value="open";
    el("summary").value=""; el("details").value="{}";
  };
  const fill=(x)=>{
    el("id").value=x.id||""; el("type").value=x.type||"general"; el("sev").value=x.severity||"medium";
    el("st").value=x.status||"open"; el("summary").value=x.summary||""; el("details").value=x.details_json||"{}";
  };

  async function load(){
    const q = el("q").value.trim();
    const status = el("status").value;
    const severity = el("severity").value;
    const r = await api(`/api/ops/incidents?q=${encodeURIComponent(q)}&status=${encodeURIComponent(status)}&severity=${encodeURIComponent(severity)}&limit=120`);
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }
    const rows=r.data.rows||[];
    el("tbl").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="text-slate-500">
            <tr><th class="text-left py-2">Summary</th><th class="text-left py-2">Type</th><th class="text-left py-2">Severity</th><th class="text-left py-2">Status</th><th class="text-right py-2">Action</th></tr>
          </thead>
          <tbody>
            ${rows.map(x=>`
              <tr class="border-t border-slate-100 dark:border-darkBorder">
                <td class="py-2 font-semibold">${x.summary||""}</td>
                <td class="py-2"><code>${x.type||""}</code></td>
                <td class="py-2">${x.severity||""}</td>
                <td class="py-2">${x.status||""}</td>
                <td class="py-2 text-right">
                  <button class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300" data-pick='${encodeURIComponent(JSON.stringify(x))}'>Edit</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    el("tbl").querySelectorAll("[data-pick]").forEach(b=>{
      b.onclick=()=>fill(JSON.parse(decodeURIComponent(b.getAttribute("data-pick"))));
    });
  }

  el("btnReload").onclick = load;
  el("btnFilter").onclick = load;
  el("btnNew").onclick = ()=>{ clear(); toast("Fill then Save","info"); };
  el("btnClear").onclick = clear;

  el("btnSave").onclick = async ()=>{
    const id = el("id").value.trim();
    const payload = {
      id: id || null,
      type: el("type").value.trim() || "general",
      severity: el("sev").value,
      status: el("st").value,
      summary: el("summary").value.trim(),
      details_json: el("details").value || "{}"
    };
    try{ JSON.parse(payload.details_json); }catch{ return toast("details_json invalid","error"); }
    if(!payload.summary) return toast("summary required","error");

    const r = id
      ? await api("/api/ops/incidents", { method:"PUT", body: JSON.stringify({ id, ...payload }) })
      : await api("/api/ops/incidents", { method:"POST", body: JSON.stringify(payload) });

    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ await load(); if(!id) clear(); }
  };

  async function doAction(action){
    const id = el("id").value.trim();
    if(!id) return toast("Pick incident first","error");
    const r = await api("/api/ops/incidents", { method:"PUT", body: JSON.stringify({ id, action }) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ await load(); }
  }

  el("btnAck").onclick = ()=>doAction("ack");
  el("btnClose").onclick = ()=>doAction("close");
  el("btnReopen").onclick = ()=>doAction("reopen");

  el("btnDel").onclick = async ()=>{
    const id = el("id").value.trim();
    if(!id) return toast("Pick incident first","error");
    if(!confirm("Delete incident? (super_admin only)")) return;
    const r = await api("/api/ops/incidents?id="+encodeURIComponent(id), { method:"DELETE" });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ clear(); await load(); }
  };

  clear();
  await load();
}
