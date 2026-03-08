(function(){
  const M = window.Orland?.Modules, API = window.Orland?.API;
  if(!M || !API) return;

  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  M.register("/config/otp", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">OTP Settings</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Feature flag + provider credentials (stored in system_settings).</p>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4 space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="text-xs">
              <div class="font-bold mb-1">Enabled</div>
              <select id="otp_enabled" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                <option value="">(keep)</option>
                <option value="0">OFF</option>
                <option value="1">ON</option>
              </select>
            </label>
            <label class="text-xs">
              <div class="font-bold mb-1">Provider</div>
              <select id="otp_provider" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                <option value="">(keep)</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
              </select>
            </label>
            <label class="text-xs">
              <div class="font-bold mb-1">Sender ID</div>
              <input id="otp_sender_id" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="ORLAND" />
            </label>
            <label class="text-xs">
              <div class="font-bold mb-1">Template</div>
              <input id="otp_template" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Kode OTP kamu: {code}" />
            </label>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label class="text-xs">
              <div class="font-bold mb-1">WhatsApp API Key (secret)</div>
              <input id="otp_whatsapp_api_key" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="paste key (optional)" />
            </label>
            <label class="text-xs">
              <div class="font-bold mb-1">SMS API Key (secret)</div>
              <input id="otp_sms_api_key" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="paste key (optional)" />
            </label>
            <label class="text-xs">
              <div class="font-bold mb-1">Email API Key (secret)</div>
              <input id="otp_email_api_key" class="w-full px-3 py-2 rounded-lg bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="paste key (optional)" />
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
      const r = await API.req("/api/config/otp");
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok") return;

      const s = r.data.settings || {};
      // show current values (secrets masked by API)
      ["otp_enabled","otp_provider"].forEach(k=>{
        const el=document.getElementById(k); if(!el) return;
        // keep selector blank; show current in debug only (avoid accidental overwrite)
      });
      const setVal=(k)=>{ const el=document.getElementById(k); if(!el) return; el.value = ""; el.placeholder = (s[k]??""); };
      setVal("otp_sender_id");
      setVal("otp_template");

      // secrets: keep empty input, placeholder masked
      ["otp_whatsapp_api_key","otp_sms_api_key","otp_email_api_key"].forEach(k=>{
        const el=document.getElementById(k); if(!el) return;
        el.value=""; el.placeholder = (s[k]??"");
      });
    }

    document.getElementById("btnReload").onclick = load;
    document.getElementById("btnSave").onclick = async ()=>{
      const payload = {
        settings: {
          otp_enabled: document.getElementById("otp_enabled").value,
          otp_provider: document.getElementById("otp_provider").value,
          otp_sender_id: document.getElementById("otp_sender_id").value,
          otp_template: document.getElementById("otp_template").value,
          otp_whatsapp_api_key: document.getElementById("otp_whatsapp_api_key").value,
          otp_sms_api_key: document.getElementById("otp_sms_api_key").value,
          otp_email_api_key: document.getElementById("otp_email_api_key").value,
        }
      };
      const r = await API.req("/api/config/otp",{method:"POST", body: JSON.stringify(payload)});
      dbg.textContent = JSON.stringify(r,null,2);
      alert(r.status);
      await load();
    };

    await load();
  });
})();
