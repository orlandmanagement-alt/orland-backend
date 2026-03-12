export async function ensureModuleAccess(Orland, host, config = {}){
  const allow = Array.isArray(config.allow_roles) ? config.allow_roles.map(String) : [];
  const title = String(config.title || "Access Denied");
  const desc = String(config.desc || "Anda tidak memiliki akses ke modul ini.");

  const r = await Orland.api("/api/me");
  if(r.status !== "ok"){
    host.innerHTML = `
      <div class="rounded-3xl border border-red-200 bg-white dark:bg-darkLighter p-5">
        <div class="text-xl font-extrabold text-red-600">Unauthorized</div>
        <div class="text-sm text-slate-500 mt-2">Session tidak valid. Silakan login ulang.</div>
      </div>
    `;
    return { ok:false, me:null };
  }

  const me = r.data || {};
  const roles = Array.isArray(me.roles) ? me.roles.map(String) : [];

  if(allow.length && !allow.some(x => roles.includes(x))){
    host.innerHTML = `
      <div class="rounded-3xl border border-amber-200 bg-white dark:bg-darkLighter p-5">
        <div class="text-xl font-extrabold text-amber-700">${title}</div>
        <div class="text-sm text-slate-500 mt-2">${desc}</div>
        <div class="mt-4 flex gap-2 flex-wrap">
          ${roles.map(x => `<span class="px-3 py-2 rounded-2xl bg-slate-100 text-slate-700 text-xs font-black">${x}</span>`).join("") || `<span class="text-xs text-slate-400">no roles</span>`}
        </div>
      </div>
    `;
    return { ok:false, me };
  }

  return { ok:true, me };
}
