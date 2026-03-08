export async function mount(ctx){
  const { host } = ctx;
  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="text-sm font-bold">Data Management</div>
      <div class="text-xs text-slate-500 mt-2">Gunakan menu Export / Import untuk enqueue tasks.</div>
    </div>
  `;
}
