export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  async function load(){ return await Orland.api("/api/blogspot/widgets"); }
  async function save(payload){
    return await Orland.api("/api/blogspot/widgets", { method:"POST", body: JSON.stringify(payload) });
  }

  return {
    title:"Blogspot Widgets / Home",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-6xl">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div class="text-xl font-extrabold text-slate-900 dark:text-white">Blogspot Widgets / Home</div>
              <div class="text-sm text-slate-500">Custom HTML widgets dan home blocks berbasis div.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder">Reload</button>
              <button id="btnNewWidget" class="px-3 py-2 rounded-xl text-xs font-black bg-primary text-white">New Widget</button>
              <button id="btnNewBlock" class="px-3 py-2 rounded-xl text-xs font-black border border-emerald-200 text-emerald-700">New Home Block</button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-sm font-extrabold">Widget Editor</div>
              <div class="space-y-3 mt-4">
                <input id="wid_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 text-sm" placeholder="id (auto create if empty)">
                <input id="wid_key" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm" placeholder="widget key">
                <input id="wid_title" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm" placeholder="title">
                <input id="wid_section" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm" placeholder="section">
                <textarea id="wid_html" rows="10" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm font-mono" placeholder="<div class='hero'>Custom HTML</div>"></textarea>
                <div class="flex gap-2 flex-wrap">
                  <button id="btnSaveWidget" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save Widget</button>
                  <button id="btnDeleteWidget" class="px-4 py-2.5 rounded-2xl border border-red-200 text-red-600 font-black text-sm">Delete</button>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-sm font-extrabold">Home Block Editor</div>
              <div class="space-y-3 mt-4">
                <input id="blk_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 text-sm" placeholder="id (auto create if empty)">
                <input id="blk_section" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm" placeholder="section">
                <input id="blk_title" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm" placeholder="title">
                <input id="blk_sort" type="number" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm" placeholder="sort order">
                <textarea id="blk_html" rows="10" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm font-mono" placeholder="<div class='home-block'>HTML block</div>"></textarea>
                <div class="flex gap-2 flex-wrap">
                  <button id="btnSaveBlock" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save Block</button>
                  <button id="btnDeleteBlock" class="px-4 py-2.5 rounded-2xl border border-red-200 text-red-600 font-black text-sm">Delete</button>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-sm font-extrabold">Widgets</div>
              <div id="widgetsBox" class="space-y-3 mt-4"></div>
            </div>
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-sm font-extrabold">Home Blocks</div>
              <div id="blocksBox" class="space-y-3 mt-4"></div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);

      function fillWidget(x = {}){
        const d = x.data_json || {};
        q("wid_id").value = x.id || "";
        q("wid_key").value = x.widget_key || "";
        q("wid_title").value = d.title || "";
        q("wid_section").value = d.section || "";
        q("wid_html").value = d.html || "";
      }

      function fillBlock(x = {}){
        const d = x.payload_json || {};
        q("blk_id").value = x.id || "";
        q("blk_section").value = x.section || "";
        q("blk_title").value = x.title || "";
        q("blk_sort").value = x.sort_order || 0;
        q("blk_html").value = d.html || "";
      }

      async function render(){
        const r = await load();
        if(r.status !== "ok"){
          q("widgetsBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r,null,2))}</pre>`;
          q("blocksBox").innerHTML = "";
          return;
        }

        const widgets = r.data?.items || [];
        const blocks = r.data?.home_blocks || [];

        q("widgetsBox").innerHTML = widgets.length ? widgets.map(x => {
          const d = x.data_json || {};
          return `
            <button class="w-full text-left rounded-2xl border border-slate-200 dark:border-darkBorder p-4 hover:bg-slate-50 dark:hover:bg-white/5 itemWidget" data-id="${esc(x.id)}">
              <div class="text-sm font-extrabold">${esc(d.title || x.widget_key || "Widget")}</div>
              <div class="text-[11px] text-slate-500 mt-1">${esc(x.widget_key || "")} • ${esc(d.section || "")}</div>
            </button>
          `;
        }).join("") : `<div class="text-xs text-slate-500">No widgets.</div>`;

        q("blocksBox").innerHTML = blocks.length ? blocks.map(x => `
          <button class="w-full text-left rounded-2xl border border-slate-200 dark:border-darkBorder p-4 hover:bg-slate-50 dark:hover:bg-white/5 itemBlock" data-id="${esc(x.id)}">
            <div class="text-sm font-extrabold">${esc(x.title || "Block")}</div>
            <div class="text-[11px] text-slate-500 mt-1">${esc(x.section || "")} • sort ${esc(x.sort_order || 0)}</div>
          </button>
        `).join("") : `<div class="text-xs text-slate-500">No home blocks.</div>`;

        q("widgetsBox").querySelectorAll(".itemWidget").forEach(btn => {
          btn.onclick = ()=>{
            const row = widgets.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(row) fillWidget(row);
          };
        });

        q("blocksBox").querySelectorAll(".itemBlock").forEach(btn => {
          btn.onclick = ()=>{
            const row = blocks.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(row) fillBlock(row);
          };
        });
      }

      q("btnReload").onclick = render;
      q("btnNewWidget").onclick = ()=>fillWidget({});
      q("btnNewBlock").onclick = ()=>fillBlock({});

      q("btnSaveWidget").onclick = async ()=>{
        const payload = {
          action: q("wid_id").value.trim() ? "update" : "create",
          id: q("wid_id").value.trim(),
          widget_key: q("wid_key").value.trim(),
          title: q("wid_title").value.trim(),
          section: q("wid_section").value.trim(),
          html: q("wid_html").value
        };
        const r = await save(payload);
        q("msg").className = "text-sm " + (r.status === "ok" ? "text-emerald-600" : "text-red-500");
        q("msg").textContent = r.status === "ok" ? "Widget saved." : ("Save failed: " + r.status);
        if(r.status === "ok") await render();
      };

      q("btnDeleteWidget").onclick = async ()=>{
        const id = q("wid_id").value.trim();
        if(!id) return;
        const r = await save({ action:"delete", id });
        q("msg").className = "text-sm " + (r.status === "ok" ? "text-emerald-600" : "text-red-500");
        q("msg").textContent = r.status === "ok" ? "Widget deleted." : ("Delete failed: " + r.status);
        if(r.status === "ok"){ fillWidget({}); await render(); }
      };

      q("btnSaveBlock").onclick = async ()=>{
        const payload = {
          action: "home_upsert",
          id: q("blk_id").value.trim(),
          section: q("blk_section").value.trim(),
          title: q("blk_title").value.trim(),
          sort_order: Number(q("blk_sort").value || 0),
          html: q("blk_html").value
        };
        const r = await save(payload);
        q("msg").className = "text-sm " + (r.status === "ok" ? "text-emerald-600" : "text-red-500");
        q("msg").textContent = r.status === "ok" ? "Home block saved." : ("Save failed: " + r.status);
        if(r.status === "ok") await render();
      };

      q("btnDeleteBlock").onclick = async ()=>{
        const id = q("blk_id").value.trim();
        if(!id) return;
        const r = await save({ action:"home_delete", id });
        q("msg").className = "text-sm " + (r.status === "ok" ? "text-emerald-600" : "text-red-500");
        q("msg").textContent = r.status === "ok" ? "Home block deleted." : ("Delete failed: " + r.status);
        if(r.status === "ok"){ fillBlock({}); await render(); }
      };

      await render();
    }
  };
}
