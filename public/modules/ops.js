export async function mount(ctx){
  const { mountEl } = ctx;
  mountEl.innerHTML = `
    <div class="flex flex-col items-center justify-center min-h-[55vh] text-center space-y-4">
      <div class="w-20 h-20 rounded-full bg-slate-100 dark:bg-darkBorder flex items-center justify-center text-3xl text-slate-400">
        <i class="fa-solid fa-layer-group"></i>
      </div>
      <div class="text-lg font-bold">Module placeholder</div>
      <div class="text-xs text-slate-500">Implement this module next.</div>
    </div>
  `;
}
