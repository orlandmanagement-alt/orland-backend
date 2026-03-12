import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
  const fmt = (v)=>!v ? "-" : new Date(Number(v) * 1000).toLocaleString("id-ID");

  async function loadAudit(user_id, limit){
    const qs = new URLSearchParams();
    if(user_id) qs.set("user_id", user_id);
    if(limit) qs.set("limit", String(limit));
    return await Orland.api("/api/admin/mfa/recovery-audit" + (qs.toString() ? "?" + qs.toString() : ""));
  }

  return {
    title:"MFA Recovery Audit",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: ["super_admin", "admin", "security_admin", "audit_admin"],
        title: "Recovery Audit Restricted",
        desc: "Hanya role audit/security yang boleh membuka audit recovery codes."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-6xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">Recovery Codes Admin Audit</div>
            <div class="text-sm text-slate-500 mt-1">Audit generation dan penggunaan recovery codes / MFA.</div>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3">
              <input id="qUser" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Filter user_id (opsional)">
              <input id="qLimit" type="number" min="1" max="200" value="50" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              <button id="btnLoad" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Load</button>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div id="auditBox" class="space-y-3"></div>
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

      async function render(){
        setMsg("muted", "Loading audit...");
        const r = await loadAudit(String(q("qUser").value || "").trim(), Number(q("qLimit").value || 50));
        if(r.status !== "ok"){
          q("auditBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        if(!items.length){
          q("auditBox").innerHTML = `<div class="text-sm text-slate-500">No audit data.</div>`;
          setMsg("success", "Loaded.");
          return;
        }

        q("auditBox").innerHTML = items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(x.action)}</span>
              <span class="text-xs text-slate-400">${esc(fmt(x.created_at))}</span>
            </div>
            <div class="mt-3 text-xs text-slate-500 space-y-1">
              <div><span class="font-bold">actor_user_id:</span> ${esc(x.actor_user_id || "-")}</div>
              <div><span class="font-bold">route:</span> ${esc(x.route || "-")}</div>
              <div><span class="font-bold">http_status:</span> ${esc(x.http_status || "-")}</div>
            </div>
            <pre class="mt-4 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-3 text-[11px] overflow-auto">${esc(JSON.stringify(x.meta || {}, null, 2))}</pre>
          </div>
        `).join("");

        setMsg("success", "Loaded.");
      }

      q("btnLoad").onclick = render;
      q("qUser").addEventListener("keydown", (e)=>{ if(e.key === "Enter") render(); });
      q("qLimit").addEventListener("keydown", (e)=>{ if(e.key === "Enter") render(); });

      await render();
    }
  };
}
