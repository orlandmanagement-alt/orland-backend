import { fmtTs, esc } from "./security_shared.js";

export default function AuditLogModule({ api, mount, toast }) {
  let q = "";
  let limit = 100;

  async function boot(){
    const me = await api("/api/me");
    if(me.status !== "ok") return mount(`<div class="text-slate-500">Unauthorized</div>`);

    renderSkeleton();
    bind();
    await load();
  }

  function renderSkeleton(){
    mount(`
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5 shadow-sm">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div class="text-lg font-bold text-slate-900 dark:text-white">Audit Logs</div>
            <div class="text-xs text-slate-500 mt-1">Filter by action/route/user.</div>
          </div>
          <div class="flex gap-2 flex-wrap">
            <input id="q" class="px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder"
              placeholder="search..." />
            <select id="limit" class="px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder">
              <option value="50">50</option>
              <option value="100" selected>100</option>
              <option value="200">200</option>
            </select>
            <button id="btnGo" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">Load</button>
          </div>
        </div>

        <div id="tbl" class="overflow-x-auto mt-4 text-xs text-slate-500">Loading…</div>
      </div>
    `);
  }

  function bind(){
    document.getElementById("btnGo")?.addEventListener("click", load);
    document.getElementById("q")?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") load(); });
    document.getElementById("limit")?.addEventListener("change", load);
  }

  async function load(){
    q = String(document.getElementById("q")?.value||"").trim();
    limit = Number(document.getElementById("limit")?.value||100);

    const url = "/api/audit?limit="+encodeURIComponent(limit) + (q?("&q="+encodeURIComponent(q)):"");
    const r = await api(url);
    if(r.status !== "ok"){
      document.getElementById("tbl").innerHTML = `<div class="text-slate-500">Failed: ${esc(r.status)}</div>`;
      toast(r.status,"error");
      return;
    }
    const rows = r.data.rows || [];

    document.getElementById("tbl").innerHTML = `
      <table class="w-full text-left text-xs whitespace-nowrap">
        <thead class="text-slate-500">
          <tr>
            <th class="py-2 pr-3">At</th>
            <th class="py-2 pr-3">Action</th>
            <th class="py-2 pr-3">Route</th>
            <th class="py-2 pr-3">HTTP</th>
            <th class="py-2 pr-3">Actor</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
          ${rows.map(x=>`
            <tr>
              <td class="py-2 pr-3 text-slate-500">${esc(fmtTs(x.created_at))}</td>
              <td class="py-2 pr-3"><code>${esc(x.action||"")}</code></td>
              <td class="py-2 pr-3 text-slate-500">${esc(x.route||"")}</td>
              <td class="py-2 pr-3 font-bold">${esc(x.http_status||"")}</td>
              <td class="py-2 pr-3 text-slate-500"><code>${esc(x.actor_user_id||"")}</code></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  boot();
}
