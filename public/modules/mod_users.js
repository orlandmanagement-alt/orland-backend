export async function mount(ctx){
  const { host, go } = ctx;
  host.innerHTML = `
    <div class="bg-white dark:bg-darkLighter p-5 rounded-xl border border-slate-200 dark:border-darkBorder shadow-sm">
      <div class="text-sm font-bold">User Manager</div>
      <div class="text-xs text-slate-500 mt-2">Pilih kategori user.</div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        ${card("Admin Users","/users/admin","Kelola admin/staff")}
        ${card("Client Users","/users/client","Placeholder (next)")}
        ${card("Talent Directory","/users/talent","Placeholder (next)")}
        ${card("Tenant Mapping","/users/tenant","Placeholder (next)")}
      </div>
    </div>
  `;

  host.querySelectorAll("[data-go]").forEach(b=>{
    b.addEventListener("click", ()=> go(b.getAttribute("data-go")));
  });

  function card(title, path, desc){
    return `
      <button data-go="${path}"
        class="text-left p-4 rounded-xl border border-slate-200 dark:border-darkBorder bg-slate-50/50 dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition">
        <div class="text-sm font-bold text-slate-900 dark:text-white">${title}</div>
        <div class="text-xs text-slate-500 mt-1">${desc}</div>
        <div class="text-xs text-primary mt-3 font-bold">Open →</div>
      </button>
    `;
  }
}
