export default function(Orland){
  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  function toast(msg,type="info"){
    const host=document.getElementById("toast-host");
    if(!host){alert(msg);return;}
    const d=document.createElement("div");
    d.className="fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    d.innerHTML=`<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(d); setTimeout(()=>d.remove(),2800);
  }

  async function metrics(days){ return await Orland.api("/api/security/metrics?days="+encodeURIComponent(days||7)); }
  async function hourly(days){ return await Orland.api("/api/security/hourly?days="+encodeURIComponent(days||7)); }
  async function top(kind, minutes, limit){
    return await Orland.api("/api/security/ip-activity?kind="+encodeURIComponent(kind)+"&minutes="+encodeURIComponent(minutes||240)+"&limit="+encodeURIComponent(limit||20));
  }

  return {
    title:"Security",
    async mount(host){
      host.innerHTML=`
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div class="lg:col-span-2 bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-base font-bold">Security Dashboard</div>
              <div class="text-xs text-slate-500 mt-1">Metrics & anomaly from D1 hourly_metrics + ip_activity.</div>
            </div>
            <div class="flex gap-2 items-center">
              <select id="days" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs">
                <option value="3">3d</option>
                <option value="7" selected>7d</option>
                <option value="14">14d</option>
                <option value="30">30d</option>
              </select>
              <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active IP Blocks</div>
              <div id="k1" class="text-2xl font-bold mt-1">—</div>
            </div>
            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Password Fail</div>
              <div id="k2" class="text-2xl font-bold mt-1">—</div>
            </div>
            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Rate Limited</div>
              <div id="k3" class="text-2xl font-bold mt-1">—</div>
            </div>
            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
              <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session Anomaly</div>
              <div id="k4" class="text-2xl font-bold mt-1">—</div>
            </div>
          </div>

          <div class="mt-4 rounded-xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="text-sm font-bold mb-2">Trend (hourly)</div>
            <div class="h-[320px]"><canvas id="secChart"></canvas></div>
            <div class="text-[10px] text-slate-500 mt-2">Jika chart kosong: pastikan endpoint `/api/security/hourly` tersedia.</div>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="text-base font-bold">Top IP Activity</div>
          <div class="text-xs text-slate-500 mt-1">Hot IP hashes (password_fail).</div>

          <div class="mt-3 flex gap-2">
            <select id="kind" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs w-full">
              <option value="password_fail" selected>password_fail</option>
              <option value="otp_fail">otp_fail</option>
              <option value="session_anom">session_anom</option>
            </select>
            <button id="btnTop" class="px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">Load</button>
          </div>

          <div id="topBox" class="mt-3 text-xs text-slate-500">—</div>
        </div>
      </div>`;

      const daysEl=host.querySelector("#days");
      const k1=host.querySelector("#k1");
      const k2=host.querySelector("#k2");
      const k3=host.querySelector("#k3");
      const k4=host.querySelector("#k4");
      const topBox=host.querySelector("#topBox");
      const kindEl=host.querySelector("#kind");
      const btnTop=host.querySelector("#btnTop");
      let chart=null;

      function sum(series, key){ return (series||[]).reduce((a,x)=>a+Number(x?.[key]||0),0); }

      async function loadAll(){
        const days=Number(daysEl.value||7);
        const m=await metrics(days);
        if(m.status!=="ok"){ toast("metrics: "+m.status,"error"); return; }
        const series=m.data?.series||[];
        k1.textContent=String(m.data?.active_ip_blocks ?? 0);
        k2.textContent=String(sum(series,"password_fail"));
        k3.textContent=String(sum(series,"rate_limited"));
        k4.textContent=String(sum(series,"session_anomaly"));

        // chart
        const h=await hourly(days);
        if(h.status!=="ok"){ toast("hourly: "+h.status,"error"); return; }
        const rows=h.data?.rows||[];
        const labels=rows.map(x=> {
          try{ return new Date(Number(x.hour_epoch||0)*1000).toISOString().slice(5,13).replace("T"," "); }catch{ return ""; }
        });
        const pw=rows.map(x=>Number(x.password_fail||0));
        const an=rows.map(x=>Number(x.session_anomaly||0));
        const ot=rows.map(x=>Number(x.otp_verify_fail||0));
        const ctx=host.querySelector("#secChart")?.getContext("2d");
        if(!ctx) return;

        if(chart){ chart.destroy(); chart=null; }
        chart=new Chart(ctx,{
          type:"line",
          data:{ labels, datasets:[
            { label:"password_fail", data: pw, borderWidth:2, tension:.35, fill:false },
            { label:"session_anomaly", data: an, borderWidth:2, tension:.35, fill:false },
            { label:"otp_verify_fail", data: ot, borderWidth:2, tension:.35, fill:false }
          ]},
          options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:"top" } }, scales:{ x:{ ticks:{ maxTicksLimit:8 } } } }
        });
      }

      async function loadTop(){
        const kind=String(kindEl.value||"password_fail");
        const r=await top(kind, 240, 20);
        if(r.status!=="ok"){ topBox.innerHTML=`<div class="text-red-400">Failed: ${esc(r.status)}</div>`; return; }
        const rows=r.data?.rows||[];
        if(!rows.length){ topBox.innerHTML=`<div class="text-slate-500">No data</div>`; return; }
        topBox.innerHTML=`
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs whitespace-nowrap">
              <thead class="text-slate-500 border-b border-slate-200 dark:border-darkBorder">
                <tr><th class="py-2 pr-2">ip_hash</th><th class="py-2 pr-2">total</th><th class="py-2">last_seen</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
                ${rows.map(x=>`
                  <tr>
                    <td class="py-2 pr-2"><code>${esc(x.ip_hash||"")}</code></td>
                    <td class="py-2 pr-2 font-bold">${esc(String(x.total||0))}</td>
                    <td class="py-2 text-slate-500">${esc(String(x.last_seen_at||""))}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>`;
      }

      host.querySelector("#btnReload").onclick=loadAll;
      daysEl.addEventListener("change", loadAll);
      btnTop.onclick=loadTop;

      await loadAll();
      await loadTop();
    }
  };
}
