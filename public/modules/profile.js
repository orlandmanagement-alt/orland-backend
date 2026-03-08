(function(){
  const Orland = window.Orland;

  Orland.registerModule("profile", {
    async mount(host, ctx){
      const me = await ctx.api("/api/me");
      host.innerHTML = `
        <div class="space-y-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">My Profile</h2>
            <div class="text-xs text-slate-500">Info akun kamu</div>
          </div>

          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <pre class="text-[11px] text-slate-500 whitespace-pre-wrap">${ctx.esc(JSON.stringify(me,null,2))}</pre>
          </div>

          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="text-sm font-bold">Go to</div>
            <button id="goSec" class="mt-3 px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Security & Password</button>
          </div>
        </div>
      `;
      document.getElementById("goSec").onclick = ()=>ctx.navigate("/profile/security");
    }
  });
})();
