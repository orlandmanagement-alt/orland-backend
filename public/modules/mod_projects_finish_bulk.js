import { api, esc, ensureBaseStyles, mountNode, openModal } from "./_admin_common.js";

export default function(){
  return {
    title:"Finish Project Bulk",
    async mount(root){
      ensureBaseStyles();
      const host = mountNode(root);
      let items = [];
      let projectId = "";
      let evidenceStore = {};

      function getQueryProjectId(){
        const u = new URL(location.href);
        return String(u.searchParams.get("project_id") || "").trim();
      }

      function evidenceKey(roleId, talentId){
        return String(roleId || "") + "::" + String(talentId || "");
      }

      async function load(){
        projectId = getQueryProjectId() || projectId;
        if(!projectId){
          renderEmpty("project_id wajib di query string. Contoh: /projects/finish-bulk?project_id=PROJECT_ID");
          return;
        }

        const res = await api("/api/projects/finish-bulk?project_id=" + encodeURIComponent(projectId));
        items = res.items || [];
        render();
      }

      function renderEmpty(msg){
        host.innerHTML = `<div class="oa-wrap"><div class="oa-empty">${esc(msg)}</div></div>`;
      }

      async function uploadEvidence(roleId, talentId, files){
        const attendance_date = document.getElementById("fp_att_date").value.trim();
        const fd = new FormData();
        fd.append("project_id", projectId);
        fd.append("attendance_date", attendance_date);
        fd.append("tag", "attendance");
        for(const f of files) fd.append("files", f);

        const r = await fetch("/api/upload/project-evidence", {
          method: "POST",
          credentials: "include",
          body: fd
        });

        let j = null;
        try{ j = await r.json(); }catch{}
        if(!r.ok){
          throw new Error(j?.data?.message || j?.status || (r.status + " " + r.statusText));
        }

        const out = j?.data || {};
        const key = evidenceKey(roleId, talentId);
        evidenceStore[key] = (evidenceStore[key] || []).concat(out.uploaded || []);
        return out;
      }

      function evidencePreviewHtml(roleId, talentId){
        const key = evidenceKey(roleId, talentId);
        const arr = evidenceStore[key] || [];
        if(!arr.length) return `<div class="oa-muted">No evidence</div>`;
        return `
          <div style="display:grid;gap:6px">
            ${arr.map(x => `
              <div class="oa-badge" style="display:flex;justify-content:space-between;gap:8px;align-items:center">
                <span>${esc((x.key || "").split("/").pop() || "file")}</span>
                <span>${esc(String(x.file_size || 0))}</span>
              </div>
            `).join("")}
          </div>
        `;
      }

      function render(){
        host.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Finish Project Bulk</h1>
              <div class="oa-tools">
                <input id="fp_att_date" class="oa-input" type="date">
                <input id="fp_city" class="oa-input" placeholder="City override">
                <button class="oa-btn alt" id="fp_check_all">Check All</button>
                <button class="oa-btn" id="fp_finish">Finish & Archive</button>
              </div>
            </div>

            <div class="oa-card" style="margin-bottom:12px">
              <div class="oa-stat">Project ID<b>${esc(projectId)}</b></div>
            </div>

            <div class="oa-card">
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Present</th>
                    <th>Talent</th>
                    <th>Role</th>
                    <th>Project</th>
                    <th>Attendance</th>
                    <th>Note</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length ? items.map((x) => `
                    <tr>
                      <td>
                        <input type="checkbox" class="fp_present" data-role="${esc(x.project_role_id || "")}" data-talent="${esc(x.talent_user_id || "")}">
                      </td>
                      <td>
                        <div><b>${esc(x.issued_to_name || "-")}</b></div>
                        <div class="oa-muted">${esc(x.talent_user_id || "")}</div>
                      </td>
                      <td>${esc(x.role_title || "-")}</td>
                      <td>${esc(x.project_title || "-")}</td>
                      <td>${esc(x.attendance_status || "-")}</td>
                      <td>
                        <input class="oa-input fp_note" data-role="${esc(x.project_role_id || "")}" data-talent="${esc(x.talent_user_id || "")}" placeholder="optional note">
                      </td>
                      <td style="min-width:220px">
                        <div style="display:grid;gap:8px">
                          <input type="file" class="fp_file" accept="image/jpeg,image/png,image/webp" multiple data-role="${esc(x.project_role_id || "")}" data-talent="${esc(x.talent_user_id || "")}">
                          <button class="oa-btn alt fp_upload" data-role="${esc(x.project_role_id || "")}" data-talent="${esc(x.talent_user_id || "")}">Upload</button>
                          <div class="fp_evidence_list" id="ev_${esc((x.project_role_id || "").replace(/[^a-zA-Z0-9_-]/g,''))}_${esc((x.talent_user_id || "").replace(/[^a-zA-Z0-9_-]/g,''))}">
                            ${evidencePreviewHtml(x.project_role_id, x.talent_user_id)}
                          </div>
                        </div>
                      </td>
                    </tr>
                  `).join("") : `<tr><td colspan="7"><div class="oa-empty">No talent rows.</div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;

        const d = new Date().toISOString().slice(0,10);
        document.getElementById("fp_att_date").value = d;

        document.getElementById("fp_check_all").onclick = () => {
          host.querySelectorAll(".fp_present").forEach(el => { el.checked = true; });
        };

        host.querySelectorAll(".fp_upload").forEach(btn => {
          btn.onclick = async () => {
            const roleId = btn.getAttribute("data-role");
            const talentId = btn.getAttribute("data-talent");
            const input = host.querySelector(`.fp_file[data-role="${CSS.escape(roleId)}"][data-talent="${CSS.escape(talentId)}"]`);
            const files = input?.files ? Array.from(input.files) : [];
            if(!files.length){
              alert("Pilih file evidence dulu.");
              return;
            }

            const old = btn.textContent;
            btn.textContent = "Uploading...";
            btn.disabled = true;
            try{
              await uploadEvidence(roleId, talentId, files);
              input.value = "";
              const listId = "ev_" + String(roleId || "").replace(/[^a-zA-Z0-9_-]/g,'') + "_" + String(talentId || "").replace(/[^a-zA-Z0-9_-]/g,'');
              const box = document.getElementById(listId);
              if(box) box.innerHTML = evidencePreviewHtml(roleId, talentId);
            }catch(err){
              alert("Upload gagal: " + err.message);
            }finally{
              btn.textContent = old;
              btn.disabled = false;
            }
          };
        });

        document.getElementById("fp_finish").onclick = openConfirm;
      }

      function collectPayload(){
        const attendance_date = document.getElementById("fp_att_date").value.trim();
        const city = document.getElementById("fp_city").value.trim();

        const noteMap = new Map();
        host.querySelectorAll(".fp_note").forEach(el => {
          const key = evidenceKey(el.getAttribute("data-role"), el.getAttribute("data-talent"));
          noteMap.set(key, el.value.trim());
        });

        const selected = [];
        host.querySelectorAll(".fp_present").forEach(el => {
          if(!el.checked) return;
          const project_role_id = String(el.getAttribute("data-role") || "").trim();
          const talent_user_id = String(el.getAttribute("data-talent") || "").trim();
          const key = evidenceKey(project_role_id, talent_user_id);
          selected.push({
            project_role_id,
            talent_user_id,
            present: true,
            note: noteMap.get(key) || "",
            photos: (evidenceStore[key] || []).map(x => x.key)
          });
        });

        return {
          action: "finish",
          project_id: projectId,
          attendance_date,
          event_date_start: attendance_date,
          event_date_end: attendance_date,
          city,
          signer_name: "Orland Management",
          signer_title: "Project Director",
          note: "Bulk finish project",
          selected
        };
      }

      function openConfirm(){
        const payload = collectPayload();
        if(!payload.selected.length){
          alert("Pilih minimal 1 talent yang hadir.");
          return;
        }

        const totalPhotos = payload.selected.reduce((n, x) => n + ((x.photos || []).length), 0);

        const modal = openModal({
          title: "Finish Project & Archive",
          bodyHtml: `
            <div class="oa-grid cols-3">
              <div class="oa-card"><div class="oa-stat">Selected Talent<b>${esc(payload.selected.length)}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Attendance Date<b>${esc(payload.attendance_date || "-")}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Evidence Files<b>${esc(totalPhotos)}</b></div></div>
            </div>
            <div id="fp_msg" class="oa-muted" style="margin-top:12px">
              Sistem akan simpan attendance + evidence, insert experience, issue certificate, lalu archive project.
            </div>
          `,
          footerHtml: `
            <button class="oa-btn alt" id="fp_cancel" type="button">Cancel</button>
            <button class="oa-btn" id="fp_submit" type="button">Finish Now</button>
          `
        });

        modal.el.querySelector("#fp_cancel").onclick = modal.close;

        modal.el.querySelector("#fp_submit").onclick = async ()=>{
          const msg = modal.el.querySelector("#fp_msg");
          msg.textContent = "Processing...";
          try{
            const res = await api("/api/projects/finish-bulk", {
              method: "POST",
              body: payload
            });
            msg.innerHTML = `
              <span style="color:green">
                Success.<br>
                attendance_saved: ${esc(res.attendance_saved || 0)}<br>
                credits_inserted: ${esc(res.credits_inserted || 0)}<br>
                certificates_issued: ${esc(res.certificates_issued || 0)}<br>
                project_archived: ${esc(String(res.project_archived || false))}
              </span>
            `;
            await load();
          }catch(err){
            msg.innerHTML = `<span style="color:#b91c1c">Failed: ${esc(err.message)}</span>`;
          }
        };
      }

      load().catch(err => {
        renderEmpty("Gagal memuat finish bulk: " + err.message);
      });
    }
  };
}
