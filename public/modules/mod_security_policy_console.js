export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadPolicy(){
    return await Orland.api("/api/security/policy");
  }

  async function savePolicy(value){
    return await Orland.api("/api/security/policy", {
      method: "POST",
      body: JSON.stringify(value)
    });
  }

  function checked(v){
    return Number(v || 0) === 1 ? "checked" : "";
  }

  return {
    title: "Security Policy Console",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-5xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">Security Policy Admin Console</div>
            <div class="text-sm text-slate-500 mt-1">Toggle enterprise security policy bertahap. Default aman: nonfatal features tetap bisa dimatikan.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <form id="policyForm" class="space-y-5">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-lg font-extrabold">Global Verification Policy</div>
                <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                    <input type="checkbox" name="enabled">
                    <span class="text-sm font-semibold">Enable verification policy</span>
                  </label>

                  <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                    <input type="checkbox" name="enforce_admin_routes">
                    <span class="text-sm font-semibold">Enforce on admin routes</span>
                  </label>

                  <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                    <input type="checkbox" name="require_email_verified">
                    <span class="text-sm font-semibold">Require email verified</span>
                  </label>

                  <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                    <input type="checkbox" name="require_phone_verified">
                    <span class="text-sm font-semibold">Require phone verified</span>
                  </label>

                  <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                    <input type="checkbox" name="require_profile_completed">
                    <span class="text-sm font-semibold">Require profile completed</span>
                  </label>

                  <label class="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
                    <input type="checkbox" name="require_mfa_for_admin">
                    <span class="text-sm font-semibold">Require MFA for admin</span>
                  </label>
                </div>
              </div>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-lg font-extrabold">Skip Roles</div>
                <div class="text-xs text-slate-500 mt-1">Pisahkan dengan koma. Contoh: super_admin,security_admin</div>
                <textarea name="skip_roles" rows="3" class="mt-3 w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="super_admin"></textarea>
              </div>

              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save Policy</button>
                <button type="button" id="btnReload" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Reload</button>
                <button type="button" id="btnPresetSafe" class="px-4 py-2.5 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">Preset Safe</button>
                <button type="button" id="btnPresetStrict" class="px-4 py-2.5 rounded-2xl border border-rose-200 text-rose-700 font-black text-sm">Preset Strict</button>
              </div>
            </form>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-lg font-extrabold">Current JSON</div>
            <pre id="jsonBox" class="mt-4 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 text-[11px] overflow-auto"></pre>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let CURRENT = null;

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else if(kind === "warning") q("msg").classList.add("text-amber-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function payloadFromForm(){
        const form = q("policyForm");
        return {
          enabled: form.enabled.checked ? 1 : 0,
          enforce_admin_routes: form.enforce_admin_routes.checked ? 1 : 0,
          require_email_verified: form.require_email_verified.checked ? 1 : 0,
          require_phone_verified: form.require_phone_verified.checked ? 1 : 0,
          require_profile_completed: form.require_profile_completed.checked ? 1 : 0,
          require_mfa_for_admin: form.require_mfa_for_admin.checked ? 1 : 0,
          skip_roles: String(form.skip_roles.value || "")
            .split(",")
            .map(s => s.trim())
            .filter(Boolean)
        };
      }

      function paintForm(v){
        const form = q("policyForm");
        const x = v || {};
        form.enabled.checked = Number(x.enabled || 0) === 1;
        form.enforce_admin_routes.checked = Number(x.enforce_admin_routes || 0) === 1;
        form.require_email_verified.checked = Number(x.require_email_verified || 0) === 1;
        form.require_phone_verified.checked = Number(x.require_phone_verified || 0) === 1;
        form.require_profile_completed.checked = Number(x.require_profile_completed || 0) === 1;
        form.require_mfa_for_admin.checked = Number(x.require_mfa_for_admin || 0) === 1;
        form.skip_roles.value = Array.isArray(x.skip_roles) ? x.skip_roles.join(", ") : "";
        q("jsonBox").textContent = JSON.stringify(x, null, 2);
      }

      async function render(){
        setMsg("muted", "Loading policy...");
        const r = await loadPolicy();
        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + (r.data?.message || r.status));
          q("jsonBox").textContent = JSON.stringify(r, null, 2);
          return;
        }
        CURRENT = r.data?.value || {};
        paintForm(CURRENT);
        setMsg("success", "Loaded.");
      }

      q("policyForm").onsubmit = async (ev)=>{
        ev.preventDefault();
        const payload = payloadFromForm();
        setMsg("muted", "Saving policy...");
        const r = await savePolicy(payload);
        if(r.status !== "ok"){
          setMsg("error", "Save failed: " + (r.data?.message || r.status));
          q("jsonBox").textContent = JSON.stringify(r, null, 2);
          return;
        }
        CURRENT = r.data?.value || payload;
        paintForm(CURRENT);
        setMsg("success", "Policy saved.");
      };

      q("btnReload").onclick = render;

      q("btnPresetSafe").onclick = ()=>{
        paintForm({
          enabled: 0,
          enforce_admin_routes: 0,
          require_email_verified: 0,
          require_phone_verified: 0,
          require_profile_completed: 0,
          require_mfa_for_admin: 0,
          skip_roles: ["super_admin"]
        });
        setMsg("warning", "Preset safe loaded to form. Click Save Policy to apply.");
      };

      q("btnPresetStrict").onclick = ()=>{
        paintForm({
          enabled: 1,
          enforce_admin_routes: 1,
          require_email_verified: 1,
          require_phone_verified: 1,
          require_profile_completed: 1,
          require_mfa_for_admin: 1,
          skip_roles: ["super_admin"]
        });
        setMsg("warning", "Preset strict loaded to form. Click Save Policy to apply.");
      };

      await render();
    }
  };
}
