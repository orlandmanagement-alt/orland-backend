function esc(s){return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");}

export default function BlogspotWidgets(ctx){
  const { api, toast, setBreadcrumb } = ctx;
  const el=document.createElement("div");
  el.innerHTML=`
    <div class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Widgets / Home</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Stored in D1 (cms_widgets)</p>
      </div>
      <div class="flex items-center gap-2">
        <button id="btnReload" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
        <button id="btnNew" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90"><i class="fa-solid fa-plus mr-1"></i>Upsert</button>
      </div>
    </div>
    <div id="table" class="mt-5"></div>
    <details class="mt-5"><summary class="text-xs text-slate-500 cursor-pointer">Debug</summary><pre id="out" class="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap"></pre></details>
  `;

  async function load(){
    const r=await api("/api/integrations/blogspot/widgets");
    el.querySelector("#out").textContent=JSON.stringify(r,null,2);
    if(r.status!=="ok"){ el.querySelector("#table").innerHTML=`<div class="text-xs text-slate-500">Failed: ${esc(r.status)}</div>`; return; }

    const rows=r.data?.rows||[];
    el.querySelector("#table").innerHTML=`
      <div class="overflow-x-auto bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">Key</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold">Updated</th>
              <th class="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(x=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3">
                  <div class="font-bold text-slate-900 dark:text-white">${esc(x.widget_key||"")}</div>
                  <div class="text-[11px] text-slate-500">id: <code>${esc(x.id||"")}</code></div>
                </td>
                <td class="px-4 py-3">${esc(x.status||"")}</td>
                <td class="px-4 py-3 text-slate-500">${esc(String(x.updated_at||""))}</td>
                <td class="px-4 py-3 text-right">
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-white/5 btnEdit" data-id="${esc(x.id)}">Edit JSON</button>
                  <button class="px-2 py-1 rounded border border-slate-200 dark:border-darkBorder text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-white/5 btnDel" data-id="${esc(x.id)}">Del</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    el.querySelectorAll(".btnEdit").forEach(b=>b.onclick=()=>edit(b.getAttribute("data-id")));
    el.querySelectorAll(".btnDel").forEach(b=>b.onclick=()=>del(b.getAttribute("data-id")));
  }

  async function upsert(){
    const widget_key=prompt("widget_key (e.g. home.hero):","home.hero")||"";
    if(!widget_key.trim()) return;

    const jsonStr=prompt("data_json (valid JSON):", '{"title":"Hello","items":[]}')||"{}";
    let data={};
    try{ data=JSON.parse(jsonStr); }catch{ return toast("Invalid JSON","error"); }

    const status=prompt("status (active/inactive):","active")||"active";
    const r=await api("/api/integrations/blogspot/widgets",{method:"POST",body:JSON.stringify({widget_key,data_json:data,status})});
    el.querySelector("#out").textContent=JSON.stringify(r,null,2);
    toast(r.status,r.status==="ok"?"success":"error");
    if(r.status==="ok") load();
  }

  async function edit(id){
    // fetch list then find
    const r=await api("/api/integrations/blogspot/widgets");
    if(r.status!=="ok") return toast("Load failed","error");
    const row=(r.data?.rows||[]).find(x=>x.id===id);
    if(!row) return toast("Not found","error");

    const jsonStr=prompt("Edit data_json (valid JSON):", row.data_json||"{}")||"{}";
    let data={};
    try{ data=JSON.parse(jsonStr); }catch{ return toast("Invalid JSON","error"); }

    const status=prompt("status (active/inactive):", row.status||"active")||"active";
    const rr=await api("/api/integrations/blogspot/widgets",{method:"POST",body:JSON.stringify({widget_key:row.widget_key,data_json:data,status})});
    el.querySelector("#out").textContent=JSON.stringify(rr,null,2);
    toast(rr.status,rr.status==="ok"?"success":"error");
    if(rr.status==="ok") load();
  }

  async function del(id){
    if(!confirm("Delete widget?")) return;
    const r=await api("/api/integrations/blogspot/widgets?id="+encodeURIComponent(id),{method:"DELETE"});
    el.querySelector("#out").textContent=JSON.stringify(r,null,2);
    toast(r.status,r.status==="ok"?"success":"error");
    if(r.status==="ok") load();
  }

  return {
    mount(host){
      setBreadcrumb("/ integrations / blogspot / widgets");
      host.innerHTML=""; host.appendChild(el);
      el.querySelector("#btnReload").onclick=load;
      el.querySelector("#btnNew").onclick=upsert;
      load();
    }
  };
}
