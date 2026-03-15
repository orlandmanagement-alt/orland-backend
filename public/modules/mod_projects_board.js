import { api, esc, ensureBaseStyles, mountNode } from "./_admin_common.js";

export default function(){
  return {
    title:"Project Board",
    async mount(root){
      ensureBaseStyles();
      const el = mountNode(root);

      try{
        const data = await api("/api/projects/board");
        const cols = data.columns || {};
        const names = ["draft", "active", "hold", "done"];

        el.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Project Board</h1>
            </div>
            <div class="oa-grid cols-3" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
              ${names.map(name => `
                <div class="oa-col">
                  <h3>${esc(name.toUpperCase())}</h3>
                  ${((cols[name] || []).length ? (cols[name] || []).map(x => `
                    <div class="oa-item">
                      <div><b>${esc(x.name || "-")}</b></div>
                      <div class="oa-muted">${esc(x.code || "-")}</div>
                      <div class="oa-muted">${esc(x.client_name || "-")}</div>
                      <div class="oa-muted">Owner: ${esc(x.owner_name || "-")}</div>
                    </div>
                  `).join("") : `<div class="oa-empty">Kosong</div>`)}
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }catch(err){
        el.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat board: ' + esc(err.message) + '</div></div>';
      }
    }
  };
}
