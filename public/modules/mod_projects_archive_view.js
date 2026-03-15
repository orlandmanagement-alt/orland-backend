import { api, esc, ensureBaseStyles, mountNode } from "./_admin_common.js";

export default function(){
  return {
    title:"Projects Archive View",
    async mount(root){
      ensureBaseStyles();
      const host = mountNode(root);

      function getProjectId(){
        const u = new URL(location.href);
        return String(u.searchParams.get("project_id") || "").trim();
      }

      function evidenceFileName(key){
        return String(key || "").split("/").pop() || key || "-";
      }

      function renderProjectList(projects){
        host.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Archived Projects</h1>
            </div>
            <div class="oa-card">
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Organization</th>
                    <th>Location</th>
                    <th>Attendance</th>
                    <th>Certificates</th>
                    <th>Updated</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  ${(projects || []).length ? (projects || []).map(x => `
                    <tr>
                      <td>
                        <div><b>${esc(x.title || "-")}</b></div>
                        <div class="oa-muted">${esc(x.id || "")}</div>
                      </td>
                      <td>${esc(x.organization_name || "-")}</td>
                      <td>${esc(x.location_text || "-")}</td>
                      <td>${esc(String(x.attendance_count || 0))}</td>
                      <td>${esc(String(x.certificate_count || 0))}</td>
                      <td>${esc(new Date(Number(x.updated_at || 0) * 1000).toLocaleString())}</td>
                      <td><a class="oa-btn alt" style="text-decoration:none" href="/projects/archive-view?project_id=${encodeURIComponent(x.id || "")}">Open</a></td>
                    </tr>
                  `).join("") : `<tr><td colspan="7"><div class="oa-empty">Belum ada archived project.</div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      function renderProjectDetail(data){
        const project = data.project || {};
        const attendance = data.attendance || [];
        const certificates = data.certificates || [];
        const credits = data.credits || [];

        host.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Archive Project Detail</h1>
              <div class="oa-tools">
                <a class="oa-btn alt" style="text-decoration:none" href="/projects/archive-view">Back</a>
              </div>
            </div>

            <div class="oa-grid cols-3" style="margin-bottom:12px">
              <div class="oa-card"><div class="oa-stat">Project<b>${esc(project.title || "-")}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Organization<b>${esc(project.organization_name || "-")}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Status<b>${esc(project.status || "-")}</b></div></div>
            </div>

            <div class="oa-card" style="margin-bottom:12px">
              <div class="oa-grid cols-3">
                <div><b>Project ID</b><div class="oa-muted">${esc(project.id || "-")}</div></div>
                <div><b>Type</b><div class="oa-muted">${esc(project.project_type || "-")}</div></div>
                <div><b>Location</b><div class="oa-muted">${esc(project.location_text || "-")}</div></div>
              </div>
              <div style="margin-top:12px"><b>Description</b><div class="oa-muted">${esc(project.description || "-")}</div></div>
            </div>

            <div class="oa-card" style="margin-bottom:12px">
              <h3 style="margin-top:0">Attendance</h3>
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Talent</th>
                    <th>Role</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  ${attendance.length ? attendance.map(x => `
                    <tr>
                      <td>
                        <div><b>${esc(x.display_name || "-")}</b></div>
                        <div class="oa-muted">${esc(x.talent_user_id || "")}</div>
                      </td>
                      <td>${esc(x.role_name || "-")}</td>
                      <td>${esc(x.attendance_date || "-")}</td>
                      <td>${esc(x.status || "-")}</td>
                      <td>
                        ${(x.evidence?.photos || []).length ? `
                          <div style="display:grid;gap:6px">
                            ${(x.evidence.photos || []).map(p => `
                              <div class="oa-badge">${esc(evidenceFileName(p))}</div>
                            `).join("")}
                          </div>
                        ` : `<span class="oa-muted">No evidence</span>`}
                      </td>
                    </tr>
                  `).join("") : `<tr><td colspan="5"><div class="oa-empty">Belum ada attendance.</div></td></tr>`}
                </tbody>
              </table>
            </div>

            <div class="oa-card" style="margin-bottom:12px">
              <h3 style="margin-top:0">Certificates</h3>
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Certificate No</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Issue Date</th>
                    <th>Verify</th>
                    <th>Open</th>
                  </tr>
                </thead>
                <tbody>
                  ${certificates.length ? certificates.map(x => `
                    <tr>
                      <td><b>${esc(x.certificate_no || "-")}</b></td>
                      <td>${esc(x.issued_to_name || "-")}</td>
                      <td>${esc(x.role_title || "-")}</td>
                      <td>${esc(x.issue_date || "-")}</td>
                      <td>${esc(x.verification_code || "-")}</td>
                      <td><a class="oa-btn alt" style="text-decoration:none" href="/certificate/view?id=${encodeURIComponent(x.id || "")}">Open</a></td>
                    </tr>
                  `).join("") : `<tr><td colspan="6"><div class="oa-empty">Belum ada certificate.</div></td></tr>`}
                </tbody>
              </table>
            </div>

            <div class="oa-card">
              <h3 style="margin-top:0">Experience / Credits</h3>
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Talent ID</th>
                    <th>Title</th>
                    <th>Company</th>
                    <th>Month</th>
                    <th>Year</th>
                    <th>About</th>
                  </tr>
                </thead>
                <tbody>
                  ${credits.length ? credits.map(x => `
                    <tr>
                      <td>${esc(x.talent_id || "-")}</td>
                      <td>${esc(x.title || "-")}</td>
                      <td>${esc(x.company || "-")}</td>
                      <td>${esc(x.credit_month || "-")}</td>
                      <td>${esc(String(x.credit_year || "-"))}</td>
                      <td>${esc(x.about || "-")}</td>
                    </tr>
                  `).join("") : `<tr><td colspan="6"><div class="oa-empty">Belum ada experience.</div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      async function init(){
        const projectId = getProjectId();

        if(projectId){
          const data = await api("/api/projects/archive-view?project_id=" + encodeURIComponent(projectId));
          renderProjectDetail(data);
          return;
        }

        const data = await api("/api/projects/archive-view");
        renderProjectList(data.projects || []);
      }

      init().catch(err => {
        host.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat archive view: ' + esc(err.message) + '</div></div>';
      });
    }
  };
}
