export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div>
        <div class="text-sm font-bold">Widgets / Home</div>
        <div class="text-xs text-slate-500">Konfigurasi widget home disimpan di D1 (config_json)</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input id="account_id" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="account_id">
          <button id="btnLoad" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Load</button>
          <button id="btnNew" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white hover:opacity-90">New Widget</button>
        </div>
        <div id="tbl" class="text-[12px] text-slate-500">—</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-3">
        <div class="text-xs font-bold">Edit / Create Widget</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input id="id" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="id (auto)" disabled>
          <input id="code" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="code (required)">
          <input id="title" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="title">
        </div>
        <textarea id="cfg" class="w-full h-44 text-[11px] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">{}</textarea>

        <div class="flex gap-2 flex-wrap">
          <button id="btnSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">Save</button>
          <button id="btnDel" class="text-xs px-3 py-2 rounded-lg bg-danger text-white hover:opacity-90">Delete</button>
          <button id="btnClear" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Clear</button>
        </div>

        <details><summary class="text-xs text-slate-500">Debug</summary><pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre></details>
      </div>
    </div>
  `;

  const el=(id)=>document.getElementById(id);
  const clear=()=>{ el("id").value=""; el("code").value=""; el("title").value=""; el("cfg").value="{}"; };
  const fill=(x)=>{ el("id").value=x.id||""; el("code").value=x.code||""; el("title").value=x.title||""; el("cfg").value=x.config_json||"{}"; };

  async function load(){
    const account_id = el("account_id").value.trim();
    const r = await api("/api/integrations/blogspot/widgets?account_id="+encodeURIComponent(account_id));
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }
    const rows=r.data.rows||[];
    el("tbl").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="text-slate-500"><tr><th class="text-left py-2">Code</th><th class="text-left py-2">Title</th><th class="text-right py-2">Action</th></tr></thead>
          <tbody>
            ${rows.map(x=>`
              <tr class="border-t border-slate-100 dark:border-darkBorder">
                <td class="py-2"><code>${x.code||""}</code></td>
                <td class="py-2 font-semibold">${x.title||""}</td>
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
      b.onclick = ()=>{
        const x = JSON.parse(decodeURIComponent(b.getAttribute("data-pick")));
        fill(x);
      };
    });
  }

  el("btnLoad").onclick = load;
  el("btnNew").onclick = ()=>{ clear(); toast("Fill code + config_json then Save","info"); };
  el("btnClear").onclick = clear;

  el("btnSave").onclick = async ()=>{
    const account_id = el("account_id").value.trim();
    if(!account_id) return toast("account_id required","error");
    const code = el("code").value.trim();
    if(!code) return toast("code required","error");
    const cfgRaw = el("cfg").value || "{}";
    try{ JSON.parse(cfgRaw); }catch{ return toast("config_json invalid","error"); }

    const payload = {
      id: el("id").value.trim() || null,
      account_id,
      code,
      title: el("title").value.trim(),
      config_json: cfgRaw
    };

    const r = await api("/api/integrations/blogspot/widgets", { method:"POST", body: JSON.stringify(payload) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ await load(); }
  };

  el("btnDel").onclick = async ()=>{
    const id = el("id").value.trim();
    if(!id) return toast("Pick row first","error");
    if(!confirm("Delete widget row?")) return;
    const r = await api("/api/integrations/blogspot/widgets?id="+encodeURIComponent(id), { method:"DELETE" });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ clear(); await load(); }
  };

  clear();
}
