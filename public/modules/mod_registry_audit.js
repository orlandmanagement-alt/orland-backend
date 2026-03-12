import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  function badge(sev, label){
    if(sev === "critical"){
      return `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">${esc(label || "Perlu perbaikan")}</span>`;
    }
    if(sev === "warning"){
      return `<span class="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-black">${esc(label || "Perlu perhatian")}</span>`;
    }
    if(sev === "notice"){
      return `<span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">${esc(label || "Info")}</span>`;
    }
    return `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">${esc(label || "Sehat")}</span>`;
  }

  async function loadAudit(){
    return await Orland.api("/api/admin/registry/audit");
  }

  return {
    title:"Registry Audit",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: ["super_admin", "admin", "security_admin", "audit_admin", "access_admin"],
        title: "Registry Audit Restricted",
        desc: "Hanya role admin, security, audit, atau access yang boleh membuka audit registry."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-7xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold ui-title-gradient">Registry Audit Center</div>
                <div class="text-sm text-slate-500 mt-1">Pemeriksaan menu database, route registry, dan file module. Disusun agar mudah dibaca dan ada saran perbaikan.</div>
              </div>
              <button id="btnReload" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Reload</button>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
            <div id="noticeBox" class="mt-4 space-y-2"></div>
          </div>

          <div id="summaryBox" class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3"></div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div class="xl:col-span-1 ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Global Issues</div>
              <div id="issuesBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="xl:col-span-2 space-y-4">
              <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="text-xl font-extrabold">Dead Routes</div>
                <div class="text-xs text-slate-500 mt-1">Route registry yang tidak tersambung penuh ke menu atau module.</div>
                <div id="deadRoutesBox" class="mt-4 space-y-3"></div>
              </div>

              <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
                <div class="text-xl font-extrabold">Dead Menus</div>
                <div class="text-xs text-slate-500 mt-1">Menu database yang belum aktif penuh di registry atau parent/module bermasalah.</div>
                <div id="deadMenusBox" class="mt-4 space-y-3"></div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Menu Audit Detail</div>
              <div id="menuItemsBox" class="mt-4 space-y-3 max-h-[720px] overflow-auto"></div>
            </div>

            <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-xl font-extrabold">Route Audit Detail</div>
              <div id="routeItemsBox" class="mt-4 space-y-3 max-h-[720px] overflow-auto"></div>
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
        const s = data.summary || {};
        const cards = [
          ["TOTAL MENUS", s.total_menus || 0],
          ["TOTAL ROUTES", s.total_routes || 0],
          ["HEALTHY MENUS", s.healthy_menus || 0],
          ["HEALTHY ROUTES", s.healthy_routes || 0],
          ["DEAD ROUTES", s.dead_routes || 0],
          ["DEAD MENUS", s.dead_menus || 0]
        ];

        q("summaryBox").innerHTML = cards.map(([label, value]) => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="text-[11px] text-slate-500 font-bold">${esc(label)}</div>
            <div class="mt-2 text-2xl font-extrabold">${esc(value)}</div>
          </div>
        `).join("");
      }

      function renderNotices(data){
        const items = Array.isArray(data.overall?.top_notices) ? data.overall.top_notices : [];
        q("noticeBox").innerHTML = `
          <div class="flex items-center gap-2 flex-wrap">
            ${badge(data.overall?.severity, data.overall?.status_label || "Status")}
          </div>
          ${items.map(x => `
            <div class="rounded-2xl border border-sky-200 bg-sky-50 dark:bg-sky-950/20 p-4 text-sm text-sky-800 dark:text-sky-200">
              ${esc(x)}
            </div>
          `).join("")}
        `;
      }

      function renderIssueCard(x){
        return `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="font-black text-sm">${esc(x.title || x.kind || "Issue")}</div>
              <div>${badge(x.severity, x.status_label)}</div>
            </div>
            <div class="mt-3 text-sm text-slate-500">${esc(x.recommendation || "-")}</div>
          </div>
        `;
      }

      function renderDeadRouteCard(x){
        return `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="font-black text-sm">${esc(x.path || "-")}</div>
              <div>${badge(x.severity, x.status_label)}</div>
            </div>
            <div class="mt-3 text-sm text-slate-500 space-y-1">
              <div><span class="font-bold">Module:</span> ${esc(x.module || "-")}</div>
              <div><span class="font-bold">Menu linked:</span> ${x.menu_exists ? "yes" : "no"}</div>
              <div><span class="font-bold">Module exists:</span> ${x.module_exists ? "yes" : "no"}</div>
            </div>
            <div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-200">
              ${esc(x.recommendation || "-")}
            </div>
          </div>
        `;
      }

      function renderDeadMenuCard(x){
        return `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="font-black text-sm">${esc(x.label || x.id || "-")}</div>
              <div>${badge(x.severity, x.status_label)}</div>
            </div>
            <div class="mt-3 text-sm text-slate-500 space-y-1">
              <div><span class="font-bold">Path:</span> ${esc(x.path || "-")}</div>
              <div><span class="font-bold">Group:</span> ${esc(x.group_key || "-")}</div>
              <div><span class="font-bold">Registry exists:</span> ${x.registry_exists ? "yes" : "no"}</div>
              <div><span class="font-bold">Module exists:</span> ${x.module_exists ? "yes" : "no"}</div>
              <div><span class="font-bold">Parent ok:</span> ${x.parent_ok ? "yes" : "no"}</div>
            </div>
            <div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-800 dark:text-amber-200">
              ${esc(x.recommendation || "-")}
            </div>
          </div>
        `;
      }

      function renderMenuDetail(x){
        return `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="font-black text-sm">${esc(x.label || x.id || "-")}</div>
              <div>${badge(x.severity, x.status_label)}</div>
            </div>
            <div class="mt-3 text-xs text-slate-500 space-y-1">
              <div><span class="font-bold">ID:</span> ${esc(x.id || "-")}</div>
              <div><span class="font-bold">Code:</span> ${esc(x.code || "-")}</div>
              <div><span class="font-bold">Path:</span> ${esc(x.path || "-")}</div>
              <div><span class="font-bold">Group:</span> ${esc(x.group_key || "-")}</div>
              <div><span class="font-bold">Registry module:</span> ${esc(x.registry_module || "-")}</div>
            </div>
            ${(Array.isArray(x.notices) && x.notices.length) ? `
              <div class="mt-3 space-y-2">
                ${x.notices.map(n => `<div class="text-xs rounded-xl bg-slate-100 dark:bg-black/20 px-3 py-2">${esc(n)}</div>`).join("")}
              </div>
            ` : ``}
          </div>
        `;
      }

      function renderRouteDetail(x){
        return `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div class="font-black text-sm">${esc(x.path || "-")}</div>
              <div>${badge(x.severity, x.status_label)}</div>
            </div>
            <div class="mt-3 text-xs text-slate-500 space-y-1">
              <div><span class="font-bold">Module:</span> ${esc(x.module || "-")}</div>
              <div><span class="font-bold">Export:</span> ${esc(x.export || "-")}</div>
              <div><span class="font-bold">Menu linked:</span> ${x.menu_exists ? esc(x.menu_id || "-") : "no"}</div>
              <div><span class="font-bold">Group:</span> ${esc(x.group || "-")}</div>
            </div>
            ${(Array.isArray(x.notices) && x.notices.length) ? `
              <div class="mt-3 space-y-2">
                ${x.notices.map(n => `<div class="text-xs rounded-xl bg-slate-100 dark:bg-black/20 px-3 py-2">${esc(n)}</div>`).join("")}
              </div>
            ` : ``}
          </div>
        `;
      }

      async function render(){
        setMsg("muted", "Memuat audit registry...");
        const r = await loadAudit();

        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + (r.data?.message || r.status));
          return;
        }

        const data = r.data || {};
        renderSummary(data);
        renderNotices(data);

        const issues = Array.isArray(data.issues) ? data.issues : [];
        q("issuesBox").innerHTML = issues.length
          ? issues.map(renderIssueCard).join("")
          : `<div class="text-sm text-slate-500">Tidak ada issue global.</div>`;

        const deadRoutes = Array.isArray(data.dead_routes) ? data.dead_routes : [];
        q("deadRoutesBox").innerHTML = deadRoutes.length
          ? deadRoutes.map(renderDeadRouteCard).join("")
          : `<div class="text-sm text-emerald-600 font-semibold">Tidak ada dead route.</div>`;

        const deadMenus = Array.isArray(data.dead_menus) ? data.dead_menus : [];
        q("deadMenusBox").innerHTML = deadMenus.length
          ? deadMenus.map(renderDeadMenuCard).join("")
          : `<div class="text-sm text-emerald-600 font-semibold">Tidak ada dead menu.</div>`;

        const menuItems = Array.isArray(data.menu_items) ? data.menu_items : [];
        q("menuItemsBox").innerHTML = menuItems.length
          ? menuItems.map(renderMenuDetail).join("")
          : `<div class="text-sm text-slate-500">Tidak ada data menu.</div>`;

        const routeItems = Array.isArray(data.route_items) ? data.route_items : [];
        q("routeItemsBox").innerHTML = routeItems.length
          ? routeItems.map(renderRouteDetail).join("")
          : `<div class="text-sm text-slate-500">Tidak ada data route.</div>`;

        setMsg(data.overall?.severity === "healthy" ? "success" : "warning", "Audit registry selesai.");
      }

      q("btnReload").onclick = render;
      await render();
    }
  };
}
