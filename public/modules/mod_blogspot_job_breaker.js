export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadStatus(){ return await Orland.api("/api/blogspot/job_breaker_status"); }
  async function saveConfig(payload){
    return await Orland.api("/api/blogspot/job_breaker_config", {
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

  return {
    title: "Blogspot Circuit Breaker",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">Blogspot Circuit Breaker</div>
                <div class="text-sm text-slate-500 mt-1">Upstream health state and quota warning monitor.</div>
              </div>
              <button id="btnReload" class="px-4 py-3 rounded-2xl border font-black text-sm">Reload</button>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <form id="cfgForm" class="rounded-3xl border border-slate-200 p-5 space-y-4">
              <div class="text-xl font-extrabold">Breaker Config</div>
              <label class="flex items-center gap-3"><input id="breaker_enabled" type="checkbox"><span class="font-semibold text-sm">Breaker Enabled</span></label>
              <div class="grid grid-cols-2 gap-4">
                <div><label class="block text-sm font-bold text-slate-500 mb-2">Fail Threshold</label><input id="fail_threshold" type="number" class="w-full px-4 py-3 rounded-2xl border"></div>
                <div><label class="block text-sm font-bold text-slate-500 mb-2">Reopen Sec</label><input id="reopen_sec" type="number" class="w-full px-4 py-3 rounded-2xl border"></div>
                <div><label class="block text-sm font-bold text-slate-500 mb-2">Half Open Success Needed</label><input id="half_open_success_needed" type="number" class="w-full px-4 py-3 rounded-2xl border"></div>
                <div><label class="block text-sm font-bold text-slate-500 mb-2">Warn Threshold / Minute</label><input id="quota_warn_threshold_minute" type="number" class="w-full px-4 py-3 rounded-2xl border"></div>
                <div><label class="block text-sm font-bold text-slate-500 mb-2">Warn Threshold / Day</label><input id="quota_warn_threshold_day" type="number" class="w-full px-4 py-3 rounded-2xl border"></div>
              </div>
              <button class="px-4 py-3 rounded-2xl bg-black text-white font-black text-sm">Save</button>
            </form>

            <div class="rounded-3xl border border-slate-200 p-5">
              <div class="text-xl font-extrabold">Status JSON</div>
              <pre id="statusBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 rounded-2xl p-4">{}</pre>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 p-5">
              <div class="text-xl font-extrabold">Upstream Health</div>
              <div id="healthBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-3xl border border-slate-200 p-5">
              <div class="text-xl font-extrabold">Quota State</div>
              <div id="quotaBox" class="mt-4 space-y-3"></div>
            </div>
          </div>
        </div>
      `;

      const q = id => host.querySelector("#" + id);
      const setMsg = (t, s) => { q("msg").className = `mt-4 text-sm ${t==="error"?"text-red-500":t==="success"?"text-emerald-600":"text-slate-500"}`; q("msg").textContent = s; };

      async function render(){
        setMsg("muted", "Loading...");
        const r = await loadStatus();
        q("statusBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){ setMsg("error", "Load failed"); return; }

        const c = r.data?.config || {};
        q("breaker_enabled").checked = !!c.breaker_enabled;
        q("fail_threshold").value = c.fail_threshold ?? 5;
        q("reopen_sec").value = c.reopen_sec ?? 300;
        q("half_open_success_needed").value = c.half_open_success_needed ?? 2;
        q("quota_warn_threshold_minute").value = c.quota_warn_threshold_minute ?? 60;
        q("quota_warn_threshold_day").value = c.quota_warn_threshold_day ?? 2000;

        const health = Array.isArray(r.data?.summary?.health) ? r.data.summary.health : [];
        const quota = Array.isArray(r.data?.summary?.quota) ? r.data.summary.quota : [];

        q("healthBox").innerHTML = !health.length
          ? `<div class="text-sm text-slate-500">No health records.</div>`
          : health.map(x => `
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="text-sm font-extrabold">${esc(x.scope_key || "-")}</div>
              <div class="text-xs text-slate-500 mt-1">state=${esc(x.breaker_state || "-")} • fail=${esc(x.fail_count || 0)} • success=${esc(x.success_count || 0)}</div>
              <div class="text-xs text-slate-500 mt-1">reopen_after=${esc(fmtTs(x.reopen_after || 0))}</div>
              ${x.last_error ? `<div class="text-xs text-red-500 mt-2">${esc(x.last_error)}</div>` : ``}
            </div>
          `).join("");

        q("quotaBox").innerHTML = !quota.length
          ? `<div class="text-sm text-slate-500">No quota records.</div>`
          : quota.map(x => `
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="text-sm font-extrabold">${esc(x.scope_key || "-")}</div>
              <div class="text-xs text-slate-500 mt-1">minute=${esc(x.minute_count || 0)} / ${esc(x.warn_threshold_minute || 0)}</div>
              <div class="text-xs text-slate-500 mt-1">day=${esc(x.day_count || 0)} / ${esc(x.warn_threshold_day || 0)}</div>
              <div class="text-xs text-slate-400 mt-1">updated=${esc(fmtTs(x.updated_at || 0))}</div>
            </div>
          `).join("");

        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("cfgForm").onsubmit = async (e)=>{
        e.preventDefault();
        setMsg("muted", "Saving...");
        const r = await saveConfig({
          breaker_enabled: q("breaker_enabled").checked,
          fail_threshold: Number(q("fail_threshold").value || 5),
          reopen_sec: Number(q("reopen_sec").value || 300),
          half_open_success_needed: Number(q("half_open_success_needed").value || 2),
          quota_warn_threshold_minute: Number(q("quota_warn_threshold_minute").value || 60),
          quota_warn_threshold_day: Number(q("quota_warn_threshold_day").value || 2000)
        });
        q("statusBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){ setMsg("error", "Save failed"); return; }
        setMsg("success", "Saved.");
        await render();
      };

      await render();
    }
  };
}
