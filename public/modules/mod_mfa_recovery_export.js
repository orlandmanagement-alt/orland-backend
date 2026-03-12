import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadStatus(){
    return await Orland.api("/api/mfa/recovery-codes");
  }

  async function exportCodes(){
    return await Orland.api("/api/mfa/recovery-codes-export", {
      method:"POST",
      body: JSON.stringify({ regenerate:true })
    });
  }

  function downloadText(filename, content){
    const blob = new Blob([content], { type:"text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "recovery-codes.txt";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return {
    title:"Recovery Codes Export",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: [],
        title: "Recovery Export",
        desc: "Session tidak valid atau akses tidak tersedia."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-4xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">Recovery Codes Download / Print</div>
            <div class="text-sm text-slate-500 mt-1">Generate ulang recovery codes dan download versi text untuk disimpan / dicetak.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div id="statusBox" class="text-sm text-slate-500">Loading...</div>
            <div class="mt-4 flex gap-2 flex-wrap">
              <button id="btnReload" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Reload</button>
              <button id="btnExport" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Generate + Download</button>
            </div>
            <div id="previewBox" class="mt-4"></div>
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
        setMsg("muted", "Loading recovery status...");
        const r = await loadStatus();
        if(r.status !== "ok"){
          q("statusBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }

        q("statusBox").innerHTML = `
          <div class="space-y-2 text-sm">
            <div><span class="font-black">MFA Enabled:</span> ${r.data?.mfa_enabled ? "yes" : "no"}</div>
            <div><span class="font-black">Recovery Codes Count:</span> ${esc(r.data?.recovery_codes_count || 0)}</div>
          </div>
        `;
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;

      q("btnExport").onclick = async ()=>{
        setMsg("muted", "Generating export...");
        const r = await exportCodes();
        if(r.status !== "ok"){
          setMsg("error", "Export failed: " + (r.data?.message || r.status));
          return;
        }

        const txt = String(r.data?.printable_text || "");
        const filename = String(r.data?.filename || "recovery-codes.txt");
        downloadText(filename, txt);

        q("previewBox").innerHTML = `
          <pre class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 text-[11px] overflow-auto">${esc(txt)}</pre>
        `;

        setMsg("success", "Recovery codes exported and downloaded.");
        await render();
      };

      await render();
    }
  };
}
