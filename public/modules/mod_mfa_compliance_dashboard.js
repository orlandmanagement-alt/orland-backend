import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
  const fmt = (v)=>!v ? "-" : new Date(Number(v) * 1000).toLocaleString("id-ID");

  async function loadData(q, limit){
    const qs = new URLSearchParams();
    if(q) qs.set("q", q);
    if(limit) qs.set("limit", String(limit));
    return await Orland.api("/api/admin/mfa/compliance" + (qs.toString() ? "?" + qs.toString() : ""));
  }

  function badge(ok, yes = "yes", no = "no"){
    return ok
      ? `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">${yes}</span>`
      : `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">${no}</span>`;
  }

  return {
    title: "MFA Compliance Dashboard",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: ["super_admin", "admin", "security_admin", "audit_admin"],
        title: "MFA Compliance Restricted",
        desc: "Hanya role admin/security/audit yang boleh membuka dashboard compliance MFA."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-7xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">MFA Compliance Dashboard</div>
            <div class="text-sm text-slate-500 mt-1">Monitor user yang wajib MFA, status enabled, dan compliance berdasarkan role policy.</div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3">
              <input id="qSearch" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari nama / email / role / status">
              <input id="qLimit" type="number" min="1" max="300" value="100" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              <button id="btnLoad" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Load</button>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div id="summaryBox" class="grid grid-cols-2 md:grid-cols-5 gap-3"></div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div id="tableBox" class="space-y-3"></div>
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

      function renderSummary(summary){
        const cards = [
          ["TOTAL", summary.total || 0],
          ["REQUIRED", summary.required || 0],
          ["ENABLED", summary.enabled || 0],
          ["COMPLIANT", summary.compliant || 0],
          ["NON-COMPLIANT", summary.non_compliant || 0]
        ];

        q("summaryBox").innerHTML = cards.map(([label, value]) => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="text-[11px] text-slate-500 font-bold">${esc(label)}</div>
            <div class="mt-2 text-2xl font-extrabold">${esc(value)}</div>
          </div>
        `).join("");
      }

      function renderTable(items){
        if(!items.length){
          q("tableBox").innerHTML = `<div class="text-sm text-slate-500">No compliance data.</div>`;
          return;
        }

        q("tableBox").innerHTML = items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="min-w-0">
                <div class="font-black text-sm">${esc(x.display_name || x.email_norm || x.user_id)}</div>
                <div class="mt-1 text-xs text-slate-500">${esc(x.email_norm || "-")}</div>
                <div class="mt-1 text-[11px] text-slate-400">${esc(x.user_id)}</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                ${badge(x.required_by_role, "required", "optional")}
                ${badge(x.mfa_enabled, "mfa on", "mfa off")}
                ${badge(x.compliant, "compliant", "non-compliant")}
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span class="font-black">Status:</span> ${esc(x.status || "-")}</div>
              <div><span class="font-black">MFA Type:</span> ${esc(x.mfa_type || "-")}</div>
              <div><span class="font-black">Has Secret:</span> ${x.has_secret ? "yes" : "no"}</div>
              <div><span class="font-black">Recovery Codes:</span> ${esc(x.recovery_codes_count || 0)}</div>
              <div><span class="font-black">Updated:</span> ${esc(fmt(x.updated_at))}</div>
            </div>

            <div class="mt-4 flex gap-2 flex-wrap">
              ${(Array.isArray(x.roles) ? x.roles : []).map(r => `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(r)}</span>`).join("") || `<span class="text-xs text-slate-400">no roles</span>`}
            </div>
          </div>
        `).join("");
      }

      async function render(){
        const term = String(q("qSearch").value || "").trim();
        const limit = Number(q("qLimit").value || 100);

        setMsg("muted", "Loading MFA compliance...");
        const r = await loadData(term, limit);

        if(r.status !== "ok"){
          q("tableBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          q("summaryBox").innerHTML = "";
          setMsg("error", "Load failed.");
          return;
        }

        renderSummary(r.data?.summary || {});
        renderTable(Array.isArray(r.data?.items) ? r.data.items : []);
        setMsg("success", "Loaded.");
      }

      q("btnLoad").onclick = render;
      q("qSearch").addEventListener("keydown", (e)=>{ if(e.key === "Enter") render(); });
      q("qLimit").addEventListener("keydown", (e)=>{ if(e.key === "Enter") render(); });

      await render();
    }
  };
}
