export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  const nfmt = (n)=> {
    try{ return new Intl.DateTimeFormat("id-ID",{ dateStyle:"short", timeStyle:"short" }).format(new Date(Number(n||0)*1000)); }
    catch{ return String(n||""); }
  };

  async function list(active=1){
    return await Orland.api("/api/ip-blocks?active="+encodeURIComponent(active)+"&limit=100");
  }
  async function block(ip, ttl_sec, reason){
    return await Orland.api("/api/ip-blocks",{
      method:"POST",
      body: JSON.stringify({ action:"block", ip, ttl_sec, reason })
    });
  }
  async function unblock(id){
    return await Orland.api("/api/ip-blocks",{
      method:"POST",
      body: JSON.stringify({ action:"unblock", id })
    });
  }
  async function purge(){
    return await Orland.api("/api/ip-blocks",{
      method:"POST",
      body: JSON.stringify({ action:"purge" })
    });
  }

  return {
    title:"Banned / IP Blocks",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-xl font-extrabold text-slate-900 dark:text-white">Banned / IP Blocks</div>
              <div class="text-sm text-slate-500">Block manual, unblock, dan purge expired IP hashes.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                Reload
              </button>
              <button id="btnPurge" class="px-3 py-2 rounded-xl text-xs font-black border border-amber-200 text-amber-700 hover:bg-amber-50">
                Purge
              </button>
            </div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div class="md:col-span-2">
                <label class="text-[11px] font-bold text-slate-500">IP Address</label>
                <input id="f_ip" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="203.0.113.10">
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500">TTL (sec)</label>
                <input id="f_ttl" type="number" value="86400" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>
              <div>
                <label class="text-[11px] font-bold text-slate-500">Reason</label>
                <input id="f_reason" value="manual_block" class="w-full mt-1 px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
              </div>
            </div>
            <div class="mt-3 flex justify-end">
              <button id="btnBlock" class="px-4 py-2 rounded-xl text-xs font-black bg-danger text-white hover:opacity-95">
                Block IP
              </button>
            </div>
            <div id="msg" class="mt-2 text-xs"></div>
          </div>

          <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between">
              <div class="text-sm font-extrabold">Active blocks</div>
              <button id="btnShowAll" class="text-xs font-black text-primary">Toggle active/all</button>
            </div>
            <div id="listBox" class="divide-y divide-slate-100 dark:divide-darkBorder"></div>
          </div>
        </div>
      `;

      const msg = host.querySelector("#msg");
      const listBox = host.querySelector("#listBox");
      let activeOnly = 1;

      async function reload(){
        msg.textContent = "";
        const r = await list(activeOnly);
        if(r.status!=="ok"){
          listBox.innerHTML = `<div class="p-4 text-red-500 text-sm font-bold">Failed: ${esc(r.status)}</div>`;
          return;
        }
        const items = r.data?.items || [];
        if(!items.length){
          listBox.innerHTML = `<div class="p-4 text-xs text-slate-500">No data.</div>`;
          return;
        }

        listBox.innerHTML = items.map(x=>`
          <div class="p-4 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-extrabold truncate">${esc(x.reason || "—")}</div>
              <div class="text-[11px] text-slate-500 break-all mt-1">hash: ${esc(x.ip_hash)}</div>
              <div class="text-[11px] text-slate-500 mt-1">
                created: ${esc(nfmt(x.created_at))}
                ${x.expires_at ? ` • expires: ${esc(nfmt(x.expires_at))}` : ``}
                ${x.revoked_at ? ` • revoked: ${esc(nfmt(x.revoked_at))}` : ``}
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              ${x.revoked_at ? `` : `
              <button class="btnUnblock px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-id="${esc(x.id)}">
                Unblock
              </button>`}
            </div>
          </div>
        `).join("");

        listBox.querySelectorAll(".btnUnblock").forEach(btn=>{
          btn.addEventListener("click", async ()=>{
            const id = btn.getAttribute("data-id");
            if(!id) return;
            if(!confirm("Unblock this entry?")) return;
            const rr = await unblock(id);
            if(rr.status!=="ok"){
              msg.className = "mt-2 text-xs text-red-500";
              msg.textContent = "Failed: " + rr.status;
              return;
            }
            msg.className = "mt-2 text-xs text-emerald-600";
            msg.textContent = "Unblocked.";
            await reload();
          });
        });
      }

      host.querySelector("#btnReload")?.addEventListener("click", reload);

      host.querySelector("#btnShowAll")?.addEventListener("click", async ()=>{
        activeOnly = activeOnly ? 0 : 1;
        await reload();
      });

      host.querySelector("#btnPurge")?.addEventListener("click", async ()=>{
        if(!confirm("Purge expired/revoked entries?")) return;
        const r = await purge();
        if(r.status!=="ok"){
          msg.className = "mt-2 text-xs text-red-500";
          msg.textContent = "Failed: " + r.status;
          return;
        }
        msg.className = "mt-2 text-xs text-emerald-600";
        msg.textContent = "Purged.";
        await reload();
      });

      host.querySelector("#btnBlock")?.addEventListener("click", async ()=>{
        const ip = host.querySelector("#f_ip")?.value || "";
        const ttl = Number(host.querySelector("#f_ttl")?.value || 86400);
        const reason = host.querySelector("#f_reason")?.value || "manual_block";

        if(!ip.trim()){
          msg.className = "mt-2 text-xs text-red-500";
          msg.textContent = "IP required.";
          return;
        }

        const r = await block(ip.trim(), ttl, reason.trim());
        if(r.status!=="ok"){
          msg.className = "mt-2 text-xs text-red-500";
          msg.textContent = "Failed: " + r.status;
          return;
        }

        msg.className = "mt-2 text-xs text-emerald-600";
        msg.textContent = "Blocked.";
        host.querySelector("#f_ip").value = "";
        await reload();
      });

      await reload();
    }
  };
}
