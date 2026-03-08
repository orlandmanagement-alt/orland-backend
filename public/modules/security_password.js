(function(){
  const Orland = window.Orland;

  Orland.registerModule("security_password", {
    async mount(host, ctx){
      host.innerHTML = `
        <div class="space-y-4">
          <div>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Security & Password</h2>
            <div class="text-xs text-slate-500">Admin tidak wajib verifikasi 2FA sekarang (bisa diaktifkan nanti)</div>
          </div>

          <div class="bg-white dark:bg-darkLighter p-4 rounded-xl border border-slate-200 dark:border-darkBorder">
            <div class="text-sm font-bold mb-2">Change Password</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input id="pw" type="password" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter text-xs" placeholder="new password (min 10)">
              <button id="btnSave" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">Update</button>
            </div>
            <div class="text-[10px] text-slate-500 mt-2">Endpoint: /api/profile/password</div>
          </div>

          <details class="text-[11px] text-slate-500">
            <summary>Debug</summary>
            <pre id="dbg" class="whitespace-pre-wrap"></pre>
          </details>
        </div>
      `;
      const dbg = document.getElementById("dbg");
      document.getElementById("btnSave").onclick = async ()=>{
        const pw = document.getElementById("pw").value || "";
        if(pw.length<10) return ctx.toast("Min 10 characters","error");
        const r = await ctx.api("/api/profile/password",{method:"POST",body:JSON.stringify({new_password:pw})});
        if(dbg) dbg.textContent = JSON.stringify(r,null,2);
        ctx.toast(r.status, r.status==="ok"?"success":"error");
        if(r.status==="ok") document.getElementById("pw").value="";
      };
    }
  });
})();
