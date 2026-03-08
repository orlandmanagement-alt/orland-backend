export async function mount(ctx){
  const { host, api } = ctx;

  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-bold">Talent Directory</div>
          <div class="text-xs text-slate-500 mt-1">
            Real filters via <code>talent_profiles</code> • endpoint: <code>/api/users/talent</code>
          </div>
        </div>
        <button id="tlReload" class="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
          Reload
        </button>
      </div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <div class="md:col-span-2">
          <div class="text-[11px] text-slate-500 font-bold mb-1">Search</div>
          <input id="tlQ" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2"
            placeholder="email/name (q)" />
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Gender</div>
          <select id="tlGender" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="">any</option>
            <option value="male">male</option>
            <option value="female">female</option>
            <option value="other">other</option>
          </select>
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Location</div>
          <input id="tlLocation" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2"
            placeholder="Jakarta" />
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Age</div>
          <div class="flex gap-2">
            <input id="tlAgeMin" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-2 py-2" placeholder="min" />
            <input id="tlAgeMax" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-2 py-2" placeholder="max" />
          </div>
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Height (cm)</div>
          <div class="flex gap-2">
            <input id="tlHMin" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-2 py-2" placeholder="min" />
            <input id="tlHMax" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-2 py-2" placeholder="max" />
          </div>
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Category</div>
          <input id="tlCategory" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2"
            placeholder="Modeling" />
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Score min</div>
          <input id="tlScore" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2"
            placeholder="9000" />
        </div>

        <div>
          <div class="text-[11px] text-slate-500 font-bold mb-1">Limit</div>
          <select id="tlLimit" class="w-full text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="25">25</option>
            <option value="50" selected>50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>

        <div class="md:col-span-2 flex gap-2">
          <button id="tlApply" class="flex-1 text-xs px-3 py-2 rounded-lg bg-primary text-white hover:bg-blue-600">
            Apply Filters
          </button>
          <button id="tlClear" class="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
            Clear
          </button>
        </div>

        <div class="md:col-span-2 text-[11px] text-slate-500 text-right" id="tlMeta">—</div>
      </div>

      <div id="tlTable" class="mt-4 overflow-x-auto"></div>
      <details class="mt-3">
        <summary class="text-[11px] text-slate-500">Debug last response</summary>
        <pre id="tlDebug" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre>
      </details>
    </div>
  `;

  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const $ = (id)=>document.getElementById(id);

  $("tlReload").onclick = ()=>load();
  $("tlApply").onclick = ()=>load();
  $("tlClear").onclick = ()=>{
    ["tlQ","tlGender","tlLocation","tlAgeMin","tlAgeMax","tlHMin","tlHMax","tlCategory","tlScore"].forEach(id=>$(id).value="");
    load();
  };
  $("tlQ").addEventListener("keydown",(e)=>{ if(e.key==="Enter") load(); });

  function badge(text, kind){
    const cls = {
      ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      bad: "bg-red-500/10 text-red-400 border-red-500/20",
      gray:"bg-slate-500/10 text-slate-400 border-slate-500/20",
    }[kind] || "bg-slate-500/10 text-slate-400 border-slate-500/20";
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-lg border ${cls} text-[11px] font-bold">${esc(text)}</span>`;
  }

  function fmtCats(arr){
    const a = Array.isArray(arr) ? arr : [];
    return a.length ? a.slice(0,3).join(", ") + (a.length>3 ? "…" : "") : "-";
  }

  async function load(){
    const params = new URLSearchParams();
    params.set("limit", ($("tlLimit").value||"50"));

    const q = ($("tlQ").value||"").trim(); if(q) params.set("q", q);
    const gender = ($("tlGender").value||"").trim(); if(gender) params.set("gender", gender);
    const location = ($("tlLocation").value||"").trim(); if(location) params.set("location", location);
    const age_min = ($("tlAgeMin").value||"").trim(); if(age_min) params.set("age_min", age_min);
    const age_max = ($("tlAgeMax").value||"").trim(); if(age_max) params.set("age_max", age_max);
    const height_min = ($("tlHMin").value||"").trim(); if(height_min) params.set("height_min", height_min);
    const height_max = ($("tlHMax").value||"").trim(); if(height_max) params.set("height_max", height_max);
    const category = ($("tlCategory").value||"").trim(); if(category) params.set("category", category);
    const score_min = ($("tlScore").value||"").trim(); if(score_min) params.set("score_min", score_min);

    $("tlTable").innerHTML = `<div class="text-xs text-slate-500">Loading…</div>`;
    const r = await api("/api/users/talent?"+params.toString());
    $("tlDebug").textContent = JSON.stringify(r,null,2);

    if(r.status !== "ok"){
      $("tlTable").innerHTML = `<div class="text-xs text-red-400">Failed: ${esc(r.status)}</div>`;
      $("tlMeta").textContent = "—";
      return;
    }

    const rows = r.data.users || [];
    $("tlMeta").textContent = `${rows.length} talents`;

    $("tlTable").innerHTML = `
      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
          <tr>
            <th class="px-4 py-3 font-semibold">Talent</th>
            <th class="px-4 py-3 font-semibold">Status</th>
            <th class="px-4 py-3 font-semibold">Gender</th>
            <th class="px-4 py-3 font-semibold">Age</th>
            <th class="px-4 py-3 font-semibold">Height</th>
            <th class="px-4 py-3 font-semibold">Location</th>
            <th class="px-4 py-3 font-semibold">Category</th>
            <th class="px-4 py-3 font-semibold">Score</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
          ${rows.map(u=>{
            const st = (u.status||"");
            const ok = st==="active";
            // frontend age computed from dob (optional)
            let age = "-";
            if(u.dob && /^\d{4}-\d{2}-\d{2}$/.test(u.dob)){
              const y = Number(u.dob.slice(0,4));
              const m = Number(u.dob.slice(5,7));
              const d = Number(u.dob.slice(8,10));
              const now = new Date();
              let a = now.getFullYear()-y;
              const md = (now.getMonth()+1)*100 + now.getDate();
              const bd = m*100 + d;
              if(md < bd) a -= 1;
              age = String(a);
            }
            return `
              <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                <td class="px-4 py-3">
                  <div class="font-bold text-slate-900 dark:text-white">${esc(u.display_name||"")}</div>
                  <div class="text-[11px] text-slate-500">${esc(u.email_norm||"")}</div>
                  <div class="text-[11px] text-slate-500">id: <code>${esc(u.id||"")}</code></div>
                </td>
                <td class="px-4 py-3">${badge(st||"-", ok?"ok":"bad")}</td>
                <td class="px-4 py-3">${badge(u.gender||"-","gray")}</td>
                <td class="px-4 py-3">${badge(age,"gray")}</td>
                <td class="px-4 py-3">${badge(u.height_cm!=null? (u.height_cm+" cm") : "-","gray")}</td>
                <td class="px-4 py-3">${badge(u.location||"-","gray")}</td>
                <td class="px-4 py-3">${badge(fmtCats(u.categories||[]),"gray")}</td>
                <td class="px-4 py-3">${badge(String(u.score_int||0),"warn")}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  await load();
}
