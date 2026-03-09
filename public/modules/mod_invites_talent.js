export default function InviteTalentModule(Orland){
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const fmt = (ts)=>{
    const n = Number(ts||0);
    if(!n) return "—";
    try{ return new Date(n*1000).toISOString().replace("T"," ").slice(0,19); }catch{ return String(ts); }
  };

  function toast(msg, type="info"){
    const host = document.getElementById("toast-host");
    if(!host){ alert(msg); return; }
    const div = document.createElement("div");
    div.className = "toast-item";
    div.innerHTML = `<div style="font-weight:900">${esc(type.toUpperCase())}</div><div class="small-muted" style="margin-top:4px">${esc(msg)}</div>`;
    host.appendChild(div);
    setTimeout(()=>{ div.style.opacity="0"; div.style.transform="translateY(6px)"; }, 2200);
    setTimeout(()=>div.remove(), 3000);
  }

  async function list(active=1,limit=80){
    return await Orland.api("/api/invites/talent?active="+encodeURIComponent(active)+"&limit="+encodeURIComponent(limit));
  }
  async function create(payload){
    return await Orland.api("/api/invites/talent",{ method:"POST", body: JSON.stringify(payload) });
  }
  async function revoke(id){
    return await Orland.api("/api/invites/talent",{ method:"PUT", body: JSON.stringify({ action:"revoke", id }) });
  }

  return {
    title:"Invite Talent",
    async mount(host){
      host.innerHTML = `
<div class="orland-card p-4">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <div class="text-sm font-black">Invite Talent</div>
      <div class="text-[11px] text-slate-500">Generate invite link untuk register talent (by email hash)</div>
    </div>
    <div class="flex gap-2">
      <button id="btnReload" class="orland-btn-ghost"><i class="fa-solid fa-rotate me-2"></i>Reload</button>
    </div>
  </div>

  <div class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
    <div class="md:col-span-2">
      <div class="text-[11px] font-extrabold text-slate-500 mb-1">EMAIL</div>
      <input id="email" class="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="talent@email.com" />
    </div>
    <div>
      <div class="text-[11px] font-extrabold text-slate-500 mb-1">TTL (hours)</div>
      <input id="ttl" value="72" class="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" />
    </div>
    <div>
      <button id="btnCreate" class="orland-btn w-full"><i class="fa-solid fa-link me-2"></i>Create Invite</button>
    </div>
  </div>

  <div class="mt-4 orland-card p-3" style="box-shadow:none">
    <div class="text-[11px] font-extrabold text-slate-500 mb-1">LATEST INVITE LINK</div>
    <div class="flex gap-2 items-center">
      <input id="outLink" readonly class="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="(link will appear here)" />
      <button id="btnCopy" class="orland-btn-ghost"><i class="fa-solid fa-copy"></i></button>
    </div>
  </div>

  <div class="mt-4 overflow-x-auto">
    <table class="w-full text-left text-xs whitespace-nowrap">
      <thead class="bg-slate-50 dark:bg-black/20 text-slate-500 border-b border-slate-200 dark:border-darkBorder">
        <tr>
          <th class="px-4 py-3 font-extrabold">ID</th>
          <th class="px-4 py-3 font-extrabold">Role</th>
          <th class="px-4 py-3 font-extrabold">Created</th>
          <th class="px-4 py-3 font-extrabold">Expires</th>
          <th class="px-4 py-3 font-extrabold">Used</th>
          <th class="px-4 py-3 font-extrabold text-right">Action</th>
        </tr>
      </thead>
      <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
    </table>
  </div>
</div>`;

      const tb = host.querySelector("#tb");
      const email = host.querySelector("#email");
      const ttl = host.querySelector("#ttl");
      const outLink = host.querySelector("#outLink");

      let rows = [];

      function render(){
        tb.innerHTML = rows.map(x=>`
<tr class="hover:bg-slate-50 dark:hover:bg-white/5">
  <td class="px-4 py-3"><code>${esc(x.id||"")}</code></td>
  <td class="px-4 py-3">${esc(x.role||"")}</td>
  <td class="px-4 py-3 text-slate-500">${esc(fmt(x.created_at))}</td>
  <td class="px-4 py-3 text-slate-500">${esc(fmt(x.expires_at))}</td>
  <td class="px-4 py-3 ${x.used_at? "text-rose-400":"text-slate-500"}">${x.used_at? esc(fmt(x.used_at)):"—"}</td>
  <td class="px-4 py-3 text-right">
    <button class="orland-btn-ghost" style="padding:8px 10px" data-act="revoke" data-id="${esc(x.id)}"><i class="fa-solid fa-ban"></i></button>
  </td>
</tr>`).join("");

        tb.querySelectorAll('[data-act="revoke"]').forEach(btn=>{
          btn.addEventListener("click", async ()=>{
            const id = btn.getAttribute("data-id");
            if(!id) return;
            if(!confirm("Revoke invite?")) return;
            const r = await revoke(id);
            toast(r.status, r.status==="ok"?"success":"error");
            if(r.status==="ok") await load();
          });
        });
      }

      async function load(){
        tb.innerHTML = `<tr><td class="px-4 py-4 text-slate-500" colspan="6">Loading...</td></tr>`;
        const r = await list(1, 120);
        if(r.status!=="ok"){
          tb.innerHTML = `<tr><td class="px-4 py-4 text-rose-400" colspan="6">Failed: ${esc(r.status)}</td></tr>`;
          return;
        }
        rows = r.data.invites || [];
        render();
      }

      host.querySelector("#btnReload").addEventListener("click", load);

      host.querySelector("#btnCreate").addEventListener("click", async ()=>{
        const em = (email.value||"").trim().toLowerCase();
        const tt = Number((ttl.value||"72").trim());
        if(!em.includes("@")) return toast("Email invalid", "error");
        if(!Number.isFinite(tt) || tt<1) return toast("TTL invalid", "error");
        const r = await create({ email: em, role:"talent", ttl_hours: tt });
        if(r.status!=="ok") return toast(r.status, "error");
        outLink.value = r.data.invite_url || "";
        toast("Invite created", "success");
        await load();
      });

      host.querySelector("#btnCopy").addEventListener("click", async ()=>{
        const v = outLink.value || "";
        if(!v) return;
        try{ await navigator.clipboard.writeText(v); toast("Copied", "success"); }
        catch{ toast("Copy failed", "error"); }
      });

      await load();
    }
  };
}
