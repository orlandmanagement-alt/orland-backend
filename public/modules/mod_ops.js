export default function OpsHub(Orland){
  return {
    title: "OPS Management",
    async mount(host){
      const nav = Orland.state?.nav?.menus || {};
      const sys = nav.system || [];
      const ops = sys.find(x => (x.path||"") === "/ops");
      const children = ops?.submenus || [];
      const first = children[0]?.path || "/ops/incidents";

      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
          <div class="text-lg font-extrabold">OPS Management</div>
          <div class="text-xs opacity-70 mt-1">Incidents, On-Call, Maintenance.</div>

          <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" id="cards"></div>

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
          cards.innerHTML = `<div class="text-xs opacity-70">Submenu OPS tidak ditemukan. Cek menus & role_menus.</div>`;
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
