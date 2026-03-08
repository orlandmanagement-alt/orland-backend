export async function mount(ctx){
  const { host, api, toast } = ctx;

  host.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-2 justify-between">
        <div>
          <div class="text-sm font-bold">Alert Rules</div>
          <div class="text-xs text-slate-500">Rules untuk metrics (rate_limited / lockouts / password_fail / session_anomaly)</div>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button id="btnReload" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Reload</button>
          <button id="btnNew" class="text-xs px-3 py-2 rounded-lg bg-slate-900 text-white">New</button>
        </div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-2">
        <div id="tbl" class="text-[12px] text-slate-500">Loading…</div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4 space-y-2">
        <div class="text-xs font-bold">Edit / Create</div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input id="id" disabled class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="id">
          <input id="metric" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="metric (e.g. rate_limited)">
          <select id="sev" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option>low</option><option selected>medium</option><option>high</option><option>critical</option>
          </select>
          <input id="window" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="window_minutes" value="15">
          <input id="threshold" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="threshold" value="10">
          <input id="cooldown" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="cooldown_minutes" value="60">
          <select id="enabled" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2">
            <option value="1" selected>enabled</option>
            <option value="0">disabled</option>
          </select>
        </div>

        <div class="flex gap-2 flex-wrap">
          <button id="btnSave" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Save</button>
          <button id="btnToggle" class="text-xs px-3 py-2 rounded-lg bg-warning text-white">Enable/Disable</button>
          <button id="btnDel" class="text-xs px-3 py-2 rounded-lg bg-danger text-white">Delete</button>
          <button id="btnClear" class="text-xs px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300">Clear</button>
        </div>

        <details><summary class="text-xs text-slate-500">Debug</summary><pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap"></pre></details>
      </div>
    </div>
  `;

  const el=(id)=>document.getElementById(id);
  const clear=()=>{
    el("id").value=""; el("metric").value="rate_limited"; el("sev").value="medium";
    el("window").value="15"; el("threshold").value="10"; el("cooldown").value="60"; el("enabled").value="1";
  };
  const fill=(x)=>{
    el("id").value=x.id||""; el("metric").value=x.metric||"";
    el("sev").value=x.severity||"medium"; el("window").value=String(x.window_minutes||15);
    el("threshold").value=String(x.threshold||10); el("cooldown").value=String(x.cooldown_minutes||60);
    el("enabled").value=String(x.enabled||0);
  };

  async function load(){
    const r = await api("/api/ops/alert-rules");
    el("dbg").textContent = JSON.stringify(r,null,2);
    if(r.status!=="ok"){ toast("Failed: "+r.status,"error"); return; }
    const rows=r.data.rows||[];
    el("tbl").innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="text-slate-500">
            <tr><th class="text-left py-2">Metric</th><th class="text-left py-2">Window</th><th class="text-left py-2">Threshold</th><th class="text-left py-2">Severity</th><th class="text-left py-2">Enabled</th><th class="text-right py-2">Action</th></tr>
          </thead>
          <tbody>
            ${rows.map(x=>`
              <tr class="border-t border-slate-100 dark:border-darkBorder">
                <td class="py-2 font-semibold"><code>${x.metric||""}</code></td>
                <td class="py-2">${x.window_minutes}</td>
                <td class="py-2">${x.threshold}</td>
                <td class="py-2">${x.severity}</td>
                <td class="py-2">${x.enabled? "1":"0"}</td>
                <td class="py-2 text-right">
                  <button class="px-2 py-1 rounded bg-slate-200 hover:bg-slate-300" data-pick='${encodeURIComponent(JSON.stringify(x))}'>Edit</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    el("tbl").querySelectorAll("[data-pick]").forEach(b=>{
      b.onclick=()=>fill(JSON.parse(decodeURIComponent(b.getAttribute("data-pick"))));
    });
  }

  el("btnReload").onclick = load;
  el("btnNew").onclick = ()=>{ clear(); toast("Fill then Save","info"); };
  el("btnClear").onclick = clear;

  el("btnSave").onclick = async ()=>{
    const id = el("id").value.trim();
    const payload = {
      id: id || null,
      metric: el("metric").value.trim(),
      window_minutes: Number(el("window").value||15),
      threshold: Number(el("threshold").value||10),
      severity: el("sev").value,
      cooldown_minutes: Number(el("cooldown").value||60),
      enabled: Number(el("enabled").value||1)
    };
    if(!payload.metric) return toast("metric required","error");

    const r = id
      ? await api("/api/ops/alert-rules", { method:"PUT", body: JSON.stringify(payload) })
      : await api("/api/ops/alert-rules", { method:"POST", body: JSON.stringify(payload) });

    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ await load(); if(!id) clear(); }
  };

  el("btnToggle").onclick = async ()=>{
    const id = el("id").value.trim();
    if(!id) return toast("Pick rule first","error");
    const enabled = Number(el("enabled").value||0);
    const action = enabled ? "disable" : "enable";
    const r = await api("/api/ops/alert-rules", { method:"PUT", body: JSON.stringify({ id, action }) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ el("enabled").value = enabled ? "0":"1"; await load(); }
  };

  el("btnDel").onclick = async ()=>{
    const id = el("id").value.trim();
    if(!id) return toast("Pick rule first","error");
    if(!confirm("Delete rule? (super_admin only)")) return;
    const r = await api("/api/ops/alert-rules?id="+encodeURIComponent(id), { method:"DELETE" });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok"){ clear(); await load(); }
  };

  clear();
  await load();
}
