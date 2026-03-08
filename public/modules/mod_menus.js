export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  function toast(msg, type="info"){
    const host = document.getElementById("toast-host");
    if(!host){ alert(msg); return; }
    const div = document.createElement("div");
    div.className = "fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    div.innerHTML = `<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(div);
    setTimeout(()=>div.remove(), 2800);
  }

  async function load(){
    return await Orland.api("/api/menus");
  }

  return {
    title: "Menu Builder",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-base font-bold">Menu Builder</div>
              <div class="text-xs text-slate-500 mt-1">Edit menu + icon (FontAwesome class).</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
              <button id="btnSeed" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
                <i class="fa-solid fa-wand-magic-sparkles mr-2"></i>Seed
              </button>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div class="lg:col-span-2">
              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs whitespace-nowrap">
                  <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                    <tr>
                      <th class="py-3 pr-3">Label</th>
                      <th class="py-3 pr-3">Path</th>
                      <th class="py-3 pr-3">Parent</th>
                      <th class="py-3 pr-3">Sort</th>
                      <th class="py-3 pr-3">Icon</th>
                      <th class="py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
                </table>
              </div>
            </div>

            <div>
              <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-sm font-bold">Upsert Menu</div>
                <div class="text-xs text-slate-500 mt-1">Klik “Fill” untuk edit, kosongkan ID untuk create.</div>

                <div class="mt-3 grid grid-cols-1 gap-3">
                  <div>
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">id</div>
                    <input id="id" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="(auto if blank)">
                  </div>
                  <div>
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">code</div>
                    <input id="code" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="users_admin">
                  </div>
                  <div>
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">label</div>
                    <input id="label" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="Admin Users">
                  </div>
                  <div>
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">path</div>
                    <input id="path" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="/users/admin">
                  </div>
                  <div>
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">parent_id</div>
                    <input id="parent_id" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="m_core_users">
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">sort_order</div>
                      <input id="sort_order" type="number" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" value="50">
                    </div>
                    <div>
                      <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">icon</div>
                      <input id="icon" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="fa-solid fa-star">
                    </div>
                  </div>

                  <button id="btnUpsert" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 w-full">
                    Save
                  </button>
                  <button id="btnClear" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 w-full">
                    Clear Form
                  </button>
                </div>
              </div>
            </div>
          </div>

          <pre id="debug" class="hidden mt-4 text-[10px] bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-darkBorder rounded-xl p-3 overflow-auto"></pre>
        </div>
      `;

      const tb = host.querySelector("#tb");
      const f = {
        id: host.querySelector("#id"),
        code: host.querySelector("#code"),
        label: host.querySelector("#label"),
        path: host.querySelector("#path"),
        parent_id: host.querySelector("#parent_id"),
        sort_order: host.querySelector("#sort_order"),
        icon: host.querySelector("#icon"),
      };

      function clearForm(){
        f.id.value=""; f.code.value=""; f.label.value=""; f.path.value="";
        f.parent_id.value=""; f.sort_order.value="50"; f.icon.value="";
      }

      async function render(){
        tb.innerHTML = `<tr><td class="py-4 text-slate-500" colspan="6">Loading…</td></tr>`;
        const r = await load();
        if(r.status !== "ok"){
          tb.innerHTML = `<tr><td class="py-4 text-red-400" colspan="6">Failed: ${esc(r.status)}</td></tr>`;
          return;
        }
        const rows = r.data?.menus || [];
        if(!rows.length){
          tb.innerHTML = `<tr><td class="py-4 text-slate-500" colspan="6">No menus</td></tr>`;
          return;
        }
        tb.innerHTML = rows.map(m=>`
          <tr>
            <td class="py-3 pr-3">
              <div class="font-bold text-slate-900 dark:text-white">${esc(m.label||"")}</div>
              <div class="text-[10px] text-slate-500">${esc(m.code||"")}</div>
              <div class="text-[10px] text-slate-500">id: <code>${esc(m.id||"")}</code></div>
            </td>
            <td class="py-3 pr-3 text-slate-500"><code>${esc(m.path||"")}</code></td>
            <td class="py-3 pr-3 text-slate-500"><code>${esc(m.parent_id||"-")}</code></td>
            <td class="py-3 pr-3">${esc(String(m.sort_order??""))}</td>
            <td class="py-3 pr-3">
              ${m.icon ? `<i class="${esc(m.icon)}"></i> <span class="text-slate-500">${esc(m.icon)}</span>` : `<span class="text-slate-500">-</span>`}
            </td>
            <td class="py-3 text-right">
              <div class="flex justify-end gap-2 flex-wrap">
                <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-fill='${esc(JSON.stringify(m))}'>Fill</button>
                <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-danger" data-del="${esc(m.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `).join("");

        tb.querySelectorAll("button[data-fill]").forEach(btn=>{
          btn.addEventListener("click", ()=>{
            const obj = JSON.parse(btn.getAttribute("data-fill")||"{}");
            f.id.value = obj.id||"";
            f.code.value = obj.code||"";
            f.label.value = obj.label||"";
            f.path.value = obj.path||"";
            f.parent_id.value = obj.parent_id||"";
            f.sort_order.value = String(obj.sort_order ?? 50);
            f.icon.value = obj.icon||"";
            toast("Form filled", "info");
          });
        });

        tb.querySelectorAll("button[data-del]").forEach(btn=>{
          btn.addEventListener("click", async ()=>{
            const id = btn.getAttribute("data-del");
            if(!id) return;
            if(!confirm("Delete menu?")) return;
            const rr = await Orland.api("/api/menus?id="+encodeURIComponent(id), { method:"DELETE" });
            toast(rr.status, rr.status==="ok"?"success":"error");
            if(rr.status==="ok") await render();
          });
        });
      }

      host.querySelector("#btnUpsert")?.addEventListener("click", async ()=>{
        const payload = {
          id: String(f.id.value||"").trim() || null,
          code: String(f.code.value||"").trim(),
          label: String(f.label.value||"").trim(),
          path: String(f.path.value||"").trim(),
          parent_id: String(f.parent_id.value||"").trim() || null,
          sort_order: Number(String(f.sort_order.value||"50")),
          icon: String(f.icon.value||"").trim() || null,
        };
        if(!payload.code || !payload.label || !payload.path){
          toast("code/label/path required", "error");
          return;
        }
        const rr = await Orland.api("/api/menus", { method:"POST", body: JSON.stringify(payload) });
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok"){ clearForm(); await render(); }
      });

      host.querySelector("#btnClear")?.addEventListener("click", clearForm);
      host.querySelector("#btnReload")?.addEventListener("click", render);

      host.querySelector("#btnSeed")?.addEventListener("click", async ()=>{
        const rr = await Orland.api("/api/menus/seed", { method:"POST", body:"{}" });
        toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") await render();
      });

      await render();
    }
  };
}
