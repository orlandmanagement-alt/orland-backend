import { ensureModuleAccess } from "../assets/js/security_module_guard.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function startChallenge(){
    return await Orland.api("/api/mfa/challenge");
  }

  async function verifyChallenge(payload){
    return await Orland.api("/api/mfa/challenge-verify", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"MFA Challenge",
    async mount(host){
      const access = await ensureModuleAccess(Orland, host, {
        allow_roles: [],
        title: "MFA Challenge",
        desc: "Session tidak valid atau akses tidak tersedia."
      });
      if(!access.ok) return;

      host.innerHTML = `
        <div class="space-y-5 max-w-4xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold ui-title-gradient">MFA Login Challenge</div>
            <div class="text-sm text-slate-500 mt-1">Uji challenge MFA dan recovery code pada staged mode.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="flex gap-2 flex-wrap">
              <button id="btnStart" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Start Challenge</button>
            </div>

            <div id="challengeBox" class="mt-4 text-sm text-slate-500">Klik Start Challenge.</div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let LAST_CHALLENGE_ID = "";

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else if(kind === "warning") q("msg").classList.add("text-amber-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function renderChallenge(data){
        LAST_CHALLENGE_ID = String(data.challenge_id || "");
        q("challengeBox").innerHTML = `
          <div class="space-y-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-xs text-slate-500 font-bold">CHALLENGE ID</div>
              <div class="mt-2 text-sm font-mono break-all">${esc(data.challenge_id || "-")}</div>
            </div>

            <div class="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-700">
              Mode saat ini menggunakan kode placeholder <span class="font-black">123456</span> atau ENV <span class="font-black">MFA_ENROLL_TEST_CODE</span>. Recovery code juga didukung.
            </div>

            <form id="verifyForm" class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">Code / Recovery Code</label>
                <input name="code" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="123456">
              </div>

              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Verify Challenge</button>
              </div>
            </form>
          </div>
        `;

        q("verifyForm").onsubmit = async (ev)=>{
          ev.preventDefault();
          const code = String(q("verifyForm").code.value || "").trim();
          if(!LAST_CHALLENGE_ID || !code){
            setMsg("error", "Challenge dan code wajib ada.");
            return;
          }

          setMsg("muted", "Verifying challenge...");
          const r = await verifyChallenge({
            challenge_id: LAST_CHALLENGE_ID,
            code
          });

          if(r.status !== "ok"){
            setMsg("error", "Verify failed: " + (r.data?.message || r.status));
            return;
          }

          setMsg("success", r.data?.used_recovery_code ? "Verified using recovery code." : "Challenge verified.");
        };
      }

      q("btnStart").onclick = async ()=>{
        setMsg("muted", "Starting challenge...");
        const r = await startChallenge();
        if(r.status !== "ok"){
          setMsg("error", "Start failed: " + (r.data?.message || r.status));
          return;
        }
        renderChallenge(r.data || {});
        setMsg("success", "Challenge created.");
      };
    }
  };
}
