export default function IncidentsModule(ctx){
  const { api, toast, setBreadcrumb } = ctx;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Incidents & Alerts</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Create / ack / close incidents</p>
      </div>
      <div class="flex items-center gap-2">
        <select id="status" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs">
          <option value="">all</option>
          <option value="open">open</option>
          <option value="ack">ack</option>
          <option value="closed">closed</option>
        </select>
        <input id="q" placeholder="search..." class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-xs w-56">
        <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
        <button id="btnCreate" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90"><i class="fa-solid fa-plus mr-1"></i>Create</button>
      </div>
    </div>

    <div id="table" class="mt-5"></div>

    <details class="mt-5">
      <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
      <pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre>
    </details>
  `;

  async function load(){
    const q = el.querySelector("#q").value.trim();
    const st = el.querySelector("#status").value.trim();
    const url = "/api/incidents?limit=100" + (q ? "&q="+encodeURIComponent(q) : "") + (st ? "&status="+encodeURIComponent(st) : "");
    const r = await api(url);
    el.querySelector("#out").textContent = JSON.stringify(r,null,2);

    if(r.status !== "ok"){
      el.querySelector("#table").innerHTML = `<div class="text-xs text-slate-500">Failed: ${r.status}</div>`;
      return;
    }

    const rows = r.data?.rows || [];
    el.querySelector("#table").innerHTML = `
      <div class="overflow-x-auto bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">Severity</th>
              <th class="px-4 py-3 font-semibold">Type</th>
              <th class="px-4 py-3 font-semibold">Summary</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold">Updated</th>
              <th class="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(x=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3 font-bold">${x.severity||""}</td>
                <td class="px-4 py-3">${x.type||""}</td>
                <td class="px-4 py-3">
                  <div class="font-semibold text-slate-900 dark:text-white">${(x.summary||"")}</div>
                  <div class="text-[11px] text-slate-500">id: <code>${x.id}</code></div>
                </td>
                <td class="px-4 py-3">${x.status||""}</td>
                <td class="px-4 py-3 text-slate-500">${x.updated_at||""}</td>
                <td class="px-4 py-3 text-right">
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-white/5 btnAck" data-id="${x.id}">Ack</button>
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-white/5 btnClose" data-id="${x.id}">Close</button>
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-white/5 btnReopen" data-id="${x.id}">Reopen</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    el.querySelectorAll(".btnAck").forEach(b=>b.onclick = async ()=>{
      const id = b.getAttribute("data-id");
      const rr = await api("/api/incidents", { method:"PUT", body: JSON.stringify({ id, action:"ack" }) });
      el.querySelector("#out").textContent = JSON.stringify(rr,null,2);
      toast(rr.status, rr.status==="ok"?"success":"error");
      if(rr.status==="ok") load();
    });
    el.querySelectorAll(".btnClose").forEach(b=>b.onclick = async ()=>{
      const id = b.getAttribute("data-id");
      const rr = await api("/api/incidents", { method:"PUT", body: JSON.stringify({ id, action:"close" }) });
      el.querySelector("#out").textContent = JSON.stringify(rr,null,2);
      toast(rr.status, rr.status==="ok"?"success":"error");
      if(rr.status==="ok") load();
    });
    el.querySelectorAll(".btnReopen").forEach(b=>b.onclick = async ()=>{
      const id = b.getAttribute("data-id");
      const rr = await api("/api/incidents", { method:"PUT", body: JSON.stringify({ id, action:"reopen" }) });
      el.querySelector("#out").textContent = JSON.stringify(rr,null,2);
      toast(rr.status, rr.status==="ok"?"success":"error");
      if(rr.status==="ok") load();
    });
  }

  async function create(){
    const summary = prompt("Summary (required):","") || "";
    if(!summary.trim()) return;

    const severity = prompt("Severity (low/medium/high/critical):","medium") || "medium";
    const type = prompt("Type:","general") || "general";

    const rr = await api("/api/incidents", { method:"POST", body: JSON.stringify({ summary, severity, type }) });
    el.querySelector("#out").textContent = JSON.stringify(rr,null,2);
    toast(rr.status, rr.status==="ok"?"success":"error");
    if(rr.status==="ok") load();
  }

  return {
    mount(host){
      setBreadcrumb("/ ops / incidents");
      host.innerHTML="";
      host.appendChild(el);

      el.querySelector("#btnReload").onclick = load;
      el.querySelector("#btnCreate").onclick = create;
      el.querySelector("#q").addEventListener("keydown",(e)=>{ if(e.key==="Enter") load(); });
      el.querySelector("#status").onchange = load;

      load();
    }
  };
}
