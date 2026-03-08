export default function CmsWidgets(Orland){
  return {
    title: "Blogspot • Widgets / Home",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-sm font-bold">Widgets</div>
              <div class="text-xs text-slate-500">Konfigurasi widget disimpan di D1 (cms_widgets). Key contoh: home, hero, footer.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnNew" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white">New</button>
              <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">Reload</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <div class="lg:col-span-1">
              <div id="list" class="space-y-2"></div>
            </div>
            <div class="lg:col-span-2">
              <div class="border border-slate-200 dark:border-darkBorder rounded-xl p-4">
                <input id="id" hidden>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Widget Key</label>
                    <input id="widget_key" class="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder">
                  </div>
                  <div>
                    <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Status</label>
                    <select id="status" class="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder">
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                    </select>
                  </div>
                  <div class="md:col-span-2">
                    <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Data JSON</label>
                    <textarea id="data" rows="10" class="w-full mt-2 px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder"
                      placeholder='{"hero_title":"...","cta_text":"..."}'></textarea>
                  </div>
                </div>
                <div class="flex gap-2 mt-3">
                  <button id="btnSave" class="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white">Save</button>
                </div>
                <details class="mt-3">
                  <summary class="text-xs text-slate-500">Debug</summary>
                  <pre id="out" class="text-[11px] whitespace-pre-wrap text-slate-500 mt-2"></pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      `;

      const out = host.querySelector("#out");
      const list = host.querySelector("#list");

      const load = async ()=>{
        const r = await Orland.api("/api/cms/widgets");
        out.textContent = JSON.stringify(r,null,2);
        if(r.status!=="ok"){ list.innerHTML = `<div class="text-xs text-slate-500">Failed: ${r.status}</div>`; return; }
        const items = r.data.widgets || [];
        list.innerHTML = items.map(x=>`
          <button class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5"
            data-id="${x.id}">
            <div class="text-xs font-bold">${Orland.esc(x.widget_key)}</div>
            <div class="text-[11px] text-slate-500">${Orland.esc(x.status)}</div>
          </button>
        `).join("");

        list.querySelectorAll("button[data-id]").forEach(b=>{
          b.onclick = ()=>{
            const id = b.getAttribute("data-id");
            const it = items.find(z=>z.id===id);
            host.querySelector("#id").value = it.id;
            host.querySelector("#widget_key").value = it.widget_key || "";
            host.querySelector("#status").value = it.status || "active";
            host.querySelector("#data").value = JSON.stringify(it.data || {}, null, 2);
          };
        });
      };

      host.querySelector("#btnReload").onclick = load;
      host.querySelector("#btnNew").onclick = ()=>{
        host.querySelector("#id").value = "";
        host.querySelector("#widget_key").value = "home";
        host.querySelector("#status").value = "active";
        host.querySelector("#data").value = JSON.stringify({ hero_title:"Orland Management", hero_subtitle:"Enterprise Portal" }, null, 2);
      };

      host.querySelector("#btnSave").onclick = async ()=>{
        let data = {};
        try{ data = JSON.parse(host.querySelector("#data").value || "{}"); }catch{ return Orland.toast("Data JSON invalid","error"); }
        const widget_key = (host.querySelector("#widget_key").value||"").trim();
        const status = host.querySelector("#status").value;
        const rr = await Orland.api("/api/cms/widgets", {
          method:"POST",
          body: JSON.stringify({ widget_key, status, data })
        });
        out.textContent = JSON.stringify(rr,null,2);
        Orland.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") await load();
      };

      await load();
    }
  };
}
