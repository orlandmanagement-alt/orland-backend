/* Profile dropdown helper (FINAL)
 * - Inject header dropdown (My Profile, Security & Password, Logout)
 * - Uses /api/me to render
 * - Uses Orland.navigate(path) if available, else location.href
 */
(function(){
  "use strict";

  function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
  function diceBear(seed){
    const s = encodeURIComponent(String(seed||"user"));
    return `https://api.dicebear.com/8.x/initials/svg?seed=${s}&backgroundColor=3b82f6&textColor=ffffff`;
  }

  async function api(path, opt={}){
    const headers = Object.assign({}, opt.headers||{});
    if(opt.body!=null && !headers["content-type"]) headers["content-type"]="application/json";
    try{
      const r = await fetch(path, { method: opt.method||"GET", headers, body: opt.body||undefined, credentials:"include" });
      const ct = r.headers.get("content-type")||"";
      if(!ct.includes("application/json")) return { status:"server_error" };
      return await r.json();
    }catch{ return { status:"network_error" }; }
  }

  function closeDD(){
    const dd = document.getElementById("profileDD");
    if(dd) dd.classList.add("hidden");
  }

  function navTo(path){
    if(window.Orland && typeof window.Orland.navigate === "function"){
      window.Orland.navigate(path);
    } else {
      location.href = path;
    }
  }

  async function init(){
    const host = document.getElementById("hdrProfile");
    if(!host) return;

    const me = await api("/api/me");
    if(me.status !== "ok"){
      // if not logged-in, hide profile slot
      host.innerHTML = "";
      return;
    }

    const name = me.data.display_name || "User";
    const email = me.data.email_norm || "";
    const avatar = diceBear(email || me.data.id);

    host.innerHTML = `
      <div class="relative">
        <button id="btnProfile" class="flex items-center gap-2 focus:outline-none">
          <img src="${esc(avatar)}" class="w-8 h-8 rounded-full border border-slate-200 dark:border-darkBorder shadow-sm" alt="avatar">
          <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 hidden sm:block"></i>
        </button>
        <div id="profileDD" class="hidden absolute right-0 mt-3 w-56 bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl shadow-lg py-2 z-50">
          <div class="px-4 py-3 border-b border-slate-100 dark:border-darkBorder">
            <p class="text-sm font-bold text-slate-900 dark:text-white">${esc(name)}</p>
            <p class="text-xs text-slate-500 truncate">${esc(email)}</p>
          </div>
          <div class="py-1">
            <button data-go="/profile" class="w-full text-left flex items-center gap-3 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition">
              <i class="fa-solid fa-user w-4 text-center"></i> My Profile
            </button>
            <button data-go="/profile/security" class="w-full text-left flex items-center gap-3 px-4 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition">
              <i class="fa-solid fa-shield-halved w-4 text-center"></i> Security & Password
            </button>
          </div>
          <div class="py-1 border-t border-slate-100 dark:border-darkBorder">
            <button id="btnDDLogout" class="w-full text-left flex items-center gap-3 px-4 py-2 text-xs font-bold text-danger hover:bg-danger/10 transition cursor-pointer">
              <i class="fa-solid fa-right-from-bracket w-4 text-center"></i> Logout
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btnProfile")?.addEventListener("click", (e)=>{
      e.preventDefault();
      const dd = document.getElementById("profileDD");
      if(!dd) return;
      dd.classList.toggle("hidden");
    });

    document.addEventListener("click", (e)=>{
      const btn = e.target.closest?.("#btnProfile");
      const dd = e.target.closest?.("#profileDD");
      if(btn || dd) return;
      closeDD();
    });

    host.querySelectorAll("[data-go]").forEach(b=>{
      b.addEventListener("click", ()=>{
        closeDD();
        navTo(b.getAttribute("data-go"));
      });
    });

    document.getElementById("btnDDLogout")?.addEventListener("click", async ()=>{
      closeDD();
      await api("/api/logout", { method:"POST", body:"{}" });
      location.href = "/login.html";
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
