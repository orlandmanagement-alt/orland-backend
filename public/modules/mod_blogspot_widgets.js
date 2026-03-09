function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

export default function BlogspotWidgets(Orland){
  async function list(){ return await Orland.api("/api/integrations/blogspot/widgets"); }
  async function save(payload){ return await Orland.api("/api/integrations/blogspot/widgets",{ method:"POST", body: JSON.stringify(payload) }); }
  async function del(id){ return await Orland.api("/api/integrations/blogspot/widgets?id="+encodeURIComponent(id),{ method:"DELETE" }); }

  return {
    title:"Widgets / Home",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="text-sm font-extrabold">Widgets / Home</div>
              <div class="text-xs opacity-70">Widget config disimpan di D1 <code>cms_widgets</code>.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnNew" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">+ New</button>
              <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <div>
              <div class="text-xs font-bold mb-2">Widgets</div>
              <div id="list" class="rounded-xl border border-slate-200 dark:border-darkBorder overflow-hidden"></div>
            </div>

            <div class="lg:col-span-2">
              <div class="text-xs font-bold mb-2">Editor</div>
              <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
                <input id="id" class="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="id (auto)">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
                  <input id="key" class="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="widget_key (e.g. home)">
                  <select id="status" class="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                </div>
                <textarea id="json" class="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" style="min-height:220px" placeholder='{"hero_title":"..."}'></textarea>

                <div class="flex gap-2 mt-3">
                  <button id="btnSave" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">Save</button>
                  <button id="btnDelete" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Delete</button>
                </div>

                <details class="mt-3">
                  <summary class="text-xs opacity-70 cursor-pointer">Debug</summary>
                  <pre id="dbg" class="text-[11px] opacity-70 mt-2 whitespace-pre-wrap"></pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      `;

      const $=(id)=>host.querySelector(id);
      const dbg=$("#dbg");
      let items=[];

      function pick(it){
        $("#id").value = it.id||"";
        $("#key").value = it.widget_key||"";
        $("#status").value = it.status||"active";
        try{ $("#json").value = JSON.stringify(JSON.parse(it.data_json||"{}"), null, 2); }
        catch{ $("#json").value = it.data_json || "{}"; }
      }

      function render(){
        const box=$("#list");
        box.innerHTML = items.map(it=>`
          <button class="w-full text-left px-3 py-2 border-b border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-id="${esc(it.id)}">
            <div class="text-xs font-bold truncate">${esc(it.widget_key)}</div>
            <div class="text-[11px] opacity-70 truncate">${esc(it.status)}</div>
          </button>
        `).join("") || `<div class="px-3 py-3 text-xs opacity-70">No widgets.</div>`;

        box.querySelectorAll("button[data-id]").forEach(b=>{
          b.onclick=()=>{
            const it=items.find(x=>x.id===b.getAttribute("data-id"));
            if(it) pick(it);
          };
        });
      }

      async function reload(){
        const r = await list();
        dbg.textContent = JSON.stringify(r,null,2);
        if(r.status!=="ok") return Orland.toast?.("Load failed: "+r.status,"error");
        items = r.data.widgets||[];
        render();
        if(items[0] && !$("#id").value) pick(items[0]);
      }

      $("#btnReload").onclick=reload;
      $("#btnNew").onclick=()=>{
        $("#id").value="";
        $("#key").value="";
        $("#status").value="active";
        $("#json").value="{}";
      };

      $("#btnSave").onclick=async ()=>{
        let j=$("#json").value||"{}";
        try{ j = JSON.stringify(JSON.parse(j), null, 0); }catch{}
        const payload={
          id: $("#id").value.trim() || undefined,
          widget_key: $("#key").value.trim(),
          status: $("#status").value,
          data_json: j
        };
        const r = await save(payload);
        dbg.textContent = JSON.stringify(r,null,2);
        if(r.status==="ok"){ Orland.toast?.("Saved","success"); await reload(); }
        else Orland.toast?.("Save failed: "+r.status,"error");
      };

      $("#btnDelete").onclick=async ()=>{
        const id=$("#id").value.trim();
        if(!id) return Orland.toast?.("Pick a widget first","error");
        if(!confirm("Delete this widget?")) return;
        const r=await del(id);
        dbg.textContent = JSON.stringify(r,null,2);
        if(r.status==="ok"){ Orland.toast?.("Deleted","success"); $("#btnNew").click(); await reload(); }
        else Orland.toast?.("Delete failed: "+r.status,"error");
      };

      await reload();
    }
  };
}
