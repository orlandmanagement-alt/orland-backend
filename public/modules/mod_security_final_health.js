import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadHealth(){
    return await Orland.api("/api/security/final-health");
  }

  function badge(ok, yes = "OK", no = "ISSUE"){
    return ok
      ? `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">${yes}</span>`
      : `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">${no}</span>`;
  }

  return {
    title:"Security Final Health",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: ["super_admin", "admin", "security_admin", "audit_admin"],
        title: "Security Final Health Restricted",
        desc: "Hanya role admin/security/audit yang boleh membuka final health dashboard."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-7xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold ui-title-gradient">Security Final Stabilization Health</div>
                <div class="text-sm text-slate-500 mt-1">Final check untuk auth, sessions, RBAC, menus, MFA, audit, dan bootstrap state.</div>
              </div>
              <button id="btnReload" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Reload</button>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div id="summaryBox" class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3"></div>

          <div class="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">
            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Checks</div>
              <div id="checksBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Tables</div>
              <div id="tablesBox" class="mt-4 space-y-3"></div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else if(kind === "warning") q("msg").classList.add("text-amber-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderSummary(data){
        const counts = data.counts || {};
        const items = [
          ["USERS", counts.users ?? "-"],
          ["SESSIONS", counts.sessions ?? "-"],
          ["ROLES", counts.roles ?? "-"],
          ["MENUS", counts.menus ?? "-"],
          ["AUDIT", counts.audit_logs ?? "-"],
          ["IP BLOCKS", counts.ip_blocks ?? "-"]
        ];

        q("summaryBox").innerHTML = items.map(([label, value]) => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="text-[11px] text-slate-500 font-bold">${esc(label)}</div>
            <div class="mt-2 text-2xl font-extrabold">${esc(value)}</div>
          </div>
        `).join("");
      }

      function renderChecks(data){
        const checks = data.checks || {};
        const items = [
          ["Overall Health", !!data.health_ok],
          ["Roles Seed Present", !!checks.roles_seed_present],
          ["Menus Seed Present", !!checks.menus_seed_present],
          ["Bootstrap Locked", !!checks.bootstrap_locked],
          ["Verification Policy Present", !!checks.verification_policy_present],
          ["MFA Policy Present", !!checks.mfa_policy_present]
        ];

        q("checksBox").innerHTML = items.map(([label, ok]) => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4 flex items-center justify-between gap-3">
            <div class="text-sm font-semibold">${esc(label)}</div>
            <div>${badge(ok)}</div>
          </div>
        `).join("");
      }

      function renderTables(data){
        const tables = data.tables || {};
        q("tablesBox").innerHTML = Object.entries(tables).map(([name, row]) => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="font-black text-sm">${esc(name)}</div>
              <div>${badge(!!row.ok)}</div>
            </div>
            <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div><span class="font-black">Exists:</span> ${row.exists ? "yes" : "no"}</div>
              <div><span class="font-black">Columns:</span> ${esc(row.column_count ?? "-")}</div>
              <div><span class="font-black">Rows:</span> ${esc(row.row_count ?? "-")}</div>
            </div>
            <div class="mt-3 text-xs text-slate-500">
              <span class="font-black">Missing columns:</span>
              ${Array.isArray(row.missing_columns) && row.missing_columns.length
                ? row.missing_columns.map(x => `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black mr-1">${esc(x)}</span>`).join("")
                : `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">none</span>`
              }
            </div>
          </div>
        `).join("");
      }

      async function render(){
        setMsg("muted", "Running final stabilization health check...");
        const r = await loadHealth();

        if(r.status !== "ok"){
          q("summaryBox").innerHTML = "";
          q("checksBox").innerHTML = `<div class="text-sm text-red-500">Load failed.</div>`;
          q("tablesBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }

        renderSummary(r.data || {});
        renderChecks(r.data || {});
        renderTables(r.data || {});
        setMsg(r.data?.health_ok ? "success" : "warning", r.data?.health_ok ? "Health check passed." : "Health check found issues.");
      }

      q("btnReload").onclick = render;
      await render();
    }
  };
}
