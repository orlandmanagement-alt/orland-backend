import { api, esc, ensureBaseStyles, mountNode, fmtDate, statusBadge } from "./_admin_common.js";

export default function(){
  return {
    title:"Talent Verification",
    async mount(root){
      ensureBaseStyles();
      const el = mountNode(root);

      try{
        const data = await api("/api/talent/verification");
        const items = data.items || [];

        el.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Talent Verification</h1>
            </div>
            <div class="oa-card">
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Status User</th>
                    <th>Verification</th>
                    <th>Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length ? items.map(x => `
                    <tr>
                      <td>${esc(x.display_name || "-")}</td>
                      <td>${esc(x.email_norm || "-")}</td>
                      <td>${statusBadge(x.status)}</td>
                      <td>${statusBadge(x.verification_status || "pending")}</td>
                      <td>${esc(fmtDate(x.last_login_at))}</td>
                    </tr>
                  `).join("") : `<tr><td colspan="5"><div class="oa-empty">Belum ada data verification.</div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }catch(err){
        el.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat verification: ' + esc(err.message) + '</div></div>';
      }
    }
  };
}
