export async function mount(ctx){
  const { host, pathname } = ctx;
  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="text-sm font-bold">User Manager</div>
      <div class="text-xs text-slate-500 mt-2">UI placeholder: ${pathname}</div>
      <div class="text-xs text-slate-500 mt-2">Gunakan endpoint users/admin.js yang sudah kamu punya. Jika kamu mau, next aku rapikan UI table sesuai template ini.</div>
    </div>
  `;
}
