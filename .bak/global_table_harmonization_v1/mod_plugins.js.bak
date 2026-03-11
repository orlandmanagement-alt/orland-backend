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

  async function listPlugins(){
    return await Orland.api("/api/plugins");
  }

  // best-effort endpoints:
  async function install(name){
    // try POST /api/plugins/install
    let r = await Orland.api("/api/plugins/install", { method:"POST", body: JSON.stringify({ name }) });
    if(r.status==="server_error" || r.status==="not_found"){
      // fallback /api/plugins?op=install
      r = await Orland.api("/api/plugins?op=install", { method:"POST", body: JSON.stringify({ name }) });
    }
    return r;
  }

  async function uninstall(name){
    let r = await Orland.api("/api/plugins/uninstall", { method:"POST", body: JSON.stringify({ name }) });
    if(r.status==="server_error" || r.status==="not_found"){
      r = await Orland.api("/api/plugins?op=uninstall", { method:"POST", body: JSON.stringify({ name }) });
    }
    return r;
  }

  async function reconcile(name){
    let r = await Orland.api("/api/plugins/reconcile", { method:"POST", body: JSON.stringify({ name }) });
    if(r.status==="server_error" || r.status==="not_found"){
      r = await Orland.api("/api/plugins?op=reconcile", { method:"POST", body: JSON.stringify({ name }) });
    }
    return r;
  }

  return {
    title: "Plugins",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="text-base font-bold">Plugins</div>
              <div class="text-xs text-slate-500 mt-1">Install/Uninstall plugin (DB + config). Public modules tetap di repo.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
            </div>
          </div>

          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                <tr>
                  <th class="py-3 pr-3">Plugin</th>
                  <th class="py-3 pr-3">Version</th>
                  <th class="py-3 pr-3">Installable</th>
                  <th class="py-3 pr-3">Status</th>
                  <th class="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody id="tb" class="divide-y divide-slate-100 dark:divide-darkBorder"></tbody>
            </table>
          </div>

          <pre id="out" class="mt-4 text-[10px] bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-darkBorder rounded-xl p-3 overflow-auto hidden"></pre>
        </div>
      `;

      const tb = host.querySelector("#tb");
      const out = host.querySelector("#out");

      async function render(){
        tb.innerHTML = `<tr><td class="py-4 text-slate-500" colspan="5">Loading…</td></tr>`;
        const r = await listPlugins();
        if(r.status !== "ok"){
          tb.innerHTML = `<tr><td class="py-4 text-red-400" colspan="5">Failed: ${esc(r.status)}</td></tr>`;
          out.classList.remove("hidden");
          out.textContent = JSON.stringify(r, null, 2);
          return;
        }

        const plugins = r.data?.plugins || r.data?.items || [];
        if(!plugins.length){
          tb.innerHTML = `<tr><td class="py-4 text-slate-500" colspan="5">No plugins detected</td></tr>`;
          return;
        }

        tb.innerHTML = plugins.map(p=>{
          const name = p.name || p.id || "-";
          const ver = p.version || "-";
          const ok = (p.install === true || p.installable === true) ? "yes" : "no";
          const installed = (p.installed === true || p.status==="installed") ? true : false;

          const statusBadge = installed
            ? `<span class="text-success font-bold"><i class="fa-solid fa-circle text-[8px] mr-1"></i>installed</span>`
            : `<span class="text-slate-500 font-bold"><i class="fa-solid fa-circle text-[8px] mr-1"></i>not installed</span>`;

          return `
            <tr>
              <td class="py-3 pr-3">
                <div class="font-bold text-slate-900 dark:text-white">${esc(name)}</div>
                <div class="text-[10px] text-slate-500">${esc(p.title||p.description||"")}</div>
              </td>
              <td class="py-3 pr-3">${esc(ver)}</td>
              <td class="py-3 pr-3">${esc(ok)}</td>
              <td class="py-3 pr-3">${statusBadge}</td>
              <td class="py-3 text-right">
                <div class="flex justify-end gap-2 flex-wrap">
                  <button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-act="reconcile" data-name="${esc(name)}">
                    Reconcile
                  </button>
                  ${
                    installed
                      ? `<button class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-danger/10 text-danger" data-act="uninstall" data-name="${esc(name)}">Uninstall</button>`
                      : `<button class="px-3 py-1.5 rounded-lg bg-primary text-white hover:opacity-90" data-act="install" data-name="${esc(name)}">Install</button>`
                  }
                </div>
              </td>
            </tr>
          `;
        }).join("");

        tb.querySelectorAll("button[data-act]").forEach(btn=>{
          btn.addEventListener("click", async ()=>{
            const act = btn.getAttribute("data-act");
            const name = btn.getAttribute("data-name");
            if(!name) return;

            out.classList.remove("hidden");
            out.textContent = "Working…";

            let rr;
            if(act==="install"){
              rr = await install(name);
            } else if(act==="uninstall"){
              if(!confirm("Uninstall plugin?")) return;
              rr = await uninstall(name);
            } else {
              rr = await reconcile(name);
            }

            out.textContent = JSON.stringify(rr, null, 2);
            toast(rr.status, rr.status==="ok"?"success":"error");
            if(rr.status==="ok") await render();
          });
        });
      }

      host.querySelector("#btnReload")?.addEventListener("click", render);
      await render();
    }
  };
}
