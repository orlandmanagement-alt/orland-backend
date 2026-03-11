export default function(Orland){
  const esc=(s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  return {
    title:"My Profile",
    async mount(host){
      const me = Orland.state?.me || (await Orland.api("/api/me")).data;
      host.innerHTML=`
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="text-base font-bold">Account</div>
          <div class="text-xs text-slate-500 mt-1">Basic info</div>
          <div class="mt-4 space-y-2 text-xs">
            <div><span class="text-slate-500">Email:</span> <b>${esc(me.email_norm||"")}</b></div>
            <div><span class="text-slate-500">Name:</span> <b>${esc(me.display_name||"")}</b></div>
            <div><span class="text-slate-500">Roles:</span> <b>${esc((me.roles||[]).join(", "))}</b></div>
            <div><span class="text-slate-500">User ID:</span> <code>${esc(me.id||"")}</code></div>
          </div>
        </div>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="text-base font-bold">Quick Actions</div>
          <div class="text-xs text-slate-500 mt-1">Open Security & Password</div>
          <button id="goSec" class="mt-4 px-3 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:opacity-90">
            <i class="fa-solid fa-shield-halved mr-2"></i>Security & Password
          </button>
        </div>
      </div>`;
      host.querySelector("#goSec").onclick=()=>Orland.navigate("/profile/security");
    }
  };
}
