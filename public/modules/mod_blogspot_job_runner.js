export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadStatus(){
    return await Orland.api("/api/blogspot/job_runner_status");
  }

  async function loadConfig(){
    return await Orland.api("/api/blogspot/job_runner_config");
  }

  async function saveConfig(payload){
    return await Orland.api("/api/blogspot/job_runner_config", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  async function runCron(secret = ""){
    return await Orland.api("/api/blogspot/job_runner_cron" + (secret ? `?cron_secret=${encodeURIComponent(secret)}` : ""), {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  async function unlockStale(){
    return await Orland.api("/api/blogspot/job_runner_unlock_stale", {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function badge(tone, text){
    const map = {
      emerald: "bg-emerald-100 text-emerald-700",
      amber: "bg-amber-100 text-amber-700",
      rose: "bg-rose-100 text-rose-700",
      sky: "bg-sky-100 text-sky-700",
      violet: "bg-violet-100 text-violet-700",
      slate: "bg-slate-100 text-slate-700"
    };
    return `<span class="px-2 py-1 rounded-full text-[11px] font-black ${map[tone] || map.slate}">${esc(text)}</span>`;
  }

  function workerStatusBadge(v){
    const s = String(v || "").toLowerCase();
    if(s === "success") return badge("emerald", "success");
    if(s === "running") return badge("violet", "running");
    if(s === "error") return badge("rose", "error");
    return badge("slate", s || "-");
  }

  return {
    title: "Blogspot Job Runner",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Job Runner</div>
                <div class="text-sm text-slate-500 mt-1">Autonomous cron driver, stale unlock, heartbeat, and runner controls.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnRunCron" class="px-4 py-3 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">
                  <i class="fa-solid fa-play mr-2"></i>Run Cron Once
                </button>
                <button id="btnUnlockStale" class="px-4 py-3 rounded-2xl border border-amber-200 text-amber-700 font-black text-sm">
                  <i class="fa-solid fa-unlock mr-2"></i>Unlock Stale
                </button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Runner Config</div>
              <form id="cfgForm" class="mt-4 space-y-4">
                <label class="flex items-center gap-3">
                  <input type="checkbox" id="runner_enabled">
                  <span class="font-semibold text-sm">Runner Enabled</span>
                </label>

                <label class="flex items-center gap-3">
                  <input type="checkbox" id="runner_paused">
                  <span class="font-semibold text-sm">Runner Paused</span>
                </label>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">Batch Limit</label>
                    <input id="batch_limit" type="number" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  </div>
                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">Stale Lock Sec</label>
                    <input id="stale_lock_sec" type="number" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  </div>
                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">Max Runtime Sec</label>
                    <input id="max_runtime_sec" type="number" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  </div>
                </div>

                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">Cron Secret</label>
                  <input id="cron_secret" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="optional secret">
                </div>

                <div>
                  <button type="submit" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Save Config</button>
                </div>
              </form>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Queue Counters</div>
              <div id="counterBox" class="mt-4 grid grid-cols-2 gap-3"></div>
            </div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Worker Heartbeat</div>
            <div id="workerBox" class="mt-4 space-y-3"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Last Action Output</div>
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

      function renderCounters(c){
        const items = [
          ["Queued", c?.queued_total || 0],
          ["Running", c?.running_total || 0],
          ["Success", c?.success_total || 0],
          ["Dead Letter", c?.dead_letter_total || 0]
        ];

        q("counterBox").innerHTML = items.map(([label, value]) => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="text-xs text-slate-500 font-bold">${esc(label)}</div>
            <div class="text-2xl font-extrabold mt-2">${esc(value)}</div>
          </div>
        `).join("");
      }

      function renderWorkers(items){
        if(!items.length){
          q("workerBox").innerHTML = `<div class="text-sm text-slate-500">No worker heartbeat yet.</div>`;
          return;
        }

        q("workerBox").innerHTML = items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="flex gap-2 flex-wrap">
                  ${workerStatusBadge(x.status)}
                </div>
                <div class="text-sm font-extrabold mt-3">${esc(x.worker_id || "-")}</div>
                <div class="text-xs text-slate-500 mt-1">heartbeat=${esc(fmtTs(x.last_heartbeat_at))}</div>
                <div class="text-xs text-slate-500 mt-1">started=${esc(fmtTs(x.last_started_at))} • finished=${esc(fmtTs(x.last_finished_at))}</div>
              </div>
            </div>
            <pre class="mt-3 text-[11px] whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 rounded-2xl p-3">${esc(JSON.stringify(x.last_result_json || {}, null, 2))}</pre>
          </div>
        `).join("");
      }

      async function render(){
        setMsg("muted", "Loading runner status...");
        const r = await loadStatus();
        const cfgRes = await loadConfig();

        if(r.status !== "ok"){
          q("actionBox").textContent = JSON.stringify(r, null, 2);
          setMsg("error", "Load status failed: " + r.status);
          return;
        }

        const d = r.data || {};
        renderCounters(d.counters || {});
        renderWorkers(Array.isArray(d.workers) ? d.workers : []);

        if(cfgRes.status === "ok"){
          const c = cfgRes.data || {};
          q("runner_enabled").checked = !!c.runner_enabled;
          q("runner_paused").checked = !!c.runner_paused;
          q("batch_limit").value = String(c.batch_limit ?? 10);
          q("stale_lock_sec").value = String(c.stale_lock_sec ?? 300);
          q("max_runtime_sec").value = String(c.max_runtime_sec ?? 20);
          q("cron_secret").value = String(c.cron_secret || "");
        }

        setMsg("success", "Runner status loaded.");
      }

      q("cfgForm").onsubmit = async (ev)=>{
        ev.preventDefault();
        setMsg("muted", "Saving runner config...");
        const r = await saveConfig({
          runner_enabled: q("runner_enabled").checked,
          runner_paused: q("runner_paused").checked,
          batch_limit: Number(q("batch_limit").value || 10),
          stale_lock_sec: Number(q("stale_lock_sec").value || 300),
          max_runtime_sec: Number(q("max_runtime_sec").value || 20),
          cron_secret: q("cron_secret").value
        });

        q("actionBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Save config failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Runner config saved.");
        await render();
      };

      q("btnReload").onclick = render;

      q("btnRunCron").onclick = async ()=>{
        setMsg("muted", "Running cron once...");
        const secret = String(q("cron_secret").value || "");
        const r = await runCron(secret);
        q("actionBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Cron run failed: " + (r.data?.error || r.status));
          return;
        }
        setMsg("success", "Cron runner executed.");
        await render();
      };

      q("btnUnlockStale").onclick = async ()=>{
        setMsg("muted", "Unlocking stale jobs...");
        const r = await unlockStale();
        q("actionBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Unlock stale failed: " + (r.data?.error || r.status));
          return;
        }
        setMsg("success", "Stale jobs unlocked.");
        await render();
      };

      await render();
    }
  };
}
