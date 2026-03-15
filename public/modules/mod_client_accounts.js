import { api, esc, ensureBaseStyles, mountNode, fmtDate, statusBadge } from "./_admin_common.js";

export default function(){
  return {
    title:"Client Accounts",
    async mount(root){
      ensureBaseStyles();
      const el = mountNode(root);

      try{
        const data = await api("/api/client/accounts");
        const items = data.items || [];

        el.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Client Accounts</h1>
            </div>
            <div class="oa-card">
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Total Sessions</th>
                    <th>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length ? items.map(x => `
                    <tr>
                      <td>${esc(x.display_name || "-")}</td>
                      <td>${esc(x.email_norm || "-")}</td>
                      <td>${statusBadge(x.status)}</td>
                      <td>${esc(x.total_sessions || 0)}</td>
                      <td>${esc(fmtDate(x.last_login_at))}</td>
                    </tr>
                  `).join("") : `<tr><td colspan="5"><div class="oa-empty">Belum ada account client.</div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }catch(err){
        el.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat client accounts: ' + esc(err.message) + '</div></div>';
      }
    }
  };
}
