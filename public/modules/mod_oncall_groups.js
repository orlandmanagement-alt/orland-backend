import placeholder from "./mod_placeholder.js";

export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const apiBase = "/api/oncall/groups";
  const pk = "id";
  const cols = ["name","rotation","timezone","week_start"];
  const title = "Oncall Groups";

  async function list(q="", limit=50){
    const qs = new URLSearchParams();
    if(q) qs.set("q", q);
    qs.set("limit", String(limit));
    return await Orland.api(apiBase + "?" + qs.toString());
  }
  async function upsert(payload){
    return await Orland.api(apiBase, { method:"POST", body: JSON.stringify(payload) });
  }
  async function del(id){
    return await Orland.api(apiBase + "?" + encodeURIComponent(pk) + "=" + encodeURIComponent(id), { method:"DELETE" });
  }

  return {
    title,
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="text-sm font-bold">${esc(title)}</div>
              <div class="text-xs opacity-70">CRUD module generator template</div>
            </div>
            <div class="flex gap-2">
              <input id="q" class="px-3 py-2 text-xs rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="search...">
              <button id="btnReload" class="px-3 py-2 text-xs rounded-lg bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-darkBorder">Reload</button>
              <button id="btnNew" class="px-3 py-2 text-xs rounded-lg bg-primary text-white">New</button>
            </div>
          </div>

          <div id="formBox" class="hidden mt-3 border border-slate-200 dark:border-darkBorder rounded-xl p-3">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <div class="text-[11px] opacity-70">ID (${esc(pk)})</div>
                <input id="f_id" class="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="leave empty to auto-id">
              </div>
              ${cols.map(c=>`
              <div>
                <div class="text-[11px] opacity-70">${esc(c)}</div>
                <input data-col="${esc(c)}" class="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>`).join("")}
            </div>
            <div class="flex gap-2 mt-3">
              <button id="btnSave" class="px-3 py-2 text-xs rounded-lg bg-primary text-white">Save</button>
              <button id="btnCancel" class="px-3 py-2 text-xs rounded-lg bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-darkBorder">Cancel</button>
            </div>
            <pre id="dbg" class="mt-3 text-[11px] opacity-70 whitespace-pre-wrap"></pre>
          </div>

          <div id="tableBox" class="mt-4 overflow-x-auto"></div>
        </div>
      `;

      const qEl = host.querySelector("#q");
      const box = host.querySelector("#tableBox");
      const formBox = host.querySelector("#formBox");
      const dbg = host.querySelector("#dbg");

      function openForm(row){
        formBox.classList.remove("hidden");
        host.querySelector("#f_id").value = row?.[pk] || "";
        host.querySelectorAll("[data-col]").forEach(inp=>{
          const k = inp.getAttribute("data-col");
          inp.value = (row && row[k] != null) ? String(row[k]) : "";
        });
      }
      function closeForm(){ formBox.classList.add("hidden"); dbg.textContent=""; }

      async function render(){
        const r = await list((qEl.value||"").trim(), 80);
        if(r.status!=="ok"){
          // never blank
          return placeholder(Orland,{ title, message:r.status }).mount(box);
        }
        const rows = r.data?.rows || [];
        box.innerHTML = `
          <table class="w-full text-xs">
            <thead class="text-left opacity-70">
              <tr>
                <th class="py-2 pr-3">${esc(pk)}</th>
                ${cols.map(c=>`<th class="py-2 pr-3">${esc(c)}</th>`).join("")}
                <th class="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(x=>`
                <tr class="border-t border-slate-200 dark:border-darkBorder">
                  <td class="py-2 pr-3"><code>${esc(x[pk])}</code></td>
                  ${cols.map(c=>`<td class="py-2 pr-3">${esc(x[c] ?? "")}</td>`).join("")}
                  <td class="py-2 pr-3">
                    <button class="btnEdit px-2 py-1 rounded-lg bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-darkBorder" data-id="${esc(x[pk])}">Edit</button>
                    <button class="btnDel px-2 py-1 rounded-lg bg-danger text-white" data-id="${esc(x[pk])}">Del</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;

        box.querySelectorAll(".btnEdit").forEach(b=>{
          b.addEventListener("click", ()=>{
            const id=b.getAttribute("data-id");
            const row=rows.find(r=>String(r[pk])===String(id));
            openForm(row);
          });
        });

        box.querySelectorAll(".btnDel").forEach(b=>{
          b.addEventListener("click", async ()=>{
            const id=b.getAttribute("data-id");
            if(!confirm("Delete "+id+" ? (super_admin only)")) return;
            const rr = await del(id);
            dbg.textContent = JSON.stringify(rr,null,2);
            await render();
          });
        });
      }

      host.querySelector("#btnReload")?.addEventListener("click", render);
      host.querySelector("#btnNew")?.addEventListener("click", ()=>openForm(null));
      host.querySelector("#btnCancel")?.addEventListener("click", closeForm);

      host.querySelector("#btnSave")?.addEventListener("click", async ()=>{
        const payload = {};
        const id = (host.querySelector("#f_id").value||"").trim();
        if(id) payload[pk]=id;
        host.querySelectorAll("[data-col]").forEach(inp=>{
          const k = inp.getAttribute("data-col");
          payload[k] = (inp.value||"").trim();
        });
        const rr = await upsert(payload);
        dbg.textContent = JSON.stringify(rr,null,2);
        if(rr.status==="ok"){ closeForm(); await render(); }
      });

      qEl?.addEventListener("keydown",(e)=>{ if(e.key==="Enter") render(); });

      await render();
    }
  };
}
