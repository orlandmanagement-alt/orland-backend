import { renderVerificationBanner, bindVerificationBanner } from "../../assets/js/orland_ui.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  function badge(on, yes="enabled", no="disabled"){
    return on
      ? `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">${esc(yes)}</span>`
      : `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(no)}</span>`;
  }

  return {
    title:"Profile",
    async mount(host){
      const me = await Orland.api("/api/me");
      const d = me?.data || {};

      const vp = d.verification_policy || {};
      const vr = vp.rules || {};
      const vs = d.verification_summary || {};
      const vc = d.verification_compliance || {};
      const actions = Array.isArray(vc.required_actions) ? vc.required_actions : [];

      host.innerHTML = `
        <div class="space-y-5 max-w-6xl">
          <div id="bannerBox"></div>

          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">My Profile</div>
            <div class="text-slate-500 mt-1">Informasi akun dan policy verifikasi aktif.</div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Account</div>
              <div class="mt-4 space-y-3 text-sm">
                <div><span class="text-slate-500">ID:</span> <span class="font-black">${esc(d.id || "-")}</span></div>
                <div><span class="text-slate-500">Email:</span> <span class="font-black">${esc(d.email_norm || "-")}</span></div>
                <div><span class="text-slate-500">Display Name:</span> <span class="font-black">${esc(d.display_name || "-")}</span></div>
                <div><span class="text-slate-500">Roles:</span> <span class="font-black">${esc((d.roles || []).join(", ") || "-")}</span></div>
              </div>
            </div>

            <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Effective Verification Policy</div>
              <div class="text-slate-500 text-sm mt-1">Scope aktif berdasarkan role user saat ini.</div>

              <div class="mt-4">
                <span class="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black">
                  scope: ${esc(vp.scope || "admin")}
                </span>
              </div>

              <div class="mt-4 space-y-3 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <span>Aktivasi 2 langkah</span>
                  ${badge(Number(vr.enable_two_step || 0))}
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span>Verifikasi SMS / WA</span>
                  ${badge(Number(vr.verify_sms_wa || 0))}
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span>Verifikasi Email</span>
                  ${badge(Number(vr.verify_email || 0))}
                </div>
                <div class="flex items-center justify-between gap-3">
                  <span>Verifikasi KYC</span>
                  ${badge(Number(vr.verify_kyc || 0))}
                </div>
              </div>
            </div>
          </div>

          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Verification Status</div>
            <div class="text-slate-500 text-sm mt-1">Status ringkas user saat ini dibanding policy global.</div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-xs text-slate-500 font-bold">Phone Verified</div>
                <div class="mt-2">${badge(Number(vs.phone_verified || 0), "verified", "not verified")}</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-xs text-slate-500 font-bold">Email Verified</div>
                <div class="mt-2">${badge(Number(vs.email_verified || 0), "verified", "not verified")}</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-xs text-slate-500 font-bold">Email 2FA</div>
                <div class="mt-2">${badge(Number(vs.email_2fa_enabled || 0), "enabled", "not enabled")}</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-xs text-slate-500 font-bold">KYC Status</div>
                <div class="mt-2"><span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(vs.kyc_status || "none")}</span></div>
              </div>
            </div>

            <div class="mt-4 rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-xs text-slate-500 font-bold">Compliance</div>
              <div class="mt-2">
                ${
                  vc.compliant === false
                    ? `<span class="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-black">needs action</span>`
                    : `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">ok</span>`
                }
              </div>
              ${
                actions.length ? `
                  <div class="mt-3">
                    <button type="button" id="goVerifyCenter" class="px-4 py-2.5 rounded-2xl bg-amber-600 text-white font-black text-sm">
                      Open Verify Center
                    </button>
                  </div>
                ` : ``
              }
            </div>
          </div>
        </div>
      `;

      const bannerHost = host.querySelector("#bannerBox");
      bannerHost.innerHTML = renderVerificationBanner({
        scope: vc.scope || vp.scope || "user",
        required_actions: actions
      });
      bindVerificationBanner(bannerHost, Orland);

      host.querySelector("#goVerifyCenter")?.addEventListener("click", ()=>{
        Orland.navigate("/verify-center");
      });
    }
  };
}
