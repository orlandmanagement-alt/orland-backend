import { renderVerificationBanner, bindVerificationBanner } from "../assets/js/orland_ui.js";

export default function(Orland){
  return {
    title:"Profile Security",
    async mount(host){
      const me = await Orland.api("/api/me");
      const d = me?.data || {};
      const vc = d.verification_compliance || {};
      const actions = Array.isArray(vc.required_actions) ? vc.required_actions : [];

      host.innerHTML = `
        <div class="space-y-5 max-w-6xl">
          <div id="bannerBox"></div>

          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">Security & Password</div>
            <div class="text-slate-500 mt-1">Kelola keamanan akun, password, dan persiapan compliance policy.</div>
          </div>

          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Quick Actions</div>
            <div class="mt-4 flex gap-2 flex-wrap">
              <button id="goVerifyCenter" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Open Verify Center</button>
              <button id="goProfile" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">My Profile</button>
            </div>

            ${
              actions.length ? `
                <div class="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div class="font-black text-amber-800 text-sm">Required Actions</div>
                  <div class="text-amber-700 text-xs mt-1">Selesaikan verifikasi agar akses penuh terbuka.</div>
                </div>
              ` : `
                <div class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div class="font-black text-emerald-800 text-sm">Security policy satisfied</div>
                  <div class="text-emerald-700 text-xs mt-1">Tidak ada tindakan tambahan yang diwajibkan saat ini.</div>
                </div>
              `
            }
          </div>
        </div>
      `;

      const bannerHost = host.querySelector("#bannerBox");
      bannerHost.innerHTML = renderVerificationBanner({
        scope: vc.scope || "user",
        required_actions: actions
      });
      bindVerificationBanner(bannerHost, Orland);

      host.querySelector("#goVerifyCenter")?.addEventListener("click", ()=>{
        Orland.navigate("/verify-center");
      });

      host.querySelector("#goProfile")?.addEventListener("click", ()=>{
        Orland.navigate("/profile");
      });
    }
  };
}
