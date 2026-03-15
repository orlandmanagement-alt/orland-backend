import { api, esc, ensureBaseStyles, mountNode, statusBadge, fmtDate, openModal } from "./_admin_common.js";

export default function(){
  return {
    title:"Projects",
    async mount(root){
      ensureBaseStyles();
      const el = mountNode(root);
      let q = "";
      let activeId = "";

      function formHtml(v = {}){
        return `
          <div class="oa-grid cols-2">
            <div class="oa-form-group">
              <label class="oa-form-label">Code</label>
              <input id="f_code" class="oa-input" value="${esc(v.code || "")}">
            </div>
            <div class="oa-form-group">
              <label class="oa-form-label">Status</label>
              <select id="f_status" class="oa-select">
                <option value="draft" ${String(v.status||"draft")==="draft"?"selected":""}>draft</option>
                <option value="active" ${String(v.status||"draft")==="active"?"selected":""}>active</option>
                <option value="hold" ${String(v.status||"draft")==="hold"?"selected":""}>hold</option>
                <option value="done" ${String(v.status||"draft")==="done"?"selected":""}>done</option>
              </select>
            </div>
            <div class="oa-form-group" style="grid-column:1/-1">
              <label class="oa-form-label">Project Name</label>
              <input id="f_name" class="oa-input" value="${esc(v.name || "")}">
            </div>
            <div class="oa-form-group">
              <label class="oa-form-label">Client Name</label>
              <input id="f_client_name" class="oa-input" value="${esc(v.client_name || "")}">
            </div>
            <div class="oa-form-group">
              <label class="oa-form-label">Owner / PIC</label>
              <input id="f_owner_name" class="oa-input" value="${esc(v.owner_name || "")}">
            </div>
            <div class="oa-form-group">
              <label class="oa-form-label">Budget</label>
              <input id="f_budget" type="number" class="oa-input" value="${esc(v.budget || 0)}">
            </div>
            <div class="oa-form-group">
              <label class="oa-form-label">Start Date</label>
              <input id="f_start_date" type="date" class="oa-input" value="${esc(v.start_date || "")}">
            </div>
            <div class="oa-form-group">
              <label class="oa-form-label">End Date</label>
              <input id="f_end_date" type="date" class="oa-input" value="${esc(v.end_date || "")}">
            </div>
          </div>
          <div id="formMsg" class="oa-muted" style="margin-top:12px"></div>
        `;
      }

      function pickerHtml(title, roleDefault){
        return `
          <div class="oa-form-group">
            <label class="oa-form-label">Cari user</label>
            <input id="pick_q" class="oa-input" placeholder="Cari nama / email">
          </div>
          <div class="oa-form-group" style="margin-top:10px">
            <label class="oa-form-label">Role label di project</label>
            <input id="pick_role_label" class="oa-input" value="${esc(roleDefault || "")}">
          </div>
          <div id="pick_stats" class="oa-muted" style="margin-top:10px"></div>
          <div id="pick_list" style="margin-top:10px"></div>
          <div id="pick_paging" class="oa-actions" style="margin-top:12px"></div>
          <div id="pick_msg" class="oa-muted" style="margin-top:12px"></div>
        `;
      }

      function filterItems(items, keyword){
        const q = String(keyword || "").trim().toLowerCase();
        if(!q) return items.slice();
        return items.filter(x => {
          const a = String(x.display_name || "").toLowerCase();
          const b = String(x.email_norm || "").toLowerCase();
          const c = String(x.id || "").toLowerCase();
          return a.includes(q) || b.includes(q) || c.includes(q);
        });
      }

      function paginate(items, page, perPage){
        const total = items.length;
        const totalPages = Math.max(1, Math.ceil(total / perPage));
        const safePage = Math.min(totalPages, Math.max(1, page));
        const start = (safePage - 1) * perPage;
        return {
          page: safePage,
          perPage,
          total,
          totalPages,
          items: items.slice(start, start + perPage)
        };
      }

      async function openProjectForm(mode, values = {}){
        const modal = openModal({
          title: mode === "create" ? "Tambah Project" : "Edit Project",
          bodyHtml: formHtml(values),
          footerHtml: `
            <button class="oa-btn alt" type="button" id="m_cancel">Batal</button>
            <button class="oa-btn" type="button" id="m_save">${mode === "create" ? "Create" : "Save"}</button>
          `
        });

        const g = (id)=>modal.el.querySelector("#" + id);
        g("m_cancel").onclick = modal.close;

        g("m_save").onclick = async ()=>{
          const msg = g("formMsg");
          msg.textContent = "Saving...";

          const payload = {
            code: g("f_code").value.trim(),
            name: g("f_name").value.trim(),
            client_name: g("f_client_name").value.trim(),
            owner_name: g("f_owner_name").value.trim(),
            status: g("f_status").value.trim(),
            budget: Number(g("f_budget").value || 0),
            start_date: g("f_start_date").value.trim(),
            end_date: g("f_end_date").value.trim()
          };

          try{
            if(mode === "create"){
              await api("/api/projects", { method: "POST", body: payload });
            }else{
              await api("/api/projects", {
                method: "PUT",
                body: { action: "update", project_id: values.id, ...payload }
              });
            }

            modal.close();
            await load();
            if(activeId && values.id === activeId) await renderDetail(activeId);
          }catch(err){
            msg.textContent = "Gagal: " + err.message;
          }
        };
      }

      async function openAssignPicker(kind, projectId, pool, roleDefault){
        const modal = openModal({
          title: kind === "talent" ? "Assign Talent" : "Assign Client",
          bodyHtml: pickerHtml(kind === "talent" ? "Talent" : "Client", roleDefault),
          footerHtml: `
            <button class="oa-btn alt" type="button" id="pick_close">Tutup</button>
          `
        });

        const qel = modal.el.querySelector("#pick_q");
        const lel = modal.el.querySelector("#pick_list");
        const pel = modal.el.querySelector("#pick_paging");
        const sel = modal.el.querySelector("#pick_stats");
        const mel = modal.el.querySelector("#pick_msg");
        const roleEl = modal.el.querySelector("#pick_role_label");
        modal.el.querySelector("#pick_close").onclick = modal.close;

        let page = 1;
        const perPage = 8;

        async function renderPicker(){
          const filtered = filterItems(pool, qel.value);
          const pg = paginate(filtered, page, perPage);
          page = pg.page;

          sel.textContent = `Total ${pg.total} item • Page ${pg.page}/${pg.totalPages}`;

          lel.innerHTML = pg.items.length ? pg.items.map(x => `
            <div class="oa-item" style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
              <div style="min-width:0">
                <div><b>${esc(x.display_name || "-")}</b></div>
                <div class="oa-muted">${esc(x.email_norm || "-")}</div>
                <div class="oa-muted" style="font-size:12px">${esc(x.id || "-")}</div>
              </div>
              <div>
                <button class="oa-btn pick-user" data-id="${esc(x.id)}">Pilih</button>
              </div>
            </div>
          `).join("") : `<div class="oa-empty">Data tidak ditemukan.</div>`;

          pel.innerHTML = `
            <button class="oa-btn alt" ${pg.page <= 1 ? 'disabled' : ''} id="pick_prev">Prev</button>
            <button class="oa-btn alt" ${pg.page >= pg.totalPages ? 'disabled' : ''} id="pick_next">Next</button>
          `;

          const prev = modal.el.querySelector("#pick_prev");
          const next = modal.el.querySelector("#pick_next");
          if(prev) prev.onclick = async ()=>{ page--; await renderPicker(); };
          if(next) next.onclick = async ()=>{ page++; await renderPicker(); };

          modal.el.querySelectorAll(".pick-user").forEach(btn=>{
            btn.onclick = async ()=>{
              const user_id = btn.getAttribute("data-id");
              const role_label = roleEl.value.trim();

              mel.textContent = "Assigning...";
              try{
                await api("/api/projects/assignments", {
                  method: "POST",
                  body: {
                    action: kind === "talent" ? "add_talent" : "add_client",
                    project_id: projectId,
                    user_id,
                    role_label
                  }
                });
                modal.close();
                await renderDetail(projectId);
                await load();
              }catch(err){
                mel.textContent = "Gagal: " + err.message;
              }
            };
          });
        }

        qel.oninput = async ()=>{
          page = 1;
          await renderPicker();
        };

        await renderPicker();
      }

      async function load(){
        const data = await api("/api/projects" + (q ? ("?q=" + encodeURIComponent(q)) : ""));
        const items = data.items || [];

        el.innerHTML = `
          <div class="oa-wrap">
            <div class="oa-head">
              <h1 class="oa-title">Projects</h1>
              <div class="oa-tools">
                <input id="prj-q" class="oa-input" placeholder="Cari code / nama / client" value="${esc(q)}">
                <button class="oa-btn alt" id="prj-search">Cari</button>
                <button class="oa-btn" id="prj-add">Tambah Project</button>
              </div>
            </div>

            <div class="oa-grid cols-3" style="margin-bottom:12px">
              <div class="oa-card"><div class="oa-stat">Total Project<b>${esc(items.length)}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Active<b>${esc(items.filter(x => String(x.status) === "active").length)}</b></div></div>
              <div class="oa-card"><div class="oa-stat">Done<b>${esc(items.filter(x => String(x.status) === "done").length)}</b></div></div>
            </div>

            <div class="oa-card" style="overflow:auto">
              <table class="oa-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Project</th>
                    <th>Client</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Talent</th>
                    <th>Client User</th>
                    <th>Updated</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.length ? items.map(x => `
                    <tr>
                      <td>${esc(x.code || "-")}</td>
                      <td>${esc(x.name || "-")}</td>
                      <td>${esc(x.client_name || "-")}</td>
                      <td>${esc(x.owner_name || "-")}</td>
                      <td>${statusBadge(x.status)}</td>
                      <td>${esc(x.talent_count || 0)}</td>
                      <td>${esc(x.client_count || 0)}</td>
                      <td>${esc(fmtDate(x.updated_at))}</td>
                      <td>
                        <div class="oa-actions">
                          <button class="oa-btn alt" data-act="detail" data-id="${esc(x.id)}">Detail</button>
                          <button class="oa-btn alt" data-act="edit" data-json="${esc(JSON.stringify(x))}">Edit</button>
                          <button class="oa-btn warn" data-act="delete" data-id="${esc(x.id)}">Delete</button>
                        </div>
                      </td>
                    </tr>
                  `).join("") : `<tr><td colspan="9"><div class="oa-empty">Belum ada project.</div></td></tr>`}
                </tbody>
              </table>
            </div>

            <div id="detailBox" style="margin-top:12px"></div>
          </div>
        `;

        el.querySelector("#prj-search").onclick = async () => {
          q = String(el.querySelector("#prj-q").value || "").trim();
          await load();
        };

        el.querySelector("#prj-add").onclick = async () => {
          await openProjectForm("create", { status: "draft", budget: 0 });
        };

        el.querySelectorAll("[data-act]").forEach(btn => {
          btn.onclick = async () => {
            const act = btn.getAttribute("data-act");
            const id = btn.getAttribute("data-id");

            try{
              if(act === "detail"){
                activeId = id;
                await renderDetail(id);
                return;
              }

              if(act === "edit"){
                const raw = btn.getAttribute("data-json") || "{}";
                const row = JSON.parse(raw);
                await openProjectForm("edit", row);
                return;
              }

              if(act === "delete"){
                if(!confirm("Hapus project ini?")) return;
                await api("/api/projects", {
                  method: "PUT",
                  body: { action: "delete", project_id: id }
                });
                activeId = "";
                await load();
              }
            }catch(err){
              alert("Aksi gagal: " + err.message);
            }
          };
        });

        if(activeId){
          await renderDetail(activeId);
        }
      }

      async function renderDetail(projectId){
        const box = el.querySelector("#detailBox");
        box.innerHTML = '<div class="oa-card">Loading detail...</div>';

        try{
          const data = await api("/api/projects/detail?project_id=" + encodeURIComponent(projectId));
          const p = data.project || {};
          const talents = data.talents || [];
          const clients = data.clients || [];
          const talentPool = data.talent_pool || [];
          const clientPool = data.client_pool || [];

          box.innerHTML = `
            <div class="oa-card">
              <div class="oa-head">
                <h2 class="oa-title" style="font-size:20px">Detail Project: ${esc(p.name || "-")}</h2>
                <div class="oa-tools">
                  <button class="oa-btn alt" id="asg-talent">Assign Talent</button>
                  <button class="oa-btn alt" id="asg-client">Assign Client</button>
                </div>
              </div>

              <div class="oa-grid cols-3">
                <div class="oa-card"><div class="oa-stat">Code<b>${esc(p.code || "-")}</b></div></div>
                <div class="oa-card"><div class="oa-stat">Status<b>${esc(p.status || "-")}</b></div></div>
                <div class="oa-card"><div class="oa-stat">Budget<b>${esc(p.budget || 0)}</b></div></div>
              </div>

              <div class="oa-grid cols-3" style="margin-top:12px">
                <div class="oa-col">
                  <h3>Talent Assigned</h3>
                  ${talents.length ? talents.map(x => `
                    <div class="oa-item">
                      <div><b>${esc(x.display_name || "-")}</b></div>
                      <div class="oa-muted">${esc(x.email_norm || "-")}</div>
                      <div class="oa-muted">${esc(x.role_label || "-")}</div>
                      <div style="margin-top:6px">
                        <button class="oa-btn warn rm-talent" data-user="${esc(x.user_id)}">Remove</button>
                      </div>
                    </div>
                  `).join("") : `<div class="oa-empty">Belum ada talent</div>`}
                </div>

                <div class="oa-col">
                  <h3>Client Assigned</h3>
                  ${clients.length ? clients.map(x => `
                    <div class="oa-item">
                      <div><b>${esc(x.display_name || "-")}</b></div>
                      <div class="oa-muted">${esc(x.email_norm || "-")}</div>
                      <div class="oa-muted">${esc(x.role_label || "-")}</div>
                      <div style="margin-top:6px">
                        <button class="oa-btn warn rm-client" data-user="${esc(x.user_id)}">Remove</button>
                      </div>
                    </div>
                  `).join("") : `<div class="oa-empty">Belum ada client</div>`}
                </div>

                <div class="oa-col">
                  <h3>Timeline</h3>
                  <div class="oa-item">
                    <div><b>Start</b></div>
                    <div class="oa-muted">${esc(p.start_date || "-")}</div>
                  </div>
                  <div class="oa-item">
                    <div><b>End</b></div>
                    <div class="oa-muted">${esc(p.end_date || "-")}</div>
                  </div>
                  <div class="oa-item">
                    <div><b>Updated</b></div>
                    <div class="oa-muted">${esc(fmtDate(p.updated_at))}</div>
                  </div>
                </div>
              </div>
            </div>
          `;

          box.querySelector("#asg-talent").onclick = async ()=>{
            await openAssignPicker("talent", projectId, talentPool, "member");
          };

          box.querySelector("#asg-client").onclick = async ()=>{
            await openAssignPicker("client", projectId, clientPool, "owner");
          };

          box.querySelectorAll(".rm-talent").forEach(btn=>{
            btn.onclick = async ()=>{
              try{
                await api("/api/projects/assignments", {
                  method: "POST",
                  body: { action: "remove_talent", project_id: projectId, user_id: btn.getAttribute("data-user") }
                });
                await renderDetail(projectId);
                await load();
              }catch(err){
                alert("Gagal remove talent: " + err.message);
              }
            };
          });

          box.querySelectorAll(".rm-client").forEach(btn=>{
            btn.onclick = async ()=>{
              try{
                await api("/api/projects/assignments", {
                  method: "POST",
                  body: { action: "remove_client", project_id: projectId, user_id: btn.getAttribute("data-user") }
                });
                await renderDetail(projectId);
                await load();
              }catch(err){
                alert("Gagal remove client: " + err.message);
              }
            };
          });
        }catch(err){
          box.innerHTML = '<div class="oa-card"><div class="oa-empty">Gagal memuat detail: ' + esc(err.message) + '</div></div>';
        }
      }

      try{
        await load();
      }catch(err){
        el.innerHTML = '<div class="oa-wrap"><div class="oa-empty">Gagal memuat project: ' + esc(err.message) + '</div></div>';
      }
    }
  };
}
