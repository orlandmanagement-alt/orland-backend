export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-bold">Menu Builder</div>
          <div class="text-xs text-slate-500 mt-1">CRUD menus table</div>
        </div>
        <div class="flex gap-2">
          <button id="mnReload" class="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input id="mnId" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2 md:col-span-2" placeholder="id (optional)"/>
        <input id="mnCode" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="code"/>
        <input id="mnLabel" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="label"/>
        <input id="mnPath" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="/path"/>
        <input id="mnParent" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="parent_id"/>
      </div>

      <div class="mt-2 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input id="mnSort" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="sort_order" value="50"/>
        <input id="mnIcon" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2 md:col-span-3" placeholder="icon class (fa-solid fa-...)"/>
        <button id="mnSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600 md:col-span-2">Upsert</button>
      </div>

      <div id="mnTable" class="mt-4 overflow-x-auto"></div>
    </div>
  `;

  async function load(){
    const r = await api("/api/menus");
    if(r.status!=="ok"){ toast("menus failed: "+r.status,"error"); return; }
    const rows = r.data.menus || [];
    document.getElementById("mnTable").innerHTML = `
      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
          <tr>
            <th class="px-4 py-3 font-semibold">label</th>
            <th class="px-4 py-3 font-semibold">code</th>
            <th class="px-4 py-3 font-semibold">path</th>
            <th class="px-4 py-3 font-semibold">parent</th>
            <th class="px-4 py-3 font-semibold">sort</th>
            <th class="px-4 py-3 font-semibold">icon</th>
            <th class="px-4 py-3 font-semibold text-right">action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
          ${rows.map(m=>`
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
              <td class="px-4 py-3 font-bold">${esc(m.label||"")}</td>
              <td class="px-4 py-3 text-slate-500">${esc(m.code||"")}</td>
              <td class="px-4 py-3 text-slate-500">${esc(m.path||"")}</td>
              <td class="px-4 py-3 text-slate-500"><code>${esc(m.parent_id||"")}</code></td>
              <td class="px-4 py-3">${esc(String(m.sort_order||""))}</td>
              <td class="px-4 py-3">${m.icon?`<i class="${esc(m.icon)}"></i> <span class="text-slate-500">${esc(m.icon)}</span>`:"-"}</td>
              <td class="px-4 py-3 text-right">
                <button data-fill='${esc(JSON.stringify(m))}' class="text-xs px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Fill</button>
                <button data-del="${esc(m.id)}" class="text-xs px-2 py-1 rounded border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Del</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    document.querySelectorAll("[data-fill]").forEach(b=>{
      b.onclick = ()=>{
        const obj = JSON.parse(b.getAttribute("data-fill")||"{}");
        set("mnId", obj.id||"");
        set("mnCode", obj.code||"");
        set("mnLabel", obj.label||"");
        set("mnPath", obj.path||"");
        set("mnParent", obj.parent_id||"");
        set("mnSort", String(obj.sort_order??50));
        set("mnIcon", obj.icon||"");
        toast("form filled","info");
      };
    });

    document.querySelectorAll("[data-del]").forEach(b=>{
      b.onclick = async ()=>{
        const id = b.getAttribute("data-del");
        if(!confirm("Delete menu?")) return;
        const rr = await api("/api/menus?id="+encodeURIComponent(id), { method:"DELETE" });
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") load();
      };
    });
  }

  document.getElementById("mnReload").onclick = load;
  document.getElementById("mnSave").onclick = async ()=>{
    const payload = {
      id: val("mnId") || null,
      code: val("mnCode"),
      label: val("mnLabel"),
      path: val("mnPath"),
      parent_id: val("mnParent") || null,
      sort_order: Number(val("mnSort")||"50"),
      icon: val("mnIcon") || null,
    };
    if(!payload.code || !payload.label || !payload.path) return toast("code/label/path required","error");
    const rr = await api("/api/menus", { method:"POST", body: JSON.stringify(payload) });
    toast(rr.status, rr.status==="ok"?"success":"error");
    if(rr.status==="ok"){ set("mnId",""); load(); }
  };

  await load();
}
function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
function val(id){ return (document.getElementById(id).value||"").trim(); }
function set(id,v){ document.getElementById(id).value = v; }
