export async function mount(ctx){
  const { host, api, toast } = ctx;

  const me = await api("/api/me");
  if(me.status!=="ok"){
    host.innerHTML = `<div class="text-xs text-slate-500">Unauthorized</div>`;
    return;
  }

  host.innerHTML = `
  <div class="space-y-4">
    <div>
      <div class="text-sm font-bold">My Profile</div>
      <div class="text-xs text-slate-500">Account info + change password</div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4">
        <div class="text-xs font-bold mb-2">Info</div>
        <div class="text-xs text-slate-500">Email: <b class="text-slate-800 dark:text-white">${me.data.email_norm||""}</b></div>
        <div class="text-xs text-slate-500 mt-1">Name: <b class="text-slate-800 dark:text-white">${me.data.display_name||""}</b></div>
        <div class="text-xs text-slate-500 mt-1">Roles: <b class="text-slate-800 dark:text-white">${(me.data.roles||[]).join(", ")}</b></div>
      </div>

      <div class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-4">
        <div class="text-xs font-bold mb-2">Change Password</div>
        <div class="grid grid-cols-1 gap-2">
          <input id="pw" type="password" class="text-xs bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-darkBorder rounded-lg px-3 py-2" placeholder="new password (min 10)">
          <button id="btnPw" class="text-xs px-3 py-2 rounded-lg bg-primary text-white">Update</button>
        </div>
        <div class="text-[11px] text-slate-500 mt-2">Untuk admin/staff tidak wajib 2-step. Bisa diaktifkan manual.</div>
      </div>
    </div>

    <details class="bg-white dark:bg-darkLighter rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm p-3">
      <summary class="text-xs text-slate-500">Debug</summary>
      <pre id="dbg" class="text-[11px] text-slate-500 whitespace-pre-wrap mt-2"></pre>
    </details>
  </div>
  `;

  const el=(id)=>document.getElementById(id);
  el("btnPw").onclick = async ()=>{
    const new_password = String(el("pw").value||"");
    if(new_password.length<10) return toast("Password min 10","error");
    const r = await api("/api/profile/password", { method:"POST", body: JSON.stringify({ new_password }) });
    el("dbg").textContent = JSON.stringify(r,null,2);
    toast(r.status, r.status==="ok"?"success":"error");
    if(r.status==="ok") el("pw").value="";
  };
}
