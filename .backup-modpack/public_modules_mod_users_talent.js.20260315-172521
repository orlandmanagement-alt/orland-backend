export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const fmtTime = (sec)=>{ const n=Number(sec||0); if(!n) return "—"; return new Date(n*1000).toLocaleString(); };

  function qsFrom(host){
    const q = new URLSearchParams();
    const get = (id)=>host.querySelector(id);

    const qv = (get("#q")?.value||"").trim();
    const loc = (get("#location")?.value||"").trim();
    const gender = (get("#gender")?.value||"").trim();
    const ageMin = (get("#ageMin")?.value||"").trim();
    const ageMax = (get("#ageMax")?.value||"").trim();
    const hMin = (get("#hMin")?.value||"").trim();
    const hMax = (get("#hMax")?.value||"").trim();
    const scoreMin = (get("#scoreMin")?.value||"").trim();
    const progMin = (get("#progMin")?.value||"").trim();
    const limit = (get("#limit")?.value||"50").trim();

    if(qv) q.set("q", qv);
    if(loc) q.set("location", loc.toLowerCase().replace(/\s+/g," "));
    if(gender) q.set("gender", gender);
    if(ageMin) q.set("age_min", ageMin);
    if(ageMax) q.set("age_max", ageMax);
    if(hMin) q.set("height_min", hMin);
    if(hMax) q.set("height_max", hMax);
    if(scoreMin) q.set("score_min", scoreMin);
    if(progMin) q.set("progress_min", progMin);
    q.set("limit", limit || "50");
    return q.toString();
  }

  async function list(qs){
    return await Orland.api("/api/users/talent?"+qs);
  }

  function pill(ok, label){
    return ok
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-success/10 text-success border border-success/30">${label}</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-black/20 opacity-70 border border-slate-200 dark:border-darkBorder">${label}</span>`;
  }

  return {
    title:"Talent Directory",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-sm font-extrabold">Talent Directory</div>
              <div class="text-xs opacity-70">Filter lokasi, usia, tinggi, gender, score, progress</div>
            </div>
            <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <i class="fa-solid fa-rotate mr-2"></i>Search
            </button>
          </div>

          <div class="mt-4 grid grid-cols-1 md:grid-cols-6 gap-2">
            <input id="q" class="md:col-span-2 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="search name/email">
            <input id="location" class="md:col-span-2 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="location (norm)">
            <select id="gender" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              <option value="">gender</option><option>Male</option><option>Female</option><option>Other</option>
            </select>
            <select id="limit" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              <option value="25">25</option><option value="50" selected>50</option><option value="100">100</option><option value="200">200</option>
            </select>

            <input id="ageMin" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="age min" inputmode="numeric">
            <input id="ageMax" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="age max" inputmode="numeric">
            <input id="hMin" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="height min" inputmode="numeric">
            <input id="hMax" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="height max" inputmode="numeric">
            <input id="scoreMin" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="score min" inputmode="numeric">
            <input id="progMin" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="progress min" inputmode="numeric">
          </div>

          <div class="mt-4 overflow-auto border border-slate-200 dark:border-darkBorder rounded-xl">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="bg-slate-50 dark:bg-dark border-b border-slate-200 dark:border-darkBorder">
                <tr>
                  <th class="px-3 py-3 font-bold">Talent</th>
                  <th class="px-3 py-3 font-bold">Profile</th>
                  <th class="px-3 py-3 font-bold">Score</th>
                  <th class="px-3 py-3 font-bold">Progress</th>
                  <th class="px-3 py-3 font-bold">Verify</th>
                  <th class="px-3 py-3 font-bold">Last login</th>
                </tr>
              </thead>
              <tbody id="rows" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
            </table>
          </div>

          <div class="mt-3 text-[11px] opacity-70" id="meta">—</div>
        </div>
      `;

      const rowsEl = host.querySelector("#rows");
      const metaEl = host.querySelector("#meta");

      async function reload(){
        rowsEl.innerHTML = `<tr><td class="px-3 py-3 opacity-70" colspan="6">Loading...</td></tr>`;
        const r = await list(qsFrom(host));
        if(r.status!=="ok"){
          rowsEl.innerHTML = `<tr><td class="px-3 py-3 text-danger" colspan="6">Error: ${esc(r.status)}</td></tr>`;
          metaEl.textContent="—";
          return;
        }
        const users = r.data?.users || [];
        metaEl.textContent = `Total: ${users.length}`;

        rowsEl.innerHTML = users.map(u=>{
          const p = u.profile||{};
          const prof = `${esc(p.gender||"—")} • age ${esc(p.age_years??"—")} • ${esc(p.height_cm??"—")}cm • ${esc(p.location||"—")}`;
          const v = [
            pill(!!p.verified_email,"email"),
            pill(!!p.verified_phone,"phone"),
            pill(!!p.verified_identity,"id")
          ].join(" ");
          return `
            <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
              <td class="px-3 py-3">
                <div class="font-bold">${esc(u.display_name||"-")}</div>
                <div class="text-[11px] opacity-70">${esc(u.email_norm||"")}</div>
              </td>
              <td class="px-3 py-3">${prof}</td>
              <td class="px-3 py-3 font-extrabold">${esc(p.score??0)}</td>
              <td class="px-3 py-3">
                <div class="text-[11px] font-bold">${esc(p.progress_pct??0)}%</div>
              </td>
              <td class="px-3 py-3">${v}</td>
              <td class="px-3 py-3">${esc(fmtTime(u.last_login_at))}</td>
            </tr>
          `;
        }).join("") || `<tr><td class="px-3 py-3 opacity-70" colspan="6">No data</td></tr>`;
      }

      host.querySelector("#btnReload").onclick = reload;
      host.querySelector("#q").addEventListener("keydown",(e)=>{ if(e.key==="Enter") reload(); });
      await reload();
    }
  };
}
