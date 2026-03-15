import { api, esc, ensureBaseStyles, mountNode, openModal } from "./_admin_common.js";

export default function(){
  return {
    title:"Certificate Templates",
    async mount(root){
      ensureBaseStyles();
      const host = mountNode(root);
      let items = [];
      let selected = null;

      async function load(){
        const data = await api("/api/certificates/templates");
        items = data.items || [];
        render();
      }

      async function seedDefault(){
        await api("/api/certificates/template-seed", {
          method: "POST",
          body: {}
        });
        await load();
      }

      async function setDefault(id){
        await api("/api/certificates/templates", {
          method: "POST",
          body: { action: "set_default", id }
        });
        await load();
      }

      async function activate(id){
        await api("/api/certificates/templates", {
          method: "POST",
          body: { action: "activate", id }
        });
        await load();
      }

      async function deactivate(id){
        await api("/api/certificates/templates", {
          method: "POST",
          body: { action: "deactivate", id }
        });
        await load();
      }

      async function duplicate(id){
        const new_code = prompt("New code", "template_copy");
        if(new_code == null) return;
        const new_name = prompt("New name", "Template Copy");
        if(new_name == null) return;

        await api("/api/certificates/templates", {
          method: "POST",
          body: { action: "duplicate", id, new_code, new_name }
        });
        await load();
      }

      async function previewTemplate(row){
        const res = await api("/api/certificates/template-preview", {
          method: "POST",
          body: {
            html_template: row.html_template || "",
            css_template: row.css_template || "",
            background_url: row.background_url || "",
            vars: {}
          }
        });

        const modal = openModal({
          title: "Preview Template",
          bodyHtml: `<iframe id="cert_preview_frame" style="width:100%;height:75vh;border:1px solid #e5e7eb;border-radius:12px;background:#fff"></iframe>`,
          footerHtml: `<button class="oa-btn alt" id="m_close" type="button">Close</button>`
        });

        modal.el.querySelector("#m_close").onclick = modal.close;
        const frame = modal.el.querySelector("#cert_preview_frame");
        frame.srcdoc = res.html || "";
      }

      function openEditor(row){
        const item = row || {
          id: "",
          code: "",
          name: "",
          description: "",
          mode: "html",
          html_template: "",
          css_template: "",
          background_url: "",
          page_width: "A4-landscape",
          is_default: 0,
          status: "active"
        };

        const modal = openModal({
          title: row ? "Edit Certificate Template" : "Create Certificate Template",
          bodyHtml: `
            <div class="oa-grid cols-2">
              <div class="oa-form-group">
                <label class="oa-form-label">Code</label>
                <input id="ct_code" class="oa-input" value="${esc(item.code || "")}">
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Name</label>
                <input id="ct_name" class="oa-input" value="${esc(item.name || "")}">
              </div>
              <div class="oa-form-group" style="grid-column:1/-1">
                <label class="oa-form-label">Description</label>
                <input id="ct_description" class="oa-input" value="${esc(item.description || "")}">
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Mode</label>
                <select id="ct_mode" class="oa-select">
                  <option value="html" ${item.mode === "html" ? "selected" : ""}>html</option>
                </select>
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Page Width</label>
                <select id="ct_page_width" class="oa-select">
                  <option value="A4-landscape" ${item.page_width === "A4-landscape" ? "selected" : ""}>A4-landscape</option>
                  <option value="A4-portrait" ${item.page_width === "A4-portrait" ? "selected" : ""}>A4-portrait</option>
                </select>
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Background URL</label>
                <input id="ct_bg" class="oa-input" value="${esc(item.background_url || "")}" placeholder="optional">
              </div>
              <div class="oa-form-group">
                <label class="oa-form-label">Status</label>
                <select id="ct_status" class="oa-select">
                  <option value="active" ${item.status === "active" ? "selected" : ""}>active</option>
                  <option value="inactive" ${item.status === "inactive" ? "selected" : ""}>inactive</option>
                </select>
              </div>
              <div class="oa-form-group" style="grid-column:1/-1">
                <label class="oa-form-label">HTML Template</label>
                <textarea id="ct_html" class="oa-textarea" style="min-height:260px">${esc(item.html_template || "")}</textarea>
              </div>
              <div class="oa-form-group" style="grid-column:1/-1">
                <label class="oa-form-label">CSS Template</label>
                <textarea id="ct_css" class="oa-textarea" style="min-height:220px">${esc(item.css_template || "")}</textarea>
              </div>
              <div class="oa-form-group" style="grid-column:1/-1">
                <label class="oa-form-label">Available Placeholders</label>
                <div class="oa-muted">
                  {{name}}, {{role}}, {{project}}, {{organization}}, {{certificate_no}}, {{issue_date}},
                  {{event_date_start}}, {{event_date_end}}, {{city}}, {{description_formal}},
                  {{signer_name}}, {{signer_title}}, {{verification_url}}
                </div>
              </div>
            </div>
            <div id="ct_msg" class="oa-muted" style="margin-top:12px"></div>
          `,
          footerHtml: `
            <button class="oa-btn alt" id="ct_preview" type="button">Preview</button>
            <button class="oa-btn alt" id="ct_cancel" type="button">Cancel</button>
            <button class="oa-btn" id="ct_save" type="button">Save</button>
          `
        });

        const q = id => modal.el.querySelector("#" + id);
        q("ct_cancel").onclick = modal.close;

        q("ct_preview").onclick = async ()=>{
          try{
            const res = await api("/api/certificates/template-preview", {
              method: "POST",
              body: {
                html_template: q("ct_html").value,
                css_template: q("ct_css").value,
                background_url: q("ct_bg").value
              }
            });

            const prev = openModal({
              title: "Template Preview",
              bodyHtml: `<iframe id="cert_preview_frame2" style="width:100%;height:75vh;border:1px solid #e5e7eb;border-radius:12px;background:#fff"></iframe>`,
              footerHtml: `<button class="oa-btn alt" id="m_close2" type="button">Close</button>`
            });
            prev.el.querySelector("#m_close2").onclick = prev.close;
            prev.el.querySelector("#cert_preview_frame2").srcdoc = res.html || "";
          }catch(err){
            q("ct_msg").textContent = "Preview gagal: " + err.message;
          }
        };

        q("ct_save").onclick = async ()=>{
          q("ct_msg").textContent = "Saving...";
          try{
            const body = {
              action: row ? "update" : "create",
              id: row ? row.id : undefined,
              code: q("ct_code").value.trim(),
              name: q("ct_name").value.trim(),
              description: q("ct_description").value.trim(),
              mode: q("ct_mode").value.trim(),
              page_width: q("ct_page_width").value.trim(),
              background_url: q("ct_bg").value.trim(),
              html_template: q("ct_html").value,
              css_template: q("ct_css").value,
              status: q("ct_status").value.trim()
            };
            await api("/api/certificates/templates", {
              method: "POST",
              body
            });
            modal.close();
            await load();
          }catch(err){
            q("ct_msg").textContent = "Save gagal: " + err.message;
          }
        };
      }

      function render(){
        host.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Certificate Templates</h1>
              <div class="oa-tools">
                <button class="oa-btn alt" id="btn_seed">Seed Default</button>
                <button class="oa-btn" id="btn_new">New Template</button>
              </div>
            </div>

            <div class="oa-card">
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Default</th>
                    <th>Mode</th>
                    <th>Updated</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length ? items.map(x => `
                    <tr>
                      <td>
                        <div><b>${esc(x.name || "-")}</b></div>
                        <div class="oa-muted">${esc(x.description || "")}</div>
                      </td>
                      <td>${esc(x.code || "-")}</td>
                      <td>${esc(x.status || "-")}</td>
                      <td>${Number(x.is_default || 0) === 1 ? "yes" : "no"}</td>
                      <td>${esc(x.mode || "-")}</td>
                      <td>${esc(new Date(Number(x.updated_at || 0) * 1000).toLocaleString())}</td>
                      <td>
                        <div class="oa-actions">
                          <button class="oa-btn alt act-preview" data-id="${esc(x.id)}">Preview</button>
                          <button class="oa-btn alt act-edit" data-id="${esc(x.id)}">Edit</button>
                          <button class="oa-btn alt act-dup" data-id="${esc(x.id)}">Duplicate</button>
                          ${Number(x.is_default || 0) !== 1 ? `<button class="oa-btn alt act-default" data-id="${esc(x.id)}">Set Default</button>` : ""}
                          ${x.status === "active" ? `<button class="oa-btn warn act-off" data-id="${esc(x.id)}">Disable</button>` : `<button class="oa-btn act-on" data-id="${esc(x.id)}">Enable</button>`}
                        </div>
                      </td>
                    </tr>
                  `).join("") : `<tr><td colspan="7"><div class="oa-empty">Belum ada template.</div></td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;

        host.querySelector("#btn_seed").onclick = seedDefault;
        host.querySelector("#btn_new").onclick = () => openEditor(null);

        host.querySelectorAll(".act-preview").forEach(btn => {
          btn.onclick = () => {
            const row = items.find(x => x.id === btn.getAttribute("data-id"));
            if(row) previewTemplate(row);
          };
        });

        host.querySelectorAll(".act-edit").forEach(btn => {
          btn.onclick = () => {
            const row = items.find(x => x.id === btn.getAttribute("data-id"));
            if(row) openEditor(row);
          };
        });

        host.querySelectorAll(".act-default").forEach(btn => {
          btn.onclick = () => setDefault(btn.getAttribute("data-id"));
        });

        host.querySelectorAll(".act-off").forEach(btn => {
          btn.onclick = () => deactivate(btn.getAttribute("data-id"));
        });

        host.querySelectorAll(".act-on").forEach(btn => {
          btn.onclick = () => activate(btn.getAttribute("data-id"));
        });

        host.querySelectorAll(".act-dup").forEach(btn => {
          btn.onclick = () => duplicate(btn.getAttribute("data-id"));
        });
      }

      load().catch(err => {
        host.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat template certificate: ' + esc(err.message) + '</div></div>';
      });
    }
  };
}
