import { api, esc, ensureBaseStyles, mountNode, openModal } from "./_admin_common.js";

export default function(){
  return {
    title:"Issue Certificate",
    async mount(root){
      ensureBaseStyles();
      const host = mountNode(root);
      let templates = [];
      let certificates = [];

      async function loadTemplates(){
        const r = await api("/api/certificates/templates?status=active");
        templates = r.items || [];
      }

      async function loadCertificates(projectId){
        const qs = projectId ? ("?project_id=" + encodeURIComponent(projectId)) : "";
        const r = await api("/api/certificates/issue" + qs);
        certificates = r.items || [];
      }

      function render(){
        host.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Issue Certificate</h1>
              <div class="oa-tools">
                <button class="oa-btn" id="btn_issue_new">Issue New</button>
              </div>
            </div>

            <div class="oa-card">
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Certificate No</th>
                    <th>Name</th>
                    <th>Project</th>
                    <th>Role</th>
                    <th>Issue Date</th>
                    <th>Verify</th>
                  </tr>
                </thead>
                <tbody>
                  ${certificates.length ? certificates.map(x => `
                    <tr>
                      <td><b>${esc(x.certificate_no || "-")}</b></td>
                      <td>${esc(x.issued_to_name || "-")}</td>
                      <td>${esc(x.project_title || "-")}</td>
                      <td>${esc(x.role_title || "-")}</td>
                      <td>${esc(x.issue_date || "-")}</td>
                      <td>${esc(x.verification_code || "-")}</td>
                    </tr>
                  `).join("") : `<tr><td colspan="6"><div class="oa-empty">Belum ada certificate.</div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;

        host.querySelector("#btn_issue_new").onclick = openIssueForm;
      }

      function openIssueForm(){
        const defaultTpl = templates.find(x => Number(x.is_default || 0) === 1) || templates[0] || null;

        const modal = openModal({
          title: "Issue Certificate",
          bodyHtml: `
            <div class="oa-grid cols-2">
              <div class="oa-form-group">
                <label class="oa-form-label">Project ID</label>
                <input id="ci_project_id" class="oa-input" placeholder="required if no project_role_id">
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Project Role ID</label>
                <input id="ci_project_role_id" class="oa-input" placeholder="optional">
              </div>
              <div class="oa-form-group" style="grid-column:1/-1">
                <label class="oa-form-label">Talent User IDs (comma separated, optional)</label>
                <input id="ci_talent_ids" class="oa-input" placeholder="user1,user2,user3">
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Template</label>
                <select id="ci_template_id" class="oa-select">
                  ${templates.map(t => `<option value="${esc(t.id)}" ${defaultTpl && t.id === defaultTpl.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}
                </select>
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Signer Name</label>
                <input id="ci_signer_name" class="oa-input" value="Orland Management">
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Signer Title</label>
                <input id="ci_signer_title" class="oa-input" value="Project Director">
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Event Start</label>
                <input id="ci_event_start" type="date" class="oa-input">
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Event End</label>
                <input id="ci_event_end" type="date" class="oa-input">
              </div>
              <div class="oa-form-group" style="grid-column:1/-1">
                <label class="oa-form-label">City Override</label>
                <input id="ci_city" class="oa-input" placeholder="optional">
              </div>
            </div>
            <div id="ci_msg" class="oa-muted" style="margin-top:12px"></div>
          `,
          footerHtml: `
            <button class="oa-btn alt" id="ci_cancel" type="button">Cancel</button>
            <button class="oa-btn" id="ci_save" type="button">Issue</button>
          `
        });

        const q = id => modal.el.querySelector("#" + id);
        q("ci_cancel").onclick = modal.close;

        q("ci_save").onclick = async ()=>{
          q("ci_msg").textContent = "Issuing...";
          try{
            const talent_user_ids = q("ci_talent_ids").value
              .split(",")
              .map(x => x.trim())
              .filter(Boolean);

            const res = await api("/api/certificates/issue", {
              method: "POST",
              body: {
                action: "issue",
                project_id: q("ci_project_id").value.trim(),
                project_role_id: q("ci_project_role_id").value.trim(),
                template_id: q("ci_template_id").value.trim(),
                signer_name: q("ci_signer_name").value.trim(),
                signer_title: q("ci_signer_title").value.trim(),
                event_date_start: q("ci_event_start").value.trim(),
                event_date_end: q("ci_event_end").value.trim(),
                city: q("ci_city").value.trim(),
                talent_user_ids
              }
            });

            q("ci_msg").textContent = `Issued: ${res.issued_count || 0}, Skipped: ${res.skipped_count || 0}`;
            await loadCertificates(q("ci_project_id").value.trim());
            render();
          }catch(err){
            q("ci_msg").textContent = "Issue gagal: " + err.message;
          }
        };
      }

      Promise.all([
        loadTemplates(),
        loadCertificates("")
      ]).then(render).catch(err => {
        host.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat issue certificate: ' + esc(err.message) + '</div></div>';
      });
    }
  };
}
