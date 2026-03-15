import { api, esc, ensureBaseStyles, mountNode, fmtDate, openModal, statusBadge } from "./_admin_common.js";

export default function(){
  return {
    title:"Project Invite Manager",
    async mount(root){
      ensureBaseStyles();
      const el = mountNode(root);

      let currentRoleId = "";
      let inviteStatus = "";
      let reviewStatus = "pending";

      function copyText(txt){
        if(navigator.clipboard && navigator.clipboard.writeText){
          return navigator.clipboard.writeText(txt);
        }
        const t = document.createElement("textarea");
        t.value = txt;
        document.body.appendChild(t);
        t.select();
        document.execCommand("copy");
        t.remove();
      }

      async function fetchRoles(){
        const r = await api("/api/projects/roles-lite");
        return r.items || [];
      }

      async function fetchInvites(){
        const qs = new URLSearchParams();
        if(currentRoleId) qs.set("project_role_id", currentRoleId);
        if(inviteStatus) qs.set("status", inviteStatus);
        return await api("/api/projects/invite-links" + (qs.toString() ? ("?" + qs.toString()) : ""));
      }

      async function fetchReviews(){
        const qs = new URLSearchParams();
        if(reviewStatus) qs.set("status", reviewStatus);
        return await api("/api/projects/invites-review" + (qs.toString() ? ("?" + qs.toString()) : ""));
      }

      async function load(){
        const [rolesRes, invitesRes, reviewsRes] = await Promise.all([
          fetchRoles(),
          fetchInvites(),
          fetchReviews()
        ]);

        const roles = rolesRes || [];
        const invites = invitesRes.items || [];
        const reviews = reviewsRes.items || [];

        el.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Project Invite Manager</h1>
              <div class="oa-tools">
                <button class="oa-btn" id="btn-new-invite">Buat Invite</button>
                <button class="oa-btn alt" id="btn-reload">Reload</button>
              </div>
            </div>

            <div class="oa-grid cols-3" style="margin-bottom:12px">
              <div class="oa-card"><div class="oa-stat">Project Roles<b>${esc(roles.length)}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Invite Links<b>${esc(invites.length)}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Pending Review<b>${esc(reviews.filter(x => String(x.status) === "pending").length)}</b></div></div>
            </div>

            <div class="oa-card" style="margin-bottom:12px">
              <div class="oa-grid cols-3">
                <div class="oa-form-group">
                  <label class="oa-form-label">Filter Project Role</label>
                  <select id="f_role" class="oa-select">
                    <option value="">Semua</option>
                    ${roles.map(x => `<option value="${esc(x.id)}" ${currentRoleId === x.id ? "selected" : ""}>${esc((x.project_title || "-") + " / " + (x.role_name || "-"))}</option>`).join("")}
                  </select>
                </div>
                <div class="oa-form-group">
                  <label class="oa-form-label">Filter Invite Status</label>
                  <select id="f_invite_status" class="oa-select">
                    <option value="" ${inviteStatus === "" ? "selected" : ""}>Semua</option>
                    <option value="active" ${inviteStatus === "active" ? "selected" : ""}>active</option>
                    <option value="revoked" ${inviteStatus === "revoked" ? "selected" : ""}>revoked</option>
                  </select>
                </div>
                <div class="oa-form-group">
                  <label class="oa-form-label">Filter Review</label>
                  <select id="f_review_status" class="oa-select">
                    <option value="pending" ${reviewStatus === "pending" ? "selected" : ""}>pending</option>
                    <option value="approved" ${reviewStatus === "approved" ? "selected" : ""}>approved</option>
                    <option value="rejected" ${reviewStatus === "rejected" ? "selected" : ""}>rejected</option>
                    <option value="" ${reviewStatus === "" ? "selected" : ""}>semua</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="oa-grid cols-2">
              <div class="oa-card">
                <div class="oa-head">
                  <h2 class="oa-title" style="font-size:18px">Invite Links</h2>
                </div>
                <div style="overflow:auto">
                  <table class="oa-table">
                    <thead>
                      <tr>
                        <th>Project / Role</th>
                        <th>Status</th>
                        <th>Uses</th>
                        <th>Expire</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${invites.length ? invites.map(x => `
                        <tr>
                          <td>
                            <div><b>${esc(x.project_title || "-")}</b></div>
                            <div class="oa-muted">${esc(x.role_name || "-")}</div>
                            <div class="oa-muted">${esc(x.title || "-")}</div>
                          </td>
                          <td>${statusBadge(x.status)}</td>
                          <td>${esc((x.used_count || 0) + " / " + (x.max_uses || 0))}</td>
                          <td>${esc(fmtDate(x.expires_at))}</td>
                          <td>
                            <div class="oa-actions">
                              <button class="oa-btn alt act-copy" data-token="${esc(x.token)}">Copy URL</button>
                              ${String(x.status) === "active"
                                ? `<button class="oa-btn warn act-revoke" data-id="${esc(x.id)}">Revoke</button>`
                                : `<button class="oa-btn alt act-activate" data-id="${esc(x.id)}">Activate</button>`}
                            </div>
                          </td>
                        </tr>
                      `).join("") : `<tr><td colspan="5"><div class="oa-empty">Belum ada invite link.</div></td></tr>`}
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="oa-card">
                <div class="oa-head">
                  <h2 class="oa-title" style="font-size:18px">Invitation Review</h2>
                </div>
                <div style="overflow:auto">
                  <table class="oa-table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Talent</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${reviews.length ? reviews.map(x => `
                        <tr>
                          <td>
                            <div><b>${esc(x.project_title || "-")}</b></div>
                            <div class="oa-muted">${esc(x.role_name || "-")}</div>
                          </td>
                          <td>
                            <div><b>${esc(x.display_name || "-")}</b></div>
                            <div class="oa-muted">${esc(x.email_norm || "-")}</div>
                          </td>
                          <td>${statusBadge(x.status)}</td>
                          <td>${esc(fmtDate(x.created_at))}</td>
                          <td>
                            <div class="oa-actions">
                              ${String(x.status) === "pending" ? `
                                <button class="oa-btn act-approve" data-id="${esc(x.id)}">Approve</button>
                                <button class="oa-btn warn act-reject" data-id="${esc(x.id)}">Reject</button>
                              ` : `<span class="oa-muted">Selesai</span>`}
                            </div>
                          </td>
                        </tr>
                      `).join("") : `<tr><td colspan="5"><div class="oa-empty">Belum ada invitation review.</div></td></tr>`}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        `;

        el.querySelector("#f_role").onchange = async e => {
          currentRoleId = e.target.value;
          await load();
        };

        el.querySelector("#f_invite_status").onchange = async e => {
          inviteStatus = e.target.value;
          await load();
        };

        el.querySelector("#f_review_status").onchange = async e => {
          reviewStatus = e.target.value;
          await load();
        };

        el.querySelector("#btn-reload").onclick = load;

        el.querySelector("#btn-new-invite").onclick = async ()=>{
          const modal = openModal({
            title: "Buat Invite Link",
            bodyHtml: `
              <div class="oa-grid cols-2">
                <div class="oa-form-group" style="grid-column:1/-1">
                  <label class="oa-form-label">Project Role</label>
                  <select id="m_project_role_id" class="oa-select">
                    <option value="">Pilih role</option>
                    ${roles.map(x => `<option value="${esc(x.id)}">${esc((x.project_title || "-") + " / " + (x.role_name || "-"))}</option>`).join("")}
                  </select>
                </div>
                <div class="oa-form-group" style="grid-column:1/-1">
                  <label class="oa-form-label">Title</label>
                  <input id="m_title" class="oa-input" placeholder="Casting invite">
                </div>
                <div class="oa-form-group" style="grid-column:1/-1">
                  <label class="oa-form-label">Message</label>
                  <textarea id="m_message" class="oa-textarea" placeholder="Silakan daftar untuk project ini"></textarea>
                </div>
                <div class="oa-form-group">
                  <label class="oa-form-label">Role Label</label>
                  <input id="m_role_label" class="oa-input" value="talent">
                </div>
                <div class="oa-form-group">
                  <label class="oa-form-label">Max Uses</label>
                  <input id="m_max_uses" type="number" class="oa-input" value="1" min="1">
                </div>
                <div class="oa-form-group">
                  <label class="oa-form-label">Expires At (unix sec)</label>
                  <input id="m_expires_at" type="number" class="oa-input" placeholder="optional">
                </div>
                <div class="oa-form-group">
                  <label class="oa-form-label">Require Approval</label>
                  <select id="m_require_approval" class="oa-select">
                    <option value="1" selected>Ya</option>
                    <option value="0">Tidak</option>
                  </select>
                </div>
                <div class="oa-form-group">
                  <label class="oa-form-label">Auto Create User</label>
                  <select id="m_auto_create_user" class="oa-select">
                    <option value="1" selected>Ya</option>
                    <option value="0">Tidak</option>
                  </select>
                </div>
              </div>
              <div id="m_msg" class="oa-muted" style="margin-top:12px"></div>
            `,
            footerHtml: `
              <button class="oa-btn alt" id="m_cancel" type="button">Batal</button>
              <button class="oa-btn" id="m_save" type="button">Create</button>
            `
          });

          const q = id => modal.el.querySelector("#" + id);
          q("m_cancel").onclick = modal.close;

          q("m_save").onclick = async ()=>{
            q("m_msg").textContent = "Creating...";
            try{
              const res = await api("/api/projects/invite-links", {
                method: "POST",
                body: {
                  project_role_id: q("m_project_role_id").value.trim(),
                  title: q("m_title").value.trim(),
                  message: q("m_message").value.trim(),
                  role_label: q("m_role_label").value.trim(),
                  require_approval: q("m_require_approval").value === "1",
                  auto_create_user: q("m_auto_create_user").value === "1",
                  max_uses: Number(q("m_max_uses").value || 1),
                  expires_at: q("m_expires_at").value ? Number(q("m_expires_at").value) : null
                }
              });

              const fullUrl = location.origin + String(res.invite_url || "");
              await copyText(fullUrl);
              modal.close();
              alert("Invite dibuat dan URL disalin:\n" + fullUrl);
              await load();
            }catch(err){
              q("m_msg").textContent = "Gagal: " + err.message;
            }
          };
        };

        el.querySelectorAll(".act-copy").forEach(btn=>{
          btn.onclick = async ()=>{
            const token = btn.getAttribute("data-token");
            const url = location.origin + "/project-invite?token=" + token;
            try{
              await copyText(url);
              alert("URL invite disalin:\n" + url);
            }catch(err){
              alert("Gagal copy URL");
            }
          };
        });

        el.querySelectorAll(".act-revoke").forEach(btn=>{
          btn.onclick = async ()=>{
            if(!confirm("Revoke invite ini?")) return;
            try{
              await api("/api/projects/invite-links", {
                method: "PUT",
                body: { action: "revoke", id: btn.getAttribute("data-id") }
              });
              await load();
            }catch(err){
              alert("Gagal revoke: " + err.message);
            }
          };
        });

        el.querySelectorAll(".act-activate").forEach(btn=>{
          btn.onclick = async ()=>{
            try{
              await api("/api/projects/invite-links", {
                method: "PUT",
                body: { action: "activate", id: btn.getAttribute("data-id") }
              });
              await load();
            }catch(err){
              alert("Gagal activate: " + err.message);
            }
          };
        });

        el.querySelectorAll(".act-approve").forEach(btn=>{
          btn.onclick = async ()=>{
            const note = prompt("Approval note", "Approved");
            if(note == null) return;
            try{
              await api("/api/projects/invites-review", {
                method: "POST",
                body: {
                  action: "approve",
                  invite_id: btn.getAttribute("data-id"),
                  response_message: note
                }
              });
              await load();
            }catch(err){
              alert("Gagal approve: " + err.message);
            }
          };
        });

        el.querySelectorAll(".act-reject").forEach(btn=>{
          btn.onclick = async ()=>{
            const note = prompt("Reject note", "Rejected");
            if(note == null) return;
            try{
              await api("/api/projects/invites-review", {
                method: "POST",
                body: {
                  action: "reject",
                  invite_id: btn.getAttribute("data-id"),
                  response_message: note
                }
              });
              await load();
            }catch(err){
              alert("Gagal reject: " + err.message);
            }
          };
        });
      }

      try{
        await load();
      }catch(err){
        el.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat invite manager: ' + esc(err.message) + '</div></div>';
      }
    }
  };
}
