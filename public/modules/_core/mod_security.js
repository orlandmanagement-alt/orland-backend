import { fmtNum } from "../../assets/js/orland_ui.js";

export default function(Orland){
  async function loadMetrics(days=7){
    return await Orland.api("/api/security/metrics?days=" + encodeURIComponent(days));
  }

  function card(title, id, hint=""){
    return `
      <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
        <div class="text-[11px] font-bold text-slate-500">${title}</div>
        <div id="${id}" class="text-2xl font-black mt-1">—</div>
        ${hint ? `<div class="text-[11px] text-slate-500 mt-1">${hint}</div>` : ``}
      </div>
    `;
  }

  return {
    title: "Security",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-7xl">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div class="text-xl font-extrabold text-slate-900 dark:text-white">Security</div>
              <div class="text-sm text-slate-500">Ringkasan keamanan, auth event, session, incident, dan alert rule.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <select id="daysSel" class="px-3 py-2 rounded-xl text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                <option value="1">1 day</option>
                <option value="7" selected>7 days</option>
                <option value="30">30 days</option>
              </select>
              <button id="btnReload" class="px-4 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
                Reload
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            ${card("Rate limited", "k_rate_limited")}
            ${card("Lockouts", "k_lockouts")}
            ${card("OTP send fail", "k_otp_send_fail")}
            ${card("OTP verify fail", "k_otp_verify_fail")}
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            ${card("Password fail", "k_password_fail")}
            ${card("Session anomaly", "k_session_anomaly")}
            ${card("Incidents created", "k_incidents_created")}
            ${card("Active sessions", "k_active_sessions")}
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            ${card("OTP requests total", "k_otp_requests_total")}
            ${card("OTP consumed", "k_otp_consumed")}
            ${card("OTP expired", "k_otp_expired")}
            ${card("Rules total", "k_rules_total")}
          </div>

          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            ${card("Rules enabled", "k_rules_enabled")}
            ${card("Rules fired", "k_rules_fired", "Jumlah rule yang pernah fired dalam window.")}
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="text-sm font-extrabold">Notes</div>
            <div id="notesBox" class="text-xs text-slate-500 mt-2 space-y-1">
              <div>Loading...</div>
            </div>
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="text-sm font-extrabold">Quick Security Actions</div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <button id="goPolicy" class="px-3 py-3 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left">
                <div class="text-xs font-black"><i class="fa-solid fa-shield-halved me-2"></i>Security Policy</div>
                <div class="text-[11px] text-slate-500 mt-1">Open policy module</div>
              </button>

              <button id="goIpBlocks" class="px-3 py-3 rounded-xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-left">
                <div class="text-xs font-black"><i class="fa-solid fa-ban me-2"></i>IP Blocks</div>
                <div class="text-[11px] text-slate-500 mt-1">Manage blocked IPs</div>
              </button>

              <button id="sendAnomaly" class="px-3 py-3 rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 text-left">
                <div class="text-xs font-black"><i class="fa-solid fa-triangle-exclamation me-2"></i>Trigger Test Anomaly</div>
                <div class="text-[11px] text-slate-500 mt-1">Write a manual session_anomaly audit</div>
              </button>
            </div>

            <div id="actionMsg" class="mt-3 text-xs"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);

      async function render(){
        const days = Number(q("daysSel").value || 7);
        const r = await loadMetrics(days);

        if(r.status !== "ok"){
          q("notesBox").innerHTML = `<div class="text-red-500">Failed: ${String(r.status || "server_error")}</div>`;
          return;
        }

        const d = r.data || {};

        q("k_rate_limited").textContent = fmtNum(d.rate_limited);
        q("k_lockouts").textContent = fmtNum(d.lockouts);
        q("k_otp_send_fail").textContent = fmtNum(d.otp_send_fail);
        q("k_otp_verify_fail").textContent = fmtNum(d.otp_verify_fail);
        q("k_password_fail").textContent = fmtNum(d.password_fail);
        q("k_session_anomaly").textContent = fmtNum(d.session_anomaly);
        q("k_incidents_created").textContent = fmtNum(d.incidents_created);
        q("k_active_sessions").textContent = fmtNum(d.active_sessions);
        q("k_otp_requests_total").textContent = fmtNum(d.otp_requests_total);
        q("k_otp_consumed").textContent = fmtNum(d.otp_consumed);
        q("k_otp_expired").textContent = fmtNum(d.otp_expired);
        q("k_rules_total").textContent = fmtNum(d.rules_total);
        q("k_rules_enabled").textContent = fmtNum(d.rules_enabled);
        q("k_rules_fired").textContent = fmtNum(d.rules_fired);

        const notes = [];
        notes.push(`<div><b>Window:</b> ${fmtNum(d.days)} day(s)</div>`);
        notes.push(`<div><b>Source:</b> ${String(d.source || "n/a")}</div>`);
        notes.push(`<div><b>Interpretation:</b> rate_limited, password_fail, otp_verify_fail, session_anomaly, dan lockouts diambil dari metrics backend.</div>`);

        if(Number(d.lockouts || 0) > 0){
          notes.push(`<div class="text-amber-600"><b>Warning:</b> lockout terdeteksi dalam window ini.</div>`);
        }
        if(Number(d.rate_limited || 0) > 0){
          notes.push(`<div class="text-amber-600"><b>Warning:</b> ada request kena rate limit.</div>`);
        }
        if(Number(d.session_anomaly || 0) > 0){
          notes.push(`<div class="text-amber-600"><b>Warning:</b> ada session anomaly tercatat.</div>`);
        }
        if(Number(d.rules_enabled || 0) === 0 && Number(d.rules_total || 0) > 0){
          notes.push(`<div class="text-slate-500"><b>Note:</b> alert rules ada, tetapi tidak ada yang enabled.</div>`);
        }

        q("notesBox").innerHTML = notes.join("");
      }

      q("btnReload").onclick = render;
      q("daysSel").onchange = render;

      q("goPolicy").onclick = ()=>Orland.navigate("/security/policy");
      q("goIpBlocks").onclick = ()=>Orland.navigate("/ipblocks");

      q("sendAnomaly").onclick = async ()=>{
        const msg = q("actionMsg");
        msg.className = "mt-3 text-xs text-slate-500";
        msg.textContent = "Sending...";
        const r = await Orland.api("/api/security/anomaly", {
          method:"POST",
          body: JSON.stringify({
            kind:"manual_test",
            note:"Triggered from security module"
          })
        });
        if(r.status !== "ok"){
          msg.className = "mt-3 text-xs text-red-500";
          msg.textContent = "Failed: " + r.status;
          return;
        }
        msg.className = "mt-3 text-xs text-emerald-600";
        msg.textContent = "Anomaly recorded.";
        await render();
      };

      await render();
    }
  };
}
