import { api, esc, ensureBaseStyles, mountNode } from "./_admin_common.js";

export default function(){
  return {
    title: "Menu Debug",
    async mount(root){
      ensureBaseStyles();
      const host = mountNode(root);

      function renderTree(items){
        if(!items || !items.length) return '<div class="oa-empty">No menu items</div>';
        return `
          <div style="display:grid;gap:10px">
            ${items.map(renderNode).join("")}
          </div>
        `;
      }

      function renderNode(node){
        return `
          <div class="oa-card" style="padding:12px">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap">
              <div>
                <div><b>${esc(node.label || "-")}</b></div>
                <div class="oa-muted">${esc(node.path || "-")}</div>
                <div class="oa-muted">id: ${esc(node.id || "-")} | code: ${esc(node.code || "-")}</div>
              </div>
              <div class="oa-badge">${esc(String(node.sort_order ?? "-"))}</div>
            </div>
            ${node.children && node.children.length ? `
              <div style="margin-top:10px;padding-left:14px;border-left:2px solid #e5e7eb;display:grid;gap:8px">
                ${node.children.map(renderNode).join("")}
              </div>
            ` : ""}
          </div>
        `;
      }

      try{
        const data = await api("/api/nav");
        host.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Menu Debug</h1>
            </div>

            <div class="oa-grid cols-3" style="margin-bottom:12px">
              <div class="oa-card"><div class="oa-stat">Roles<b>${esc((data.roles || []).join(", ") || "-")}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Flat Count<b>${esc(String(data.count || 0))}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Root Items<b>${esc(String((data.items || []).length))}</b></div></div>
            </div>

            ${renderTree(data.items || [])}
          </div>
        `;
      }catch(err){
        host.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Failed load menu debug: ' + esc(err.message) + '</div></div>';
      }
    }
  };
}
