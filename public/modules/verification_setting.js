(function(){
  const M = window.Orland?.Modules;
  const API = window.Orland?.API;
  if(!M || !API) return;

  const val=(id)=>document.getElementById(id)?.value ?? "";
  const chk=(id)=>document.getElementById(id)?.checked ? 1 : 0;
  const setv=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v??""; };
  const setc=(id,v)=>{ const el=document.getElementById(id); if(el) el.checked=!!Number(v); };

  M.register("/config/verification", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Verification Setting</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Toggle verifikasi Talent/Client. Admin/Staff/Super Admin <b>tidak wajib</b> (exemptions).
          </p>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5 space-y-4">
          <label class="flex items-center gap-2 text-xs font-bold">
            <input id="enabled" type="checkbox"> Enable Verification Module
          </label>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label class="flex items-center gap-2 text-xs">
              <input id="req_email" type="checkbox"> Require Email Verified
            </label>
            <label class="flex items-center gap-2 text-xs">
              <input id="req_phone" type="checkbox"> Require Phone Verified
            </label>
            <label class="flex items-center gap-2 text-xs">
              <input id="req_pin" type="checkbox"> Require PIN (2nd factor)
            </label>
          </div>

          <div class="border-t border-slate-200 dark:border-darkBorder pt-4">
            <div class="text-xs font-bold mb-2">Talent Verification</div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label class="flex items-center gap-2 text-xs"><input id="t_selfie" type="checkbox"> Selfie</label>
              <label class="flex items-center gap-2 text-xs"><input id="t_ktp" type="checkbox"> KTP</label>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">Min profile % required</div>
                <input id="t_minpct" type="number" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" value="90">
              </div>
              <div>
                <div class="text-[11px] text-slate-500 mb-1">Highlight if % ≥</div>
                <input id="t_hlpct" type="number" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" value="90">
              </div>
            </div>
          </div>

          <div class="border-t border-slate-200 dark:border-darkBorder pt-4">
            <div class="text-xs font-bold mb-2">Client Verification</div>
            <label class="flex items-center gap-2 text-xs"><input id="c_docs" type="checkbox"> Require company documents</label>
          </div>

          <div class="border-t border-slate-200 dark:border-darkBorder pt-4">
            <div class="text-xs font-bold mb-2">Exemptions (not forced)</div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <label class="flex items-center gap-2"><input id="ex_admin" type="checkbox"> admin</label>
              <label class="flex items-center gap-2"><input id="ex_staff" type="checkbox"> staff</label>
              <label class="flex items-center gap-2"><input id="ex_sa" type="checkbox"> super_admin</label>
            </div>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <button id="btnSave" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90">
              <i class="fa-solid fa-floppy-disk mr-2"></i>Save
            </button>
            <button id="btnReload" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:opacity-90 dark:bg-slate-200 dark:text-slate-900">
              Reload
            </button>
            <div id="st" class="text-xs text-slate-500 ml-auto">—</div>
          </div>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="dbg" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    const dbg=document.getElementById("dbg");
    const st=document.getElementById("st");

    async function load(){
      const r = await API.req("/api/config/verification");
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok"){ st.textContent="Failed: "+r.status; return; }
      const c = r.data.config || {};

      setc("enabled", c.enabled);
      setc("req_email", c.require_email_verified);
      setc("req_phone", c.require_phone_verified);
      setc("req_pin", c.require_pin);

      setc("t_selfie", c.talent?.require_selfie);
      setc("t_ktp", c.talent?.require_ktp);
      setv("t_minpct", c.talent?.require_min_profile_pct ?? 90);
      setv("t_hlpct", c.talent?.highlight_if_pct_ge ?? 90);

      setc("c_docs", c.client?.require_company_docs);

      setc("ex_admin", c.exemptions?.admin ?? 1);
      setc("ex_staff", c.exemptions?.staff ?? 1);
      setc("ex_sa", c.exemptions?.super_admin ?? 1);

      st.textContent="Loaded";
    }

    document.getElementById("btnReload").onclick = load;
    document.getElementById("btnSave").onclick = async ()=>{
      const payload = {
        config: {
          enabled: chk("enabled"),
          require_email_verified: chk("req_email"),
          require_phone_verified: chk("req_phone"),
          require_pin: chk("req_pin"),
          talent: {
            require_selfie: chk("t_selfie"),
            require_ktp: chk("t_ktp"),
            require_min_profile_pct: Number(val("t_minpct")||90),
            highlight_if_pct_ge: Number(val("t_hlpct")||90)
          },
          client: { require_company_docs: chk("c_docs") },
          exemptions: { admin: chk("ex_admin"), staff: chk("ex_staff"), super_admin: chk("ex_sa") }
        }
      };
      const r = await API.req("/api/config/verification", { method:"PUT", body: JSON.stringify(payload) });
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok") return alert("Save failed: "+r.status);
      alert("Saved");
      await load();
    };

    await load();
  });
})();
