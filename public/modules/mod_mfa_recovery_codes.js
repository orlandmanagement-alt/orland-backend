import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadStatus(){
    return await Orland.api("/api/mfa/recovery-codes");
  }

  async function generateCodes(){
    return await Orland.api("/api/mfa/recovery-codes", {
      method:"POST",
      body: JSON.stringify({ action:"generate" })
    });
  }

  return {
    title:"MFA Recovery Codes",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: [],
        title: "MFA Recovery Codes",
        desc: "Session tidak valid atau akses tidak tersedia."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-4xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">Recovery Codes</div>
            <div class="text-sm text-slate-500 mt-1">Generate dan simpan recovery codes untuk MFA.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div id="statusBox" class="text-sm text-slate-500">Loading...</div>
            <div class="mt-4 flex gap-2 flex-wrap">
              <button id="btnReload" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Reload</button>
              <button id="btnGenerate" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Generate New Recovery Codes</button>
            </div>
            <div id="codesBox" class="mt-4"></div>
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

      function renderStatus(data){
        q("statusBox").innerHTML = `
          <div class="space-y-2 text-sm">
            <div><span class="font-black">MFA Enabled:</span> ${data.mfa_enabled ? "yes" : "no"}</div>
            <div><span class="font-black">Recovery Codes Count:</span> ${esc(data.recovery_codes_count || 0)}</div>
          </div>
        `;
      }

      async function render(){
        setMsg("muted", "Loading recovery codes status...");
        const r = await loadStatus();
        if(r.status !== "ok"){
          q("statusBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }
        renderStatus(r.data || {});
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;

      q("btnGenerate").onclick = async ()=>{
        setMsg("muted", "Generating recovery codes...");
        const r = await generateCodes();
        if(r.status !== "ok"){
          setMsg("error", "Generate failed: " + (r.data?.message || r.status));
          return;
        }

        const codes = Array.isArray(r.data?.codes) ? r.data.codes : [];
        q("codesBox").innerHTML = `
          <div class="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
            <div class="text-sm font-black text-amber-700">Simpan kode ini sekarang. Kode plaintext tidak akan ditampilkan lagi.</div>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              ${codes.map(c => `<div class="rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark px-3 py-3 font-mono text-sm">${esc(c)}</div>`).join("")}
            </div>
          </div>
        `;
        setMsg("success", "Recovery codes generated.");
        await render();
      };

      await render();
    }
  };
}
