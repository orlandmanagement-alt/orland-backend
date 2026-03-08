export async function mount(ctx){
  const { mountEl, path } = ctx;

  const pretty = (p)=>{
    const m = {
      "/rbac":"RBAC Manager",
      "/audit":"Audit Logs",
      "/security":"Security",
      "/ops":"OPS Management",
      "/ops/incidents":"Incidents & Alerts",
      "/ops/oncall":"On-call Schedule",
      "/data/export":"Export Data",
      "/data/import":"Import Data",
      "/ipblocks":"Banned / IP Blocks",
      "/menus":"Menu Builder",
      "/integrations/blogspot/settings":"Blogspot API Settings",
      "/integrations/blogspot/posts":"Manage Posts",
      "/integrations/blogspot/pages":"Static Pages",
      "/integrations/blogspot/widgets":"Widgets / Home",
      "/config/otp":"OTP Setting",
      "/config/verification":"Verification Setting"
    };
    return m[p] || p;
  };

  mountEl.innerHTML = `
    <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-6 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-lg font-bold">${pretty(path)}</div>
          <div class="text-xs text-slate-500 mt-1">Module belum diaktifkan. (Plug & Play)</div>
        </div>
        <div class="text-slate-400 text-3xl"><i class="fa-solid fa-puzzle-piece"></i></div>
      </div>
      <div class="mt-4 text-xs text-slate-500">
        Path: <code class="px-2 py-1 rounded bg-slate-100 dark:bg-black/30">${path}</code>
      </div>
      <div class="mt-4 text-xs text-slate-500">
        Jika kamu mau, modul ini bisa diubah menjadi CRUD penuh dan tersambung D1/KV/R2.
      </div>
    </div>
  `;
}
