import { esc, emptyState, renderVerificationBanner, bindVerificationBanner, verificationActionLabel } from "../assets/js/orland_ui.js";

export default function(Orland){
  async function apiMe(){
    return await Orland.api("/api/me");
  }

  async function postJson(path, payload = {}){
    return await Orland.api(path, {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  function statusBadge(ok, yes="ok", no="pending"){
    return ok
      ? `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">${esc(yes)}</span>`
      : `<span class="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-black">${esc(no)}</span>`;
  }

  function actionCard(code){
    const map = {
      verify_email: {
        title: "Verifikasi Email",
        desc: "Fulfill verifikasi email internal/dev.",
        btn: "Mark Email Verified",
        path: "/api/verification/fulfill-email",
        type: "simple"
      },
      verify_phone: {
        title: "Verifikasi SMS / WA",
        desc: "Kirim OTP lalu submit OTP untuk verifikasi nomor.",
        btn: "Send Phone OTP",
        path: "/api/verification/send-phone-otp",
        type: "phone"
      },
      enable_two_step: {
        title: "Aktifkan 2 Langkah",
        desc: "Aktifkan flag 2-step security.",
        btn: "Enable Two Step",
        path: "/api/verification/enable-two-step",
        type: "simple"
      },
      verify_kyc: {
        title: "Ajukan KYC",
        desc: "Submit evidence JSON sederhana.",
        btn: "Submit KYC",
        path: "/api/verification/submit-kyc",
        type: "kyc"
      }
    };
    return map[code] || null;
  }

  return {
    title:"Verify Center",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-6xl">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold ui-title-gradient">Verify Center</div>
                <div class="text-slate-500 mt-1">Pusat tindakan verifikasi untuk memenuhi global verification policy.</div>
              </div>
              <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
            </div>
          </div>

          <div id="bannerBox"></div>
          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Required Actions</div>
              <div id="requiredBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Current Status</div>
              <div id="statusBox" class="mt-4 space-y-3"></div>
            </div>
          </div>

          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold">Quick Actions</div>
            <div class="mt-4 flex gap-2 flex-wrap">
              <button id="goProfile" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                My Profile
              </button>
              <button id="goSecurity" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                Security & Password
              </button>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      async function runSimple(path, title){
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Running " + title + "...";
        const r = await postJson(path, {});

        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = title + " failed: " + (r.data?.message || r.status);
          return;
        }

        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = title + " success.";
        await render();
      }

      async function sendPhoneOtp(){
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Sending phone OTP...";
        const r = await postJson("/api/verification/send-phone-otp", {});

        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Send OTP failed: " + (r.data?.message || r.status);
          return;
        }

        const extra = r.data?.dev_otp ? (" OTP: " + r.data.dev_otp) : "";
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "OTP sent." + extra;
      }

      async function verifyPhoneOtp(otp){
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Verifying OTP...";
        const r = await postJson("/api/verification/verify-phone-otp", { otp });

        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Verify OTP failed: " + (r.data?.message || r.status);
          return;
        }

        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Phone verified.";
        await render();
      }

      async function submitKyc(evidenceText){
        let evidence = {};
        try{
          evidence = evidenceText ? JSON.parse(evidenceText) : {};
        }catch{
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "KYC JSON invalid.";
          return;
        }

        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Submitting KYC...";
        const r = await postJson("/api/verification/submit-kyc", { evidence });

        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Submit KYC failed: " + (r.data?.message || r.status);
          return;
        }

        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "KYC submitted.";
        await render();
      }

      function phoneBlock(){
        return `
          <div class="mt-3 rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="flex gap-2 flex-wrap">
              <button class="btnSendOtp px-4 py-2.5 rounded-2xl bg-amber-600 text-white font-black text-sm">
                Send Phone OTP
              </button>
            </div>
            <div class="mt-3 flex gap-2 flex-wrap">
              <input id="phoneOtpInput" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Input OTP">
              <button class="btnVerifyOtp px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                Verify OTP
              </button>
            </div>
          </div>
        `;
      }

      function kycBlock(){
        return `
          <div class="mt-3 rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
            <div class="text-xs text-slate-500 mb-2">Evidence JSON</div>
            <textarea id="kycEvidenceInput" class="w-full min-h-[140px] px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-mono" placeholder='{"ktp_no":"1234567890","full_name":"John Doe","note":"manual submit"}'></textarea>
            <div class="mt-3">
              <button class="btnSubmitKyc px-4 py-2.5 rounded-2xl bg-amber-600 text-white font-black text-sm">
                Submit KYC
              </button>
            </div>
          </div>
        `;
      }

      async function render(){
        const me = await apiMe();
        const d = me?.data || {};
        const vc = d.verification_compliance || {};
        const vs = d.verification_summary || {};
        const required = Array.isArray(vc.required_actions) ? vc.required_actions : [];

        q("bannerBox").innerHTML = renderVerificationBanner({
          scope: vc.scope || d.verification_policy?.scope || "user",
          required_actions: required
        });
        bindVerificationBanner(q("bannerBox"), Orland);

        q("requiredBox").innerHTML = required.length
          ? required.map(x => {
              const a = actionCard(x);
              if(!a){
                return `
                  <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div class="font-black text-sm text-amber-800">${esc(verificationActionLabel(x))}</div>
                  </div>
                `;
              }

              return `
                <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                  <div class="font-black text-sm text-amber-800">${esc(a.title)}</div>
                  <div class="text-xs text-amber-700 mt-1">${esc(a.desc)}</div>
                  ${
                    a.type === "simple" ? `
                      <div class="mt-3">
                        <button class="btnSimpleAct px-4 py-2.5 rounded-2xl bg-amber-600 text-white font-black text-sm" data-path="${esc(a.path)}" data-title="${esc(a.title)}">
                          ${esc(a.btn)}
                        </button>
                      </div>
                    ` : ``
                  }
                  ${a.type === "phone" ? phoneBlock() : ``}
                  ${a.type === "kyc" ? kycBlock() : ``}
                </div>
              `;
            }).join("")
          : emptyState("Tidak ada action yang diperlukan.");

        q("statusBox").innerHTML = `
          <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
            <span class="text-sm font-semibold">Phone Verified</span>
            ${statusBadge(Number(vs.phone_verified || 0), "verified", "not verified")}
          </div>
          <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
            <span class="text-sm font-semibold">Email Verified</span>
            ${statusBadge(Number(vs.email_verified || 0), "verified", "not verified")}
          </div>
          <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
            <span class="text-sm font-semibold">Email 2FA</span>
            ${statusBadge(Number(vs.email_2fa_enabled || 0), "enabled", "not enabled")}
          </div>
          <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
            <span class="text-sm font-semibold">KYC Status</span>
            <span class="px-2 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-black">${esc(vs.kyc_status || "none")}</span>
          </div>
          <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder px-4 py-3">
            <span class="text-sm font-semibold">Policy Compliance</span>
            ${statusBadge(vc.compliant !== false, "ok", "needs action")}
          </div>
        `;

        q("requiredBox").querySelectorAll(".btnSimpleAct").forEach(btn => {
          btn.onclick = async ()=>{
            await runSimple(
              btn.getAttribute("data-path"),
              btn.getAttribute("data-title")
            );
          };
        });

        q("requiredBox").querySelectorAll(".btnSendOtp").forEach(btn => {
          btn.onclick = async ()=>{ await sendPhoneOtp(); };
        });

        q("requiredBox").querySelectorAll(".btnVerifyOtp").forEach(btn => {
          btn.onclick = async ()=>{
            const otp = q("requiredBox").querySelector("#phoneOtpInput")?.value || "";
            await verifyPhoneOtp(otp);
          };
        });

        q("requiredBox").querySelectorAll(".btnSubmitKyc").forEach(btn => {
          btn.onclick = async ()=>{
            const txt = q("requiredBox").querySelector("#kycEvidenceInput")?.value || "";
            await submitKyc(txt);
          };
        });
      }

      q("btnReload").onclick = render;
      q("goProfile").onclick = ()=>Orland.navigate("/profile");
      q("goSecurity").onclick = ()=>Orland.navigate("/profile/security");

      await render();
    }
  };
}
