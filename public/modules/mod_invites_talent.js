export default function(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const fmtTs = (t)=>{
    const n = Number(t||0);
    if(!n) return "-";
    return new Date(n*1000).toISOString().replace("T"," ").slice(0,19);
  };
  const badge = (txt, tone="slate")=>{
    const map = {
      slate:"border-slate-200 bg-slate-50 dark:bg-black/20 text-slate-700 dark:text-slate-200",
      green:"border-green-200 bg-green-50 dark:bg-black/20 text-green-700 dark:text-green-300",
      red:"border-red-200 bg-red-50 dark:bg-black/20 text-red-700 dark:text-red-300",
      amber:"border-amber-200 bg-amber-50 dark:bg-black/20 text-amber-700 dark:text-amber-300",
    };
    return `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${map[tone]||map.slate}">${esc(txt)}</span>`;
  };

  const state = { email:"", ttl_hours:"72", q:"", limit:50, loading:false, rows:[], now:0 };
  let hostEl=null;

  async function load(){
    state.loading = true; render();
    const p = new URLSearchParams();
    if(state.q) p.set("q", state.q);
    p.set("limit", String(state.limit||50));
    const r = await Orland.api(`/api/invites/talent?${p.toString()}`);
    state.loading=false;

    if(r.status!=="ok"){
      Orland.toast?.(`Failed: ${r.status}`, "error");
      state.rows=[];
      render();
      return;
    }
    state.rows = r.data.rows || [];
    state.now = r.data.now || 0;
    render();
  }

  async function create(){
    const email = state.email.trim().toLowerCase();
    const ttl = Number(state.ttl_hours||"72");
    if(!email.includes("@")) return Orland.toast?.("Email invalid", "error");

    const r = await Orland.api("/api/invites/talent", { method:"POST", body: JSON.stringify({ email, ttl_hours: ttl }) });
    if(r.status!=="ok"){ Orland.toast?.("Create failed: "+r.status, "error"); return; }

    // copy link
    try{
      await navigator.clipboard.writeText(r.data.link);
      Orland.toast?.("Invite created + link copied", "success");
    }catch{
      Orland.toast?.("Invite created (copy manually from table)", "success");
    }

    state.email="";
    await load();
  }

  async function revoke(id){
    if(!confirm("Revoke invite?")) return;
    const r = await Orland.api("/api/invites/talent", { method:"PUT", body: JSON.stringify({ action:"revoke", id }) });
    Orland.toast?.(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok") await load();
  }

  function render(){
    if(!hostEl) return;

    hostEl.innerHTML = `
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
        <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div class="text-sm font-extrabold">Talent Invites</div>
            <div class="text-xs text-slate-500">Buat invite link untuk Talent register via /setup?invite=...</div>
          </div>
          <div class="flex gap-2">
            <button id="btnBack" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <i class="fa-solid fa-arrow-left me-2"></i>Back
            </button>
            <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-95">
              <i class="fa-solid fa-rotate me-2"></i>Reload
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-6 gap-2 mt-4">
          <input id="email" class="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark" placeholder="talent@email.com" value="${esc(state.email)}">
          <input id="ttl" class="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark" placeholder="ttl_hours (default 72)" value="${esc(state.ttl_hours)}">
          <button id="btnCreate" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-95">
            <i class="fa-solid fa-plus me-2"></i>Create Invite
          </button>

          <div class="md:col-span-3 flex gap-2">
            <input id="q" class="flex-1 px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark" placeholder="search id/email_hash" value="${esc(state.q)}">
            <select id="limit" class="px-3 py-2 rounded-lg text-xs border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              ${[25,50,100,200].map(x=>`<option value="${x}" ${Number(state.limit)===x?"selected":""}>Limit ${x}</option>`).join("")}
            </select>
            <button id="btnSearch" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <i class="fa-solid fa-magnifying-glass me-2"></i>Search
            </button>
          </div>
        </div>

        <div class="mt-3 text-xs text-slate-500">${state.loading ? "Loading..." : `Rows: <b>${esc(state.rows.length)}</b>`}</div>

        <div class="overflow-x-auto mt-3">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
              <tr>
                <th class="px-3 py-3 font-semibold">Invite ID</th>
                <th class="px-3 py-3 font-semibold">Email Hash</th>
                <th class="px-3 py-3 font-semibold">Status</th>
                <th class="px-3 py-3 font-semibold">Expires</th>
                <th class="px-3 py-3 font-semibold">Created</th>
                <th class="px-3 py-3 font-semibold">Link</th>
                <th class="px-3 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
              ${(state.rows||[]).map(x=>{
                const st = x.status;
                const tone = st==="active" ? "green" : (st==="used" ? "amber" : "red");
                const link = `${location.origin}/setup?invite=${encodeURIComponent(x.id)}`;
                return `
                  <tr class="hover:bg-slate-50 dark:hover:bg-white/5">
                    <td class="px-3 py-3"><code>${esc(x.id)}</code></td>
                    <td class="px-3 py-3"><code>${esc(x.email_hash||"")}</code></td>
                    <td class="px-3 py-3">${badge(st, tone)}</td>
                    <td class="px-3 py-3">${fmtTs(x.expires_at)}</td>
                    <td class="px-3 py-3">${fmtTs(x.created_at)}</td>
                    <td class="px-3 py-3">
                      <button class="px-2 py-1 rounded-md text-[10px] font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5"
                        data-copy="${esc(link)}"><i class="fa-solid fa-copy me-1"></i>Copy</button>
                    </td>
                    <td class="px-3 py-3 text-right">
                      ${st==="active" ? `
                        <button class="px-2 py-1 rounded-md text-[10px] font-bold border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-white/5"
                          data-revoke="${esc(x.id)}"><i class="fa-solid fa-ban me-1"></i>Revoke</button>
                      ` : `<span class="text-[10px] text-slate-500">-</span>`}
                    </td>
                  </tr>
                `;
              }).join("") || `<tr><td class="px-3 py-6 text-slate-500" colspan="7">No invites.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;

    hostEl.querySelector("#btnBack")?.addEventListener("click", ()=>Orland.navigate("/users/talent"));
    hostEl.querySelector("#btnReload")?.addEventListener("click", ()=>load());
    hostEl.querySelector("#btnCreate")?.addEventListener("click", ()=>{
      state.email = hostEl.querySelector("#email").value;
      state.ttl_hours = hostEl.querySelector("#ttl").value;
      create();
    });
    hostEl.querySelector("#btnSearch")?.addEventListener("click", ()=>{
      state.q = hostEl.querySelector("#q").value.trim();
      state.limit = Number(hostEl.querySelector("#limit").value || 50);
      load();
    });
    hostEl.querySelector("#q")?.addEventListener("keydown",(e)=>{ if(e.key==="Enter") hostEl.querySelector("#btnSearch")?.click(); });

    hostEl.querySelectorAll("[data-copy]").forEach(b=>{
      b.addEventListener("click", async ()=>{
        const link = b.getAttribute("data-copy");
        try{ await navigator.clipboard.writeText(link); Orland.toast?.("Copied", "success"); }
        catch{ prompt("Copy link:", link); }
      });
    });
    hostEl.querySelectorAll("[data-revoke]").forEach(b=>{
      b.addEventListener("click", ()=>revoke(b.getAttribute("data-revoke")));
    });
  }

  return {
    title:"Talent Invites",
    async mount(host){
      hostEl=host;
      render();
      await load();
    }
  };
}
