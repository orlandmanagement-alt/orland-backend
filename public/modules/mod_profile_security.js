export default function(Orland){
  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  function toast(msg,type="info"){
    const host=document.getElementById("toast-host");
    if(!host){alert(msg);return;}
    const d=document.createElement("div");
    d.className="fixed right-4 top-4 z-[300] rounded-xl px-4 py-3 text-xs shadow-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter";
    d.innerHTML=`<div class="font-bold">${esc(type.toUpperCase())}</div><div class="text-slate-500 mt-1">${esc(msg)}</div>`;
    host.appendChild(d); setTimeout(()=>d.remove(),2800);
  }

  function bindPwToggle(root){
    root.querySelectorAll("[data-pw-toggle]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-pw-toggle");
        const inp = root.querySelector("#"+CSS.escape(id));
        if(!inp) return;
        const isPw = inp.type === "password";
        inp.type = isPw ? "text" : "password";
        btn.innerHTML = isPw ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      });
    });
  }

  async function changePassword(new_password){
    return await Orland.api("/api/profile/password", { method:"POST", body: JSON.stringify({ new_password }) });
  }

  // optional settings (UI only for now, can be wired to system_settings later)
  function readLocalSec(){
    try{ return JSON.parse(localStorage.getItem("admin_security_local")||"{}"); }catch{ return {}; }
  }
  function saveLocalSec(obj){
    localStorage.setItem("admin_security_local", JSON.stringify(obj||{}));
  }

  return {
    title:"Security & Password",
    async mount(host){
      const st = readLocalSec();

      host.innerHTML=`
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="text-base font-bold">Change Password</div>
          <div class="text-xs text-slate-500 mt-1">Min 10 chars.</div>

          <div class="mt-4">
            <div class="relative">
              <input id="pwNew" type="password" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-xs" placeholder="new password (min 10)">
              <button type="button" data-pw-toggle="pwNew" class="absolute right-2 top-1.5 w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5">
                <i class="fa-solid fa-eye"></i>
              </button>
            </div>
            <button id="btnPw" class="mt-3 px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90 w-full">
              Update Password
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="text-base font-bold">2-Step Options (Admin UI)</div>
          <div class="text-xs text-slate-500 mt-1">
            Default: OFF untuk admin/staff/super_admin (sesuai keputusan kamu). Ini hanya UI config lokal dulu.
          </div>

          <div class="mt-4 space-y-3 text-xs">
            <label class="flex items-center gap-2">
              <input id="chkEmail" type="checkbox" class="rounded" ${st.require_email? "checked":""}>
              <span>Require Email step</span>
            </label>
            <label class="flex items-center gap-2">
              <input id="chkPhone" type="checkbox" class="rounded" ${st.require_phone? "checked":""}>
              <span>Require Phone step</span>
            </label>
            <label class="flex items-center gap-2">
              <input id="chkPin" type="checkbox" class="rounded" ${st.require_pin? "checked":""}>
              <span>Require PIN step</span>
            </label>

            <button id="btnSave" class="mt-2 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 w-full">
              Save Settings (Local)
            </button>

            <div class="text-[10px] text-slate-500">
              Next step (PART 4): kita wiring ke <code>system_settings</code> supaya persist di D1 + bisa di toggle dari super_admin.
            </div>
          </div>
        </div>
      </div>`;

      bindPwToggle(host);

      host.querySelector("#btnPw").onclick=async ()=>{
        const pw=String(host.querySelector("#pwNew").value||"");
        if(pw.length<10) return toast("Min 10 chars","error");
        const r=await changePassword(pw);
        toast(r.status, r.status==="ok"?"success":"error");
        if(r.status==="ok") host.querySelector("#pwNew").value="";
      };

      host.querySelector("#btnSave").onclick=()=>{
        const obj={
          require_email: !!host.querySelector("#chkEmail").checked,
          require_phone: !!host.querySelector("#chkPhone").checked,
          require_pin: !!host.querySelector("#chkPin").checked
        };
        saveLocalSec(obj);
        toast("Saved (local)", "success");
      };
    }
  };
}
