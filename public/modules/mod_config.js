export default function ConfigHub(Orland){
  return {
    title: "Configuration",
    async mount(host){
      const nav = Orland.state?.nav?.menus || {};
      const cfg = nav.config || [];
      const root = cfg.find(x => (x.path||"") === "/config");
      const children = root?.submenus || [];
      const first = children[0]?.path || "/config/plugins";

      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
          <div class="text-lg font-extrabold">Configuration</div>
          <div class="text-xs opacity-70 mt-1">Plugins, OTP, Verification, Security Policy, Bulk Tools.</div>

          <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" id="cards"></div>

          <div class="mt-4">
            <button id="btnGo" class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-95">
              Buka default: ${escapeHtml(first)}
            </button>
          </div>
        </div>
      `;

      const cards = host.querySelector("#cards");
      if(cards){
        if(!children.length){
          cards.innerHTML = `<div class="text-xs opacity-70">Submenu Config belum ada.</div>`;
        } else {
          cards.innerHTML = children.map(c=>`
            <button data-p="${escapeHtml(c.path||'')}" class="text-left p-3 rounded-2xl border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
              <div class="text-sm font-extrabold">${escapeHtml(c.label||c.id||'Menu')}</div>
              <div class="text-xs opacity-70 mt-1">${escapeHtml(c.path||'')}</div>
            </button>
          `).join("");
          cards.querySelectorAll("button[data-p]").forEach(b=>{
            b.addEventListener("click", ()=> Orland.navigate(b.getAttribute("data-p")));
          });
        }
      }

      host.querySelector("#btnGo")?.addEventListener("click", ()=> Orland.navigate(first));
    }
  };
}

function escapeHtml(s){
  return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
