(function(){
  const M = window.Orland?.Modules;
  const API = window.Orland?.API;
  if(!M || !API) return;

  const val = (id)=>document.getElementById(id)?.value ?? "";
  const chk = (id)=>document.getElementById(id)?.checked ? 1 : 0;
  const setv = (id,v)=>{ const el=document.getElementById(id); if(el) el.value = v ?? ""; };
  const setc = (id,v)=>{ const el=document.getElementById(id); if(el) el.checked = !!Number(v); };

  M.register("/config/otp", async ({ host })=>{
    host.innerHTML = `
      <div class="space-y-6">
        <div>
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">OTP Setting</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400">Aktif/nonaktif OTP + pilih channel + provider config. Secret dimasking.</p>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5 space-y-4">
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 text-xs font-bold">
              <input id="otp_enabled" type="checkbox"> Enable OTP
            </label>
            <div class="text-xs text-slate-500">TTL/attempts berlaku untuk Talent/Client (admin/staff bisa dikecualikan di Verification Setting).</div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div class="text-[11px] text-slate-500 mb-1">TTL (sec)</div>
              <input id="ttl" type="number" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" value="300">
            </div>
            <div>
              <div class="text-[11px] text-slate-500 mb-1">Max attempts</div>
              <input id="maxa" type="number" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" value="5">
            </div>
            <div>
              <div class="text-[11px] text-slate-500 mb-1">Resend cooldown (sec)</div>
              <input id="cool" type="number" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-sm" value="60">
            </div>
          </div>

          <div class="border-t border-slate-200 dark:border-darkBorder pt-4">
            <div class="text-xs font-bold mb-2">Channels</div>
            <div class="flex flex-wrap gap-4 text-xs">
              <label class="flex items-center gap-2"><input id="ch_email" type="checkbox"> Email</label>
              <label class="flex items-center gap-2"><input id="ch_sms" type="checkbox"> SMS</label>
              <label class="flex items-center gap-2"><input id="ch_wa" type="checkbox"> WhatsApp</label>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 dark:border-darkBorder pt-4">
            <div class="space-y-2">
              <div class="text-xs font-bold">WhatsApp Provider</div>
              <input id="wa_provider" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="e.g. Wablas / Fonnte / custom">
              <input id="wa_api" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="API Base URL">
              <input id="wa_sender" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="Sender ID / Device">
              <input id="wa_token" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="Token (masked)">
            </div>

            <div class="space-y-2">
              <div class="text-xs font-bold">SMS Provider</div>
              <input id="sms_provider" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="e.g. Twilio / custom">
              <input id="sms_api" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="API Base URL">
              <input id="sms_sender" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="Sender / From">
              <input id="sms_key" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="API Key (masked)">
            </div>

            <div class="space-y-2">
              <div class="text-xs font-bold">Email Provider</div>
              <input id="em_provider" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="e.g. Mailgun / Sendgrid / custom">
              <input id="em_api" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="API Base URL">
              <input id="em_from" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="From email">
              <input id="em_key" class="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs" placeholder="API Key (masked)">
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

    const dbg = document.getElementById("dbg");
    const st = document.getElementById("st");

    async function load(){
      const r = await API.req("/api/config/otp");
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok"){ st.textContent="Failed: "+r.status; return; }
      const c = r.data.config || {};
      setc("otp_enabled", c.enabled);
      setv("ttl", c.policy?.ttl_sec ?? 300);
      setv("maxa", c.policy?.max_attempts ?? 5);
      setv("cool", c.policy?.resend_cooldown_sec ?? 60);

      setc("ch_email", c.channels?.email ?? 1);
      setc("ch_sms", c.channels?.sms ?? 0);
      setc("ch_wa", c.channels?.whatsapp ?? 0);

      setv("wa_provider", c.providers?.whatsapp?.provider || "");
      setv("wa_api", c.providers?.whatsapp?.api_base || "");
      setv("wa_sender", c.providers?.whatsapp?.sender || "");
      setv("wa_token", c.providers?.whatsapp?.token || "");

      setv("sms_provider", c.providers?.sms?.provider || "");
      setv("sms_api", c.providers?.sms?.api_base || "");
      setv("sms_sender", c.providers?.sms?.sender || "");
      setv("sms_key", c.providers?.sms?.api_key || "");

      setv("em_provider", c.providers?.email?.provider || "");
      setv("em_api", c.providers?.email?.api_base || "");
      setv("em_from", c.providers?.email?.from_email || "");
      setv("em_key", c.providers?.email?.api_key || "");

      st.textContent = "Loaded";
    }

    document.getElementById("btnReload").onclick = load;
    document.getElementById("btnSave").onclick = async ()=>{
      const payload = {
        config: {
          enabled: chk("otp_enabled"),
          channels: { email: chk("ch_email"), sms: chk("ch_sms"), whatsapp: chk("ch_wa") },
          policy: {
            ttl_sec: Number(val("ttl")||300),
            max_attempts: Number(val("maxa")||5),
            resend_cooldown_sec: Number(val("cool")||60)
          },
          providers: {
            whatsapp: { provider: val("wa_provider"), api_base: val("wa_api"), sender: val("wa_sender"), token: val("wa_token") },
            sms: { provider: val("sms_provider"), api_base: val("sms_api"), sender: val("sms_sender"), api_key: val("sms_key") },
            email: { provider: val("em_provider"), api_base: val("em_api"), from_email: val("em_from"), api_key: val("em_key") }
          }
        }
      };
      const r = await API.req("/api/config/otp", { method:"PUT", body: JSON.stringify(payload) });
      dbg.textContent = JSON.stringify(r,null,2);
      if(r.status!=="ok") return alert("Save failed: "+r.status);
      alert("Saved");
      await load();
    };

    await load();
  });
})();
