import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  async function loadPolicy(){
    return await Orland.api("/api/security/mfa-policy");
  }

  async function savePolicy(value){
    return await Orland.api("/api/security/mfa-policy", {
      method:"POST",
      body: JSON.stringify(value)
    });
  }

  return {
    title:"MFA Policy Console",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: ["super_admin", "admin", "security_admin"],
        title: "MFA Policy Restricted",
        desc: "Hanya super_admin, admin, atau security_admin yang boleh membuka MFA policy console."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-5xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">MFA Policy Console</div>
            <div class="text-sm text-slate-500 mt-1">Policy readiness untuk MFA. Ini belum OTP penuh, tetapi sudah siap untuk toggle, role policy, dan enrollment flag.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <form id="mfaForm" class="space-y-4">
              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                <input type="checkbox" name="enabled">
                <span class="text-sm font-semibold">Enable MFA policy</span>
              </label>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                <input type="checkbox" name="allow_user_opt_in">
                <span class="text-sm font-semibold">Allow user opt-in</span>
              </label>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                <input type="checkbox" name="require_for_super_admin">
                <span class="text-sm font-semibold">Require for super_admin</span>
              </label>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                <input type="checkbox" name="require_for_security_admin">
                <span class="text-sm font-semibold">Require for security_admin</span>
              </label>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                <input type="checkbox" name="require_for_admin">
                <span class="text-sm font-semibold">Require for admin</span>
              </label>

              <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                <input type="checkbox" name="recovery_codes_enabled">
                <span class="text-sm font-semibold">Enable recovery codes</span>
              </label>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-sm font-bold text-slate-500 mb-2">Allowed Types</div>
                <input name="allowed_types" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="app">
                <div class="text-xs text-slate-500 mt-2">Pisahkan dengan koma. Contoh: app</div>
              </div>

              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save MFA Policy</button>
                <button type="button" id="btnReload" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Reload</button>
              </div>
            </form>
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="text-lg font-extrabold">Current JSON</div>
            <pre id="jsonBox" class="mt-4 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 text-[11px] overflow-auto"></pre>
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

      function paint(v){
        const form = q("mfaForm");
        form.enabled.checked = Number(v.enabled || 0) === 1;
        form.allow_user_opt_in.checked = Number(v.allow_user_opt_in || 0) === 1;
        form.require_for_super_admin.checked = Number(v.require_for_super_admin || 0) === 1;
        form.require_for_security_admin.checked = Number(v.require_for_security_admin || 0) === 1;
        form.require_for_admin.checked = Number(v.require_for_admin || 0) === 1;
        form.recovery_codes_enabled.checked = Number(v.recovery_codes_enabled || 0) === 1;
        form.allowed_types.value = Array.isArray(v.allowed_types) ? v.allowed_types.join(", ") : "app";
        q("jsonBox").textContent = JSON.stringify(v, null, 2);
      }

      function payload(){
        const form = q("mfaForm");
        return {
          enabled: form.enabled.checked ? 1 : 0,
          allow_user_opt_in: form.allow_user_opt_in.checked ? 1 : 0,
          require_for_super_admin: form.require_for_super_admin.checked ? 1 : 0,
          require_for_security_admin: form.require_for_security_admin.checked ? 1 : 0,
          require_for_admin: form.require_for_admin.checked ? 1 : 0,
          recovery_codes_enabled: form.recovery_codes_enabled.checked ? 1 : 0,
          allowed_types: String(form.allowed_types.value || "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
        };
      }

      async function render(){
        setMsg("muted", "Loading MFA policy...");
        const r = await loadPolicy();
        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + (r.data?.message || r.status));
          q("jsonBox").textContent = JSON.stringify(r, null, 2);
          return;
        }
        paint(r.data?.value || {});
        setMsg("success", "Loaded.");
      }

      q("mfaForm").onsubmit = async (ev)=>{
        ev.preventDefault();
        setMsg("muted", "Saving MFA policy...");
        const r = await savePolicy(payload());
        if(r.status !== "ok"){
          setMsg("error", "Save failed: " + (r.data?.message || r.status));
          return;
        }
        paint(r.data?.value || {});
        setMsg("success", "Saved.");
      };

      q("btnReload").onclick = render;

      await render();
    }
  };
}
