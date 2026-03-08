(function(){
  const M = window.Orland?.Modules, API = window.Orland?.API;
  if(!M || !API) return;

  M.register("/config/verification", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">Verification Settings</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Control optional KTP/selfie/phone/email/pin verification (for Talent/Client later).</p>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            ${toggle("verify_enabled","Enable Verification")}
            ${toggle("verify_require_selfie","Require Selfie")}
            ${toggle("verify_require_ktp","Require KTP")}
            ${toggle("verify_require_phone","Require Phone OTP")}
            ${toggle("verify_require_email","Require Email OTP")}
            ${toggle("verify_require_pin","Require PIN (extra)")}
            <label class="text-xs md:col-span-3">
              <div class="font-bold mb-1">Bonus threshold (percent)</div>
              <input id="verify_bonus_threshold_pct" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="90" />
            </label>
            <label class="text-xs md:col-span-3">
              <div class="font-bold mb-1">Bonus label</div>
              <input id="verify_bonus_label" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Premium Highlight" />
            </label>
          </div>

          <div class="flex gap-2">
            <button id="btnSave" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold"><i class="fa-solid fa-floppy-disk mr-2"></i>Save</button>
            <button id="btnReload" class="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:opacity-90 dark:bg-white dark:text-slate-900"><i class="fa-solid fa-rotate mr-2"></i>Reload</button>
          </div>
        </div>

        <details class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <summary class="text-xs text-slate-500 cursor-pointer">Debug</summary>
          <pre id="dbg" class="text-xs text-slate-500 mt-2 whitespace-pre-wrap"></pre>
        </details>
      </div>
    `;

    const dbg = document.getElementById("dbg");

    async function load(){
      const r = await API.req("/api/config/verification");
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok") return;
      const s = r.data.settings || {};
      setToggle("verify_enabled", s.verify_enabled);
      setToggle("verify_require_selfie", s.verify_require_selfie);
      setToggle("verify_require_ktp", s.verify_require_ktp);
      setToggle("verify_require_phone", s.verify_require_phone);
      setToggle("verify_require_email", s.verify_require_email);
      setToggle("verify_require_pin", s.verify_require_pin);

      document.getElementById("verify_bonus_threshold_pct").value = s.verify_bonus_threshold_pct || "";
      document.getElementById("verify_bonus_label").value = s.verify_bonus_label || "";
    }

    document.getElementById("btnReload").onclick = load;
    document.getElementById("btnSave").onclick = async ()=>{
      const payload = {
        settings: {
          verify_enabled: getToggle("verify_enabled"),
          verify_require_selfie: getToggle("verify_require_selfie"),
          verify_require_ktp: getToggle("verify_require_ktp"),
          verify_require_phone: getToggle("verify_require_phone"),
          verify_require_email: getToggle("verify_require_email"),
          verify_require_pin: getToggle("verify_require_pin"),
          verify_bonus_threshold_pct: document.getElementById("verify_bonus_threshold_pct").value,
          verify_bonus_label: document.getElementById("verify_bonus_label").value,
        }
      };
      const r = await API.req("/api/config/verification",{method:"POST", body: JSON.stringify(payload)});
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
      await load();
    };

    await load();
  });

  function toggle(id,label){
    return `
      <label class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-slate-50/50 dark:bg-black/20">
        <div class="font-bold">${label}</div>
        <input id="${id}" type="checkbox" class="w-5 h-5">
      </label>
    `;
  }
  function setToggle(id,val){
    const el=document.getElementById(id); if(!el) return;
    el.checked = String(val||"") === "1" || String(val||"").toLowerCase()==="true";
  }
  function getToggle(id){
    const el=document.getElementById(id); if(!el) return "0";
    return el.checked ? "1" : "0";
  }
})();
