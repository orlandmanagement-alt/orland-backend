export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function load(mode="active"){
    return await Orland.api("/api/ipblocks?mode=" + encodeURIComponent(mode) + "&limit=100");
  }

  async function createBlock(payload){
    return await Orland.api("/api/ipblocks_create", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  async function revokeBlock(id){
    return await Orland.api("/api/ipblocks_revoke", {
      method:"POST",
      body: JSON.stringify({ id })
    });
  }

  async function purgeBlocks(){
    return await Orland.api("/api/ipblocks_purge", {
      method:"POST",
      body: "{}"
    });
  }

  function fmtTs(sec){
    if(!sec) return "—";
    try{
      return new Intl.DateTimeFormat("id-ID", { dateStyle:"medium", timeStyle:"short" }).format(new Date(Number(sec) * 1000));
    }catch{
      return String(sec);
    }
  }

  return {
    title:"Banned / IP Blocks",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-2xl font-extrabold">Banned / IP Blocks</div>
              <div class="text-slate-500 mt-1">Block manual, unblock, dan purge expired IP hashes.</div>
            </div>
            <div class="flex gap-2">
              <button id="btnReload" class="px-4 py-2 rounded-2xl border border-slate-200 dark:border-darkBorder font-black">Reload</button>
              <button id="btnPurge" class="px-4 py-2 rounded-2xl border border-amber-300 text-amber-700 font-black">Purge</button>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">IP Address</label>
                <input id="ip" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark" placeholder="203.0.113.10">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">TTL (sec)</label>
                <input id="ttl" type="number" value="86400" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              </div>
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Reason</label>
                <input id="reason" value="manual_block" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark">
              </div>
              <div class="flex justify-end">
                <button id="btnBlock" class="px-6 py-3 rounded-2xl bg-red-500 text-white font-black">Block IP</button>
              </div>
              <div id="formMsg" class="text-sm"></div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between">
              <div class="text-xl font-extrabold">Active blocks</div>
              <button id="btnToggleMode" class="text-primary font-bold">Toggle active/all</button>
            </div>
            <div id="listBox" class="p-5"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);
      let mode = "active";

      async function render(){
        const r = await load(mode);
        if(r.status !== "ok"){
          q("listBox").innerHTML = `<div class="text-red-500 font-bold">Failed: ${esc(r.status)}</div>`;
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        if(!items.length){
          q("listBox").innerHTML = `<div class="text-slate-500 text-sm">No blocked IP data.</div>`;
          return;
        }

        q("listBox").innerHTML = `
          <div class="space-y-3">
            ${items.map(it => `
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="text-sm font-black break-all">${esc(it.ip_hash || "-")}</div>
                    <div class="text-xs text-slate-500 mt-1">Reason: ${esc(it.reason || "-")}</div>
                    <div class="text-xs text-slate-500 mt-1">Created: ${esc(fmtTs(it.created_at))}</div>
                    <div class="text-xs text-slate-500 mt-1">Expires: ${esc(fmtTs(it.expires_at))}</div>
                    <div class="text-xs text-slate-500 mt-1">Revoked: ${esc(fmtTs(it.revoked_at))}</div>
                  </div>
                  <div class="shrink-0">
                    ${!it.revoked_at ? `<button class="btnUnblock px-4 py-2 rounded-xl border border-slate-200 dark:border-darkBorder font-bold" data-id="${esc(it.id)}">Unblock</button>` : ""}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        `;

        q("listBox").querySelectorAll(".btnUnblock").forEach(btn=>{
          btn.onclick = async ()=>{
            const id = btn.getAttribute("data-id");
            const res = await revokeBlock(id);
            if(res.status !== "ok"){
              alert("Unblock failed: " + res.status);
              return;
            }
            await render();
          };
        });
      }

      q("btnReload").onclick = render;
      q("btnToggleMode").onclick = async ()=>{
        mode = mode === "active" ? "all" : "active";
        await render();
      };

      q("btnPurge").onclick = async ()=>{
        const r = await purgeBlocks();
        if(r.status !== "ok"){
          alert("Purge failed: " + r.status);
          return;
        }
        await render();
      };

      q("btnBlock").onclick = async ()=>{
        const msg = q("formMsg");
        msg.className = "text-sm text-slate-500";
        msg.textContent = "Saving...";

        const r = await createBlock({
          ip: q("ip").value.trim(),
          ttl: Number(q("ttl").value || 86400),
          reason: q("reason").value.trim()
        });

        if(r.status !== "ok"){
          msg.className = "text-sm text-red-500";
          msg.textContent = "Failed: " + r.status;
          return;
        }

        msg.className = "text-sm text-emerald-600";
        msg.textContent = "IP blocked.";
        q("ip").value = "";
        await render();
      };

      await render();
    }
  };
}
