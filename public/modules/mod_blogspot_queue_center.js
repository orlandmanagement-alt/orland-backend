export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadQueue(limit = 50){
    return await Orland.api("/api/blogspot/job_queue?limit=" + encodeURIComponent(String(limit)));
  }

  async function loadDead(limit = 50){
    return await Orland.api("/api/blogspot/job_dead_letter?limit=" + encodeURIComponent(String(limit)));
  }

  function badge(v){
    const s = String(v || "").toLowerCase();
    if(s === "queued") return `<span class="px-2 py-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-black">queued</span>`;
    if(s === "running") return `<span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">running</span>`;
    if(s === "success") return `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">success</span>`;
    if(s === "dead_letter") return `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">dead letter</span>`;
    return `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(s || "-")}</span>`;
  }

  return {
    title:"Blogspot Queue Center",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold">Blogspot Queue Center</div>
              <div class="text-sm text-slate-500">Inspect queued jobs and dead letter snapshot.</div>
            </div>
            <button id="btnReload" class="px-4 py-3 rounded-2xl border font-black text-sm">Reload</button>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border p-5">
              <div class="text-xl font-extrabold">Queue</div>
              <div id="queueBox" class="mt-4 space-y-3"></div>
            </div>
            <div class="rounded-3xl border p-5">
              <div class="text-xl font-extrabold">Dead Letter</div>
              <div id="deadBox" class="mt-4 space-y-3"></div>
            </div>
          </div>
        </div>
      `;

      const q = id => host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderQueue(items){
        q("queueBox").innerHTML = !items.length
          ? `<div class="text-sm text-slate-500">No queue items.</div>`
          : items.map(x => `
            <div class="rounded-2xl border p-4">
              <div class="flex gap-2 flex-wrap">
                ${badge(x.status)}
                <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.job_type || "-")}</span>
              </div>
              <div class="text-xs text-slate-500 mt-2">${esc(x.id || "-")}</div>
              <pre class="mt-3 text-[11px] whitespace-pre-wrap break-words bg-slate-50 rounded-2xl p-3">${esc(JSON.stringify(x.payload_json || {}, null, 2))}</pre>
            </div>
          `).join("");
      }

      function renderDead(items){
        q("deadBox").innerHTML = !items.length
          ? `<div class="text-sm text-slate-500">No dead letter items.</div>`
          : items.map(x => `
            <div class="rounded-2xl border border-rose-200 p-4">
              <div class="flex gap-2 flex-wrap">
                ${badge("dead_letter")}
                <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.job_type || "-")}</span>
              </div>
              <div class="text-xs text-slate-500 mt-2">${esc(x.source_job_id || "-")}</div>
              <div class="text-xs text-rose-600 mt-2 break-words">${esc(x.last_error || "-")}</div>
              <pre class="mt-3 text-[11px] whitespace-pre-wrap break-words bg-slate-50 rounded-2xl p-3">${esc(JSON.stringify(x.payload_json || {}, null, 2))}</pre>
            </div>
          `).join("");
      }

      async function render(){
        setMsg("muted", "Loading queue...");
        const [qRes, dRes] = await Promise.all([loadQueue(50), loadDead(50)]);

        if(qRes.status !== "ok" && dRes.status !== "ok"){
          setMsg("error", "Queue center load failed.");
          return;
        }

        renderQueue(Array.isArray(qRes.data?.items) ? qRes.data.items : []);
        renderDead(Array.isArray(dRes.data?.items) ? dRes.data.items : []);
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      await render();
    }
  };
}
