export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadQueue(status = "", job_type = "", limit = 100){
    const q = new URLSearchParams();
    if(status) q.set("status", status);
    if(job_type) q.set("job_type", job_type);
    q.set("limit", String(limit || 100));
    return await Orland.api("/api/blogspot/job_queue?" + q.toString());
  }

  async function runBatch(limit = 10, worker_id = ""){
    return await Orland.api("/api/blogspot/job_run_batch", {
      method: "POST",
      body: JSON.stringify({ limit, worker_id })
    });
  }

  async function loadDead(job_type = "", limit = 100){
    const q = new URLSearchParams();
    if(job_type) q.set("job_type", job_type);
    q.set("limit", String(limit || 100));
    return await Orland.api("/api/blogspot/job_dead_letter?" + q.toString());
  }

  async function requeueDead(dead_letter_id){
    return await Orland.api("/api/blogspot/job_requeue_dead_letter", {
      method: "POST",
      body: JSON.stringify({ dead_letter_id })
    });
  }

  async function enqueueJob(payload){
    return await Orland.api("/api/blogspot/job_enqueue", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function badge(kind, text){
    const map = {
      amber: "bg-amber-100 text-amber-700",
      cyan: "bg-cyan-100 text-cyan-700",
      rose: "bg-rose-100 text-rose-700",
      sky: "bg-sky-100 text-sky-700",
      violet: "bg-violet-100 text-violet-700",
      emerald: "bg-emerald-100 text-emerald-700",
      slate: "bg-slate-100 text-slate-700"
    };
    return `<span class="px-2 py-1 rounded-full text-[11px] font-black ${map[kind] || map.slate}">${esc(text)}</span>`;
  }

  function statusBadge(v){
    const s = String(v || "").toLowerCase();
    if(s === "queued") return badge("sky", "queued");
    if(s === "running") return badge("violet", "running");
    if(s === "success") return badge("emerald", "success");
    if(s === "dead_letter") return badge("rose", "dead_letter");
    if(s === "failed") return badge("rose", "failed");
    return badge("slate", s || "-");
  }

  return {
    title: "Blogspot Job Queue",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Job Queue</div>
                <div class="text-sm text-slate-500 mt-1">Queue, retry, runner, and dead-letter monitor for Blogspot jobs.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnRunBatch" class="px-4 py-3 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">
                  <i class="fa-solid fa-play mr-2"></i>Run Batch
                </button>
                <button id="btnEnqueueSync" class="px-4 py-3 rounded-2xl border border-sky-200 text-sky-700 font-black text-sm">
                  <i class="fa-solid fa-plus mr-2"></i>Enqueue Sync
                </button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Job Queue</div>
                <div class="flex gap-2 flex-wrap">
                  <select id="fStatus" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    <option value="">all status</option>
                    <option value="queued">queued</option>
                    <option value="running">running</option>
                    <option value="success">success</option>
                    <option value="dead_letter">dead_letter</option>
                  </select>
                  <select id="fType" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    <option value="">all type</option>
                    <option value="publish_post">publish_post</option>
                    <option value="publish_page">publish_page</option>
                    <option value="refresh_remote_post">refresh_remote_post</option>
                    <option value="refresh_remote_page">refresh_remote_page</option>
                    <option value="sync_run">sync_run</option>
                    <option value="resolve_conflict">resolve_conflict</option>
                    <option value="delete_remote_post">delete_remote_post</option>
                    <option value="delete_remote_page">delete_remote_page</option>
                  </select>
                </div>
              </div>
              <div id="queueBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Dead Letter</div>
                <button id="btnReloadDead" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Refresh</button>
              </div>
              <div id="deadBox" class="mt-4 space-y-3"></div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Runner Output</div>
            <pre id="actionBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-2xl p-4">{}</pre>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderQueue(items){
        if(!items.length){
          q("queueBox").innerHTML = `<div class="text-sm text-slate-500">No jobs.</div>`;
          return;
        }

        q("queueBox").innerHTML = items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex gap-2 flex-wrap">
                  ${statusBadge(x.status)}
                  ${badge("slate", x.job_type || "-")}
                </div>
                <div class="text-sm font-extrabold mt-3">${esc(x.id || "-")}</div>
                <div class="text-xs text-slate-500 mt-1">
                  priority=${esc(x.priority)} • attempt=${esc(x.attempt_count)}/${esc(x.max_attempts)}
                </div>
                <div class="text-xs text-slate-500 mt-1">
                  created=${esc(fmtTs(x.created_at))} • run_after=${esc(fmtTs(x.run_after))}
                </div>
                ${x.last_error ? `<div class="text-xs text-rose-600 mt-2">${esc(x.last_error)}</div>` : ``}
              </div>
            </div>
            <details class="mt-3">
              <summary class="cursor-pointer text-xs font-black text-slate-500">Payload / Result</summary>
              <pre class="mt-3 text-[11px] whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 rounded-2xl p-3">${esc(JSON.stringify({ payload_json: x.payload_json, result_json: x.result_json }, null, 2))}</pre>
            </details>
          </div>
        `).join("");
      }

      function renderDead(items){
        if(!items.length){
          q("deadBox").innerHTML = `<div class="text-sm text-slate-500">No dead letter jobs.</div>`;
          return;
        }

        q("deadBox").innerHTML = items.map(x => `
          <div class="rounded-2xl border border-rose-200 p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex gap-2 flex-wrap">
                  ${badge("rose", "dead_letter")}
                  ${badge("slate", x.job_type || "-")}
                </div>
                <div class="text-sm font-extrabold mt-3">${esc(x.id || "-")}</div>
                <div class="text-xs text-slate-500 mt-1">
                  source_job=${esc(x.source_job_id || "-")} • attempt=${esc(x.attempt_count)}/${esc(x.max_attempts)}
                </div>
                <div class="text-xs text-slate-500 mt-1">moved_at=${esc(fmtTs(x.moved_at))}</div>
                ${x.last_error ? `<div class="text-xs text-rose-600 mt-2">${esc(x.last_error)}</div>` : ``}
              </div>
              <div>
                <button class="btnRequeue px-3 py-2 rounded-xl border border-sky-200 text-sky-700 text-xs font-black" data-id="${esc(x.id)}">Requeue</button>
              </div>
            </div>
            <details class="mt-3">
              <summary class="cursor-pointer text-xs font-black text-slate-500">Payload</summary>
              <pre class="mt-3 text-[11px] whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 rounded-2xl p-3">${esc(JSON.stringify(x.payload_json || {}, null, 2))}</pre>
            </details>
          </div>
        `).join("");

        q("deadBox").querySelectorAll(".btnRequeue").forEach(btn => {
          btn.onclick = async ()=>{
            const id = String(btn.getAttribute("data-id") || "");
            setMsg("muted", "Requeueing dead letter...");
            const r = await requeueDead(id);
            q("actionBox").textContent = JSON.stringify(r, null, 2);
            if(r.status !== "ok"){
              setMsg("error", "Requeue failed: " + (r.data?.error || r.status));
              return;
            }
            setMsg("success", "Dead letter requeued.");
            await renderAll();
          };
        });
      }

      async function renderAll(){
        setMsg("muted", "Loading job queue...");
        const [qr, dr] = await Promise.all([
          loadQueue(q("fStatus").value, q("fType").value, 100),
          loadDead("", 100)
        ]);

        if(qr.status !== "ok"){
          q("queueBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(qr, null, 2))}</pre>`;
        }else{
          renderQueue(Array.isArray(qr.data?.items) ? qr.data.items : []);
        }

        if(dr.status !== "ok"){
          q("deadBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(dr, null, 2))}</pre>`;
        }else{
          renderDead(Array.isArray(dr.data?.items) ? dr.data.items : []);
        }

        setMsg("success", "Job queue loaded.");
      }

      q("btnReload").onclick = renderAll;
      q("btnReloadDead").onclick = renderAll;
      q("fStatus").onchange = renderAll;
      q("fType").onchange = renderAll;

      q("btnRunBatch").onclick = async ()=>{
        const worker_id = `manual_${Date.now()}`;
        setMsg("muted", "Running batch...");
        const r = await runBatch(10, worker_id);
        q("actionBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Run batch failed: " + (r.data?.error || r.status));
          return;
        }
        setMsg("success", "Batch runner executed.");
        await renderAll();
      };

      q("btnEnqueueSync").onclick = async ()=>{
        setMsg("muted", "Enqueue sync_run...");
        const r = await enqueueJob({
          job_type: "sync_run",
          payload_json: {},
          priority: 20,
          max_attempts: 3
        });
        q("actionBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Enqueue failed: " + (r.data?.error || r.status));
          return;
        }
        setMsg("success", "sync_run enqueued.");
        await renderAll();
      };

      await renderAll();
    }
  };
}
