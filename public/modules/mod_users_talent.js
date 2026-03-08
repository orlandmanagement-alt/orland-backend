export default function(Orland){
  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  let cursor=null;
  const state = { loc:"", gender:"", age_min:"", age_max:"", h_min:"", h_max:"", cat:"", score_min:"", progress_min:"", limit:50 };

  function buildQS(){
    const p = new URLSearchParams();
    p.set("limit", String(state.limit||50));
    if(state.loc) p.set("loc", state.loc);
    if(state.gender) p.set("gender", state.gender);
    if(state.age_min) p.set("age_min", state.age_min);
    if(state.age_max) p.set("age_max", state.age_max);
    if(state.h_min) p.set("h_min", state.h_min);
    if(state.h_max) p.set("h_max", state.h_max);
    if(state.cat) p.set("cat", state.cat);
    if(state.score_min) p.set("score_min", state.score_min);
    if(state.progress_min) p.set("progress_min", state.progress_min);
    if(cursor) p.set("cursor", cursor);
    return p.toString();
  }

  async function load(host, reset=false){
    if(reset) cursor=null;

    const box = host.querySelector("#rows");
    box.innerHTML = `<div class="text-xs text-slate-500">Loading…</div>`;

    const r = await Orland.api("/api/users/talent?"+buildQS());
    if(r.status!=="ok"){
      box.innerHTML = `<div class="text-xs text-red-400">Failed: ${esc(r.status)}</div>`;
      return;
    }

    const rows = r.data.rows||[];
    cursor = r.data.next_cursor||null;

    box.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
            <tr>
              <th class="px-4 py-3 font-semibold">Talent</th>
              <th class="px-4 py-3 font-semibold">Gender</th>
              <th class="px-4 py-3 font-semibold">Age</th>
              <th class="px-4 py-3 font-semibold">Height</th>
              <th class="px-4 py-3 font-semibold">Location</th>
              <th class="px-4 py-3 font-semibold">Category</th>
              <th class="px-4 py-3 font-semibold">Score</th>
              <th class="px-4 py-3 font-semibold">Progress</th>
              <th class="px-4 py-3 font-semibold">Verified</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
            ${rows.map(x=>`
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900 dark:text-white">${esc(x.name||x.display_name||"-")}</div>
                  <div class="text-[10px] text-slate-500">${esc(x.email_norm||"")}</div>
                  <div class="text-[10px] text-slate-500">UID: <code>${esc(x.user_id||"")}</code></div>
                </td>
                <td class="px-4 py-3">${esc(x.gender||"-")}</td>
                <td class="px-4 py-3">${esc(String(x.age_years??"-"))}</td>
                <td class="px-4 py-3">${esc(String(x.height_cm??"-"))}</td>
                <td class="px-4 py-3">${esc(x.location||"-")}</td>
                <td class="px-4 py-3 text-[10px] text-slate-500">${esc(x.category_csv||"")}</td>
                <td class="px-4 py-3"><b>${esc(String(x.score||0))}</b></td>
                <td class="px-4 py-3">${esc(String(x.progress_pct||0))}%</td>
                <td class="px-4 py-3 text-[10px]">
                  ${x.verified_identity ? "✅ID" : "—"} ${x.verified_email ? "✅E" : "—"} ${x.verified_phone ? "✅P" : "—"}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <div class="mt-3 flex items-center justify-between">
        <div class="text-[10px] text-slate-500">${rows.length ? `Loaded ${rows.length}` : "No data"}</div>
        <button id="btnMore" class="px-3 py-1.5 rounded-md text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" ${cursor?"":"disabled"}>
          Load more
        </button>
      </div>
    `;

    host.querySelector("#btnMore")?.addEventListener("click", ()=>load(host,false));
  }

  return {
    title:"Talent Directory",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm overflow-hidden">
          <div class="p-4 border-b border-slate-200 dark:border-darkBorder bg-slate-50/50 dark:bg-white/5">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input id="loc" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2" placeholder="Location (e.g. jakarta)">
              <select id="gender" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2">
                <option value="">Gender (any)</option>
                <option>Male</option>
                <option>Female</option>
                <option>Non-Binary</option>
                <option>Other</option>
              </select>
              <input id="cat" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2" placeholder="Category (csv contains)">
              <select id="limit" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2">
                <option value="25">25</option>
                <option value="50" selected>50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
              <input id="age_min" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2" placeholder="Age min">
              <input id="age_max" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2" placeholder="Age max">
              <input id="h_min" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2" placeholder="Height cm min">
              <input id="h_max" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2" placeholder="Height cm max">
              <input id="score_min" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2" placeholder="Score min">
              <input id="progress_min" class="text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-md px-3 py-2" placeholder="Progress min (0-100)">
              <div class="md:col-span-4 flex gap-2 justify-end mt-1">
                <button id="btnApply" class="bg-primary hover:bg-blue-600 text-white px-3 py-2 rounded-md text-xs font-bold transition">Apply filter</button>
                <button id="btnReset" class="px-3 py-2 rounded-md text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reset</button>
              </div>
            </div>
          </div>
          <div class="p-4" id="rows"></div>
        </div>
      `;

      const g = (id)=>host.querySelector("#"+id);

      g("btnApply")?.addEventListener("click", ()=>{
        state.loc = String(g("loc").value||"").trim().toLowerCase();
        state.gender = String(g("gender").value||"").trim();
        state.cat = String(g("cat").value||"").trim().toLowerCase();
        state.limit = Number(g("limit").value||"50");

        state.age_min = String(g("age_min").value||"").trim();
        state.age_max = String(g("age_max").value||"").trim();
        state.h_min = String(g("h_min").value||"").trim();
        state.h_max = String(g("h_max").value||"").trim();
        state.score_min = String(g("score_min").value||"").trim();
        state.progress_min = String(g("progress_min").value||"").trim();

        load(host,true);
      });

      g("btnReset")?.addEventListener("click", ()=>{
        ["loc","gender","cat","age_min","age_max","h_min","h_max","score_min","progress_min"].forEach(id=>{ const el=g(id); if(el) el.value=""; });
        g("limit").value="50";
        Object.assign(state,{ loc:"", gender:"", age_min:"", age_max:"", h_min:"", h_max:"", cat:"", score_min:"", progress_min:"", limit:50 });
        load(host,true);
      });

      load(host,true);
    }
  };
}
