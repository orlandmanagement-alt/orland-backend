import { api, esc, ensureBaseStyles, mountNode, statusBadge, fmtDate, promptRequired } from "./_admin_common.js";

export default function(){
  return {
    title:"Talent",
    async mount(root){
      ensureBaseStyles();
      const el = mountNode(root);
      let q = "";

      async function load(){
        const data = await api("/api/talent" + (q ? ("?q=" + encodeURIComponent(q)) : ""));
        const users = data.users || [];

        el.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Talent</h1>
              <div class="oa-tools">
                <input id="tal-q" class="oa-input" placeholder="Cari email / nama" value="${esc(q)}">
                <button class="oa-btn alt" id="tal-search">Cari</button>
                <button class="oa-btn" id="tal-add">Tambah Talent</button>
              </div>
            </div>

            <div class="oa-card">
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${users.length ? users.map(u => `
                    <tr>
                      <td>${esc(u.display_name || "-")}</td>
                      <td>${esc(u.email_norm || "-")}</td>
                      <td>${statusBadge(u.status)}</td>
                      <td>${esc(fmtDate(u.last_login_at))}</td>
                      <td>
                        <div class="oa-actions">
                          <button class="oa-btn alt" data-act="edit" data-id="${esc(u.id)}" data-name="${esc(u.display_name || "")}">Edit</button>
                          <button class="oa-btn alt" data-act="reset" data-id="${esc(u.id)}">Reset Password</button>
                          <button class="oa-btn ${String(u.status) === "active" ? "warn" : ""}" data-act="${String(u.status) === "active" ? "disable" : "enable"}" data-id="${esc(u.id)}">
                            ${String(u.status) === "active" ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `).join("") : `<tr><td colspan="5"><div class="oa-empty">Belum ada data talent.</div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;

        el.querySelector("#tal-search").onclick = async () => {
          q = String(el.querySelector("#tal-q").value || "").trim();
          await load();
        };

        el.querySelector("#tal-add").onclick = async () => {
          const email = promptRequired("Email talent");
          if(email == null) return;
          const display_name = promptRequired("Nama talent");
          if(display_name == null) return;
          const password = promptRequired("Password minimal 10 karakter");
          if(password == null) return;

          try{
            await api("/api/talent", {
              method: "POST",
              body: { email, display_name, password, status: "active" }
            });
            alert("Talent berhasil ditambahkan");
            await load();
          }catch(err){
            alert("Gagal tambah talent: " + err.message);
          }
        };

        el.querySelectorAll("[data-act]").forEach(btn => {
          btn.onclick = async () => {
            const act = btn.getAttribute("data-act");
            const user_id = btn.getAttribute("data-id");

            try{
              if(act === "edit"){
                const display_name = promptRequired("Nama baru", btn.getAttribute("data-name") || "");
                if(display_name == null) return;
                await api("/api/talent", {
                  method: "PUT",
                  body: { action: "update_profile", user_id, display_name }
                });
              } else if(act === "reset"){
                const new_password = promptRequired("Password baru minimal 10 karakter");
                if(new_password == null) return;
                await api("/api/talent", {
                  method: "PUT",
                  body: { action: "reset_password", user_id, new_password }
                });
              } else if(act === "disable" || act === "enable"){
                await api("/api/talent", {
                  method: "PUT",
                  body: { action: act, user_id }
                });
              }
              await load();
            }catch(err){
              alert("Aksi gagal: " + err.message);
            }
          };
        });
      }

      try{
        await load();
      }catch(err){
        el.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat talent: ' + esc(err.message) + '</div></div>';
      }
    }
  };
}
