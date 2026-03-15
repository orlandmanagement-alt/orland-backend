import { api, esc, ensureBaseStyles, mountNode, fmtDate, statusBadge, openModal } from "./_admin_common.js";

export default function(){
  return {
    title:"Project Invitation Review",
    async mount(root){
      ensureBaseStyles();
      const el = mountNode(root);

      let status = "pending";

      async function load(){
        const qs = new URLSearchParams();
        if(status) qs.set("status", status);

        const data = await api("/api/projects/invites-review" + (qs.toString() ? ("?" + qs.toString()) : ""));
        const items = data.items || [];

        el.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Project Invitation Review</h1>
              <div class="oa-tools">
                <select id="f_status" class="oa-select">
                  <option value="pending" ${status==="pending"?"selected":""}>pending</option>
                  <option value="approved" ${status==="approved"?"selected":""}>approved</option>
                  <option value="rejected" ${status==="rejected"?"selected":""}>rejected</option>
                  <option value="" ${status===""?"selected":""}>semua</option>
                </select>
                <button id="btn_reload" class="oa-btn alt">Reload</button>
              </div>
            </div>

            <div class="oa-grid cols-3" style="margin-bottom:12px">
              <div class="oa-card"><div class="oa-stat">Total<b>${esc(items.length)}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Pending<b>${esc(items.filter(x => String(x.status)==="pending").length)}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Approved<b>${esc(items.filter(x => String(x.status)==="approved").length)}</b></div></div>
            </div>

            <div class="oa-card" style="overflow:auto">
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Role</th>
                    <th>Talent</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Responded</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length ? items.map(x => `
                    <tr>
                      <td>${esc(x.project_title || "-")}</td>
                      <td>${esc(x.role_name || "-")}</td>
                      <td>
                        <div><b>${esc(x.display_name || "-")}</b></div>
                        <div class="oa-muted">${esc(x.email_norm || "-")}</div>
                      </td>
                      <td>
                        <div>${esc(x.message || "-")}</div>
                        <div class="oa-muted">${esc(x.response_message || "")}</div>
                      </td>
                      <td>${statusBadge(x.status)}</td>
                      <td>${esc(fmtDate(x.created_at))}</td>
                      <td>${esc(fmtDate(x.responded_at))}</td>
                      <td>
                        <div class="oa-actions">
                          ${String(x.status) === "pending" ? `
                            <button class="oa-btn act-approve" data-id="${esc(x.id)}">Approve</button>
                            <button class="oa-btn warn act-reject" data-id="${esc(x.id)}">Reject</button>
                          ` : `
                            <button class="oa-btn alt act-view" data-id="${esc(x.id)}" data-note="${esc(x.response_message || "")}" data-status="${esc(x.status || "")}">View</button>
                          `}
                        </div>
                      </td>
                    </tr>
                  `).join("") : `<tr><td colspan="8"><div class="oa-empty">Belum ada data invitation.</div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;

        el.querySelector("#f_status").onchange = async e => {
          status = e.target.value;
          await load();
        };

        el.querySelector("#btn_reload").onclick = load;

        el.querySelectorAll(".act-approve").forEach(btn=>{
          btn.onclick = async ()=>{
            const modal = openModal({
              title: "Approve Invitation",
              bodyHtml: `
                <div class="oa-form-group">
                  <label class="oa-form-label">Approval Note</label>
                  <textarea id="m_note" class="oa-textarea">Approved</textarea>
                </div>
                <div id="m_msg" class="oa-muted" style="margin-top:12px"></div>
              `,
              footerHtml: `
                <button class="oa-btn alt" id="m_cancel" type="button">Batal</button>
                <button class="oa-btn" id="m_save" type="button">Approve</button>
              `
            });

            const q = id => modal.el.querySelector("#" + id);
            q("m_cancel").onclick = modal.close;

            q("m_save").onclick = async ()=>{
              q("m_msg").textContent = "Saving...";
              try{
                await api("/api/projects/invites-review", {
                  method: "POST",
                  body: {
                    action: "approve",
                    invite_id: btn.getAttribute("data-id"),
                    response_message: q("m_note").value.trim()
                  }
                });
                modal.close();
                await load();
              }catch(err){
                q("m_msg").textContent = "Gagal: " + err.message;
              }
            };
          };
        });

        el.querySelectorAll(".act-reject").forEach(btn=>{
          btn.onclick = async ()=>{
            const modal = openModal({
              title: "Reject Invitation",
              bodyHtml: `
                <div class="oa-form-group">
                  <label class="oa-form-label">Reject Note</label>
                  <textarea id="m_note" class="oa-textarea">Rejected</textarea>
                </div>
                <div id="m_msg" class="oa-muted" style="margin-top:12px"></div>
              `,
              footerHtml: `
                <button class="oa-btn alt" id="m_cancel" type="button">Batal</button>
                <button class="oa-btn warn" id="m_save" type="button">Reject</button>
              `
            });

            const q = id => modal.el.querySelector("#" + id);
            q("m_cancel").onclick = modal.close;

            q("m_save").onclick = async ()=>{
              q("m_msg").textContent = "Saving...";
              try{
                await api("/api/projects/invites-review", {
                  method: "POST",
                  body: {
                    action: "reject",
                    invite_id: btn.getAttribute("data-id"),
                    response_message: q("m_note").value.trim()
                  }
                });
                modal.close();
                await load();
              }catch(err){
                q("m_msg").textContent = "Gagal: " + err.message;
              }
            };
          };
        });

        el.querySelectorAll(".act-view").forEach(btn=>{
          btn.onclick = ()=>{
            const modal = openModal({
              title: "Review Detail",
              bodyHtml: `
                <div class="oa-form-group">
                  <label class="oa-form-label">Status</label>
                  <div>${esc(btn.getAttribute("data-status") || "-")}</div>
                </div>
                <div class="oa-form-group" style="margin-top:12px">
                  <label class="oa-form-label">Response Note</label>
                  <div>${esc(btn.getAttribute("data-note") || "-")}</div>
                </div>
              `,
              footerHtml: `
                <button class="oa-btn alt" id="m_close" type="button">Tutup</button>
              `
            });
            modal.el.querySelector("#m_close").onclick = modal.close;
          };
        });
      }

      try{
        await load();
      }catch(err){
        el.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat review invitation: ' + esc(err.message) + '</div></div>';
      }
    }
  };
}
