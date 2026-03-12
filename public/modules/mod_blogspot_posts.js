import { afvCreateEngine } from "../../assets/js/async_field_validation.js";

export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadSites(){ return await Orland.api("/api/blogspot/sites_multi"); }
  async function loadLocal(){ return await Orland.api("/api/blogspot/posts"); }
  async function loadRemote(){ return await Orland.api("/api/blogspot/posts?source=remote&maxResults=10"); }
  async function loadSchedules(siteId = ""){
    const q = new URLSearchParams({ limit:"200", item_kind:"post" });
    if(siteId) q.set("site_id", siteId);
    return await Orland.api("/api/blogspot/schedule_jobs?" + q.toString());
  }
  async function loadLedger(itemId, siteId = ""){
    const q = new URLSearchParams({ item_kind:"post", item_id:itemId, limit:"30" });
    if(siteId) q.set("site_id", siteId);
    return await Orland.api("/api/blogspot/audit_ledger?" + q.toString());
  }
  async function save(payload){
    return await Orland.api("/api/blogspot/posts", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
  async function publishPost(id, siteId = ""){
    return await Orland.api("/api/blogspot/publish_post", {
      method: "POST",
      body: JSON.stringify({ id, site_id: siteId || null })
    });
  }
  async function deleteRemotePost(id, siteId = ""){
    return await Orland.api("/api/blogspot/delete_remote_post", {
      method: "POST",
      body: JSON.stringify({ id, site_id: siteId || null })
    });
  }
  async function refreshRemotePost(id, siteId = ""){
    return await Orland.api("/api/blogspot/refresh_remote_post", {
      method: "POST",
      body: JSON.stringify({ id, site_id: siteId || null })
    });
  }
  async function createSchedule(payload){
    return await Orland.api("/api/blogspot/schedule_jobs", {
      method:"POST",
      body: JSON.stringify(payload)
    });
  }
  async function enqueuePublish(id, siteId = ""){
    return await Orland.api("/api/blogspot/job_enqueue", {
      method:"POST",
      body: JSON.stringify({
        job_type: "publish_post",
        site_id: siteId || null,
        payload_json: { id, site_id: siteId || null }
      })
    });
  }

  const TEMPLATES = {
    article: `<div class="space-y-4">
  <h2 class="text-2xl font-bold">Article Title</h2>
  <p>Tulis intro artikel di sini.</p>
  <p>Tambahkan isi artikel berikutnya.</p>
</div>`,
    announcement: `<div class="rounded-2xl border border-sky-200 bg-sky-50 p-4">
  <div class="text-lg font-bold text-sky-700">Announcement</div>
  <div class="mt-2 text-sm text-slate-600">Isi pengumuman penting di sini.</div>
</div>`,
    cta: `<div class="rounded-3xl bg-slate-900 text-white p-6">
  <div class="text-2xl font-extrabold">Need attention?</div>
  <div class="text-sm text-slate-300 mt-2">Tambahkan CTA singkat di sini.</div>
  <div class="mt-4"><a href="#" class="inline-flex px-4 py-2 rounded-2xl bg-white text-slate-900 font-bold">Open Link</a></div>
</div>`
  };

  function statusBadge(status){
    const s = String(status || "draft").toLowerCase();
    return s === "published"
      ? `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">published</span>`
      : `<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-black">draft</span>`;
  }

  function syncBadge(row){
    const hasRemote = !!String(row.map_remote_id || row.external_id || "").trim();
    return hasRemote
      ? `<span class="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-black">remote linked</span>`
      : `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">local only</span>`;
  }

  function dirtyBadge(row){
    const dirty = Number(row.map_dirty || 0);
    const deletedRemote = Number(row.map_deleted_remote || 0);
    if(deletedRemote) return `<span class="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-black">remote deleted</span>`;
    if(dirty) return `<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-black">dirty</span>`;
    return `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">synced</span>`;
  }

  function scheduleBadge(schedule){
    if(!schedule) return "";
    const s = String(schedule.status || "").toLowerCase();
    if(s === "scheduled") return `<span class="px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-xs font-black">scheduled</span>`;
    if(s === "queued") return `<span class="px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-black">planner queued</span>`;
    if(s === "failed") return `<span class="px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-black">schedule failed</span>`;
    return "";
  }

  function fmtDate(v){
    if(!v) return "-";
    try{ return new Date(v).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function validationHint(name, hintText){
    return `
      <div class="text-xs text-slate-500 mt-2" data-fve-hint-for="${esc(name)}">${esc(hintText || "")}</div>
      <div class="text-xs text-red-500 mt-2 hidden" data-fve-error-for="${esc(name)}"></div>
      <div class="fve-state hidden mt-2" data-fve-state-for="${esc(name)}"></div>
    `;
  }

  function clearAsyncState(form, name){
    const input = form.querySelector(`[name="${CSS.escape(String(name))}"]`);
    const error = form.querySelector(`[data-fve-error-for="${CSS.escape(String(name))}"]`);
    const state = form.querySelector(`[data-fve-state-for="${CSS.escape(String(name))}"]`);
    input?.classList.remove("is-valid", "is-invalid", "is-warning", "is-checking");
    if(error){
      error.textContent = "";
      error.classList.add("hidden");
    }
    if(state){
      state.textContent = "";
      state.className = "fve-state hidden mt-2";
    }
  }

  function setInlineError(form, name, message){
    const input = form.querySelector(`[name="${CSS.escape(String(name))}"]`);
    const error = form.querySelector(`[data-fve-error-for="${CSS.escape(String(name))}"]`);
    const state = form.querySelector(`[data-fve-state-for="${CSS.escape(String(name))}"]`);
    input?.classList.remove("is-valid", "is-warning", "is-checking");
    input?.classList.add("is-invalid");
    if(error){
      error.textContent = String(message || "");
      error.classList.remove("hidden");
    }
    if(state){
      state.textContent = "Invalid";
      state.className = "fve-state is-invalid mt-2";
    }
  }

  function renderRemoteItems(items){
    return !items.length
      ? `<div class="text-sm text-slate-500">No remote posts.</div>`
      : items.map(x => `
        <div class="rounded-2xl border border-slate-200 p-4">
          <div class="text-sm font-extrabold">${esc(x.title || "Untitled")}</div>
          <div class="mt-2 space-y-1 text-[11px] text-slate-500">
            <div><span class="font-bold">ID:</span> ${esc(x.id || "-")}</div>
            <div><span class="font-bold">Published:</span> ${esc(fmtDate(x.published))}</div>
            <div><span class="font-bold">Updated:</span> ${esc(fmtDate(x.updated))}</div>
          </div>
          ${x.url ? `<div class="mt-3"><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-primary break-all">${esc(x.url)}</a></div>` : ``}
        </div>
      `).join("");
  }

  return {
    title:"Blogspot Posts",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-6xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Posts</div>
              <div class="text-sm text-slate-500">Local CMS posts + remote Blogger + schedule + audit.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <select id="sitePicker" class="px-4 py-3 rounded-2xl border min-w-[220px]">
                <option value="">Loading site...</option>
              </select>
              <button id="btnReload" class="px-4 py-3 rounded-2xl border font-black text-sm"><i class="fa-solid fa-rotate mr-2"></i>Reload</button>
              <button id="btnRemote" class="px-4 py-3 rounded-2xl border border-amber-200 text-amber-700 font-black text-sm"><i class="fa-solid fa-cloud-arrow-down mr-2"></i>Remote Preview</button>
              <button id="btnNew" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm"><i class="fa-solid fa-plus mr-2"></i>New Post</button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div class="xl:col-span-2 rounded-3xl border p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Local Posts</div>
                <input id="qSearch" class="w-full xl:w-72 px-4 py-3 rounded-2xl border text-sm font-semibold" placeholder="Search title / slug / status">
              </div>
              <div id="listBox" class="mt-4 space-y-3"></div>
              <div class="mt-4 flex items-center justify-between gap-3 flex-wrap">
                <div id="pageInfo" class="text-xs text-slate-500"></div>
                <div class="flex gap-2">
                  <button id="btnPrev" class="px-3 py-2 rounded-xl border text-xs font-black">Prev</button>
                  <button id="btnNext" class="px-3 py-2 rounded-xl border text-xs font-black">Next</button>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border p-5">
              <div class="flex items-center justify-between gap-3">
                <div class="text-xl font-extrabold">Remote Preview</div>
                <span id="remoteCount" class="text-xs text-slate-500">0 items</span>
              </div>
              <div id="remoteBox" class="mt-4 space-y-3">
                <div class="text-sm text-slate-500">Click "Remote Preview" untuk memuat Blogger posts.</div>
              </div>
            </div>
          </div>
        </div>

        <div id="modalBackdrop" class="hidden fixed inset-0 z-[100] bg-black/50 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-6xl rounded-3xl border bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-4 lg:px-5 py-4 border-b flex items-center justify-between gap-3">
                <div>
                  <div id="modalTitle" class="text-lg lg:text-xl font-extrabold">Post</div>
                  <div class="text-xs text-slate-500 mt-1">Create / edit post</div>
                </div>
                <button id="btnModalClose" class="w-10 h-10 rounded-full border"><i class="fa-solid fa-xmark"></i></button>
              </div>
              <div id="modalBody" class="p-4 lg:p-5"></div>
            </div>
          </div>
        </div>

        <div id="confirmBackdrop" class="hidden fixed inset-0 z-[120] bg-black/60 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-lg rounded-3xl border bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-5 py-4 border-b">
                <div id="confirmTitle" class="text-lg font-extrabold">Confirm Action</div>
                <div id="confirmDesc" class="text-sm text-slate-500 mt-1">Are you sure?</div>
              </div>
              <div class="p-5">
                <div id="confirmMeta" class="rounded-2xl border bg-slate-50 p-4 text-sm break-words"></div>
                <div class="mt-5 flex justify-end gap-2">
                  <button id="btnConfirmCancel" class="px-4 py-2.5 rounded-2xl border font-black text-sm">Cancel</button>
                  <button id="btnConfirmOk" class="px-4 py-2.5 rounded-2xl bg-red-600 text-white font-black text-sm">Confirm</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let ITEMS = [];
      let PAGE = 1;
      let confirmAction = null;
      let ACTIVE_SITE_ID = "";
      let SCHEDULES = [];

      function setMsg(kind, text){
        q("msg").className = "text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function renderSitePicker(){
        const r = await loadSites();
        if(r.status !== "ok"){
          q("sitePicker").innerHTML = `<option value="">Site load failed</option>`;
          return;
        }
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        const active = items.find(x => Number(x.is_default || 0) === 1) || items[0] || null;
        if(!ACTIVE_SITE_ID && active) ACTIVE_SITE_ID = String(active.id || "");
        q("sitePicker").innerHTML = items.length
          ? items.map(x => `<option value="${esc(x.id)}" ${String(x.id) === String(ACTIVE_SITE_ID) ? "selected" : ""}>${esc(x.blog_name || x.id)} (${esc(x.id)})</option>`).join("")
          : `<option value="">No site</option>`;
      }

      function openModal(title, body){
        q("modalTitle").textContent = title || "Post";
        q("modalBody").innerHTML = body || "";
        q("modalBackdrop").classList.remove("hidden");
      }

      function closeModal(){
        q("modalBackdrop").classList.add("hidden");
        q("modalBody").innerHTML = "";
      }

      function openConfirm(title, desc, metaHtml, onOk, danger = true){
        q("confirmTitle").textContent = title || "Confirm";
        q("confirmDesc").textContent = desc || "";
        q("confirmMeta").innerHTML = metaHtml || "-";
        confirmAction = onOk;
        q("btnConfirmOk").className = danger
          ? "px-4 py-2.5 rounded-2xl bg-red-600 text-white font-black text-sm"
          : "px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-sm";
        q("btnConfirmOk").textContent = danger ? "Confirm" : "Continue";
        q("confirmBackdrop").classList.remove("hidden");
      }

      function closeConfirm(){
        q("confirmBackdrop").classList.add("hidden");
        q("confirmMeta").innerHTML = "";
        confirmAction = null;
      }

      function findScheduleForPost(id){
        return SCHEDULES.find(x => String(x.item_id || "") === String(id) && ["scheduled","queued","failed"].includes(String(x.status || "").toLowerCase())) || null;
      }

      function formHtml(row = {}){
        const labels = Array.isArray(row.labels_json) ? row.labels_json.join(", ") : "";
        const hasRemote = !!String(row.external_id || row.map_remote_id || "").trim();
        const schedule = row?.__schedule || null;

        return `
          <form id="postForm" class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="space-y-4">
              <input type="hidden" name="mode" value="${row.id ? "update" : "create"}">

              <div class="flex flex-wrap gap-2">
                ${statusBadge(row.status)}
                ${syncBadge(row)}
                ${dirtyBadge(row)}
                ${scheduleBadge(schedule)}
              </div>

              <div class="rounded-2xl border p-3 text-xs text-slate-500">
                Site ID: <span class="font-black">${esc(ACTIVE_SITE_ID || "-")}</span>
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">ID</label>
                <input name="id" value="${esc(row.id || "")}" ${row.id ? "readonly" : ""} class="w-full px-4 py-3 rounded-2xl border bg-slate-50 text-sm font-semibold">
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">TITLE</label>
                <input name="title" value="${esc(row.title || "")}" class="w-full px-4 py-3 rounded-2xl border text-sm font-semibold">
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">SLUG</label>
                  <input name="slug" value="${esc(row.slug || "")}" class="w-full px-4 py-3 rounded-2xl border text-sm font-semibold">
                  ${validationHint("slug", "Slug post harus unik. Live check ke backend.")}
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">STATUS</label>
                  <select name="status" class="w-full px-4 py-3 rounded-2xl border text-sm font-semibold">
                    <option value="draft" ${row.status === "draft" || !row.status ? "selected" : ""}>draft</option>
                    <option value="published" ${row.status === "published" ? "selected" : ""}>published</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">LABELS</label>
                <input name="labels" value="${esc(labels)}" class="w-full px-4 py-3 rounded-2xl border text-sm font-semibold" placeholder="news, update, campaign">
              </div>

              ${row.url ? `<div class="rounded-2xl border border-sky-200 bg-sky-50 p-4"><div class="text-xs font-black text-sky-700">REMOTE URL</div><a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer" class="mt-2 block text-sm font-bold text-primary break-all">${esc(row.url)}</a></div>` : ``}

              <div>
                <div class="text-sm font-bold text-slate-500 mb-2">STARTER TEMPLATES</div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border text-xs font-bold" data-template="article">Article</button>
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border text-xs font-bold" data-template="announcement">Announcement</button>
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border text-xs font-bold" data-template="cta">CTA</button>
                </div>
              </div>

              ${row.id ? `
              <div class="rounded-2xl border p-4">
                <div class="text-sm font-black">Schedule Publish</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  <input id="scheduleAt" type="datetime-local" class="px-4 py-3 rounded-2xl border text-sm font-semibold">
                  <button type="button" id="btnSchedulePost" class="px-4 py-3 rounded-2xl border border-violet-200 text-violet-700 font-black text-sm">Create Schedule</button>
                </div>
              </div>
              ` : ``}

              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save</button>
                ${row.id ? `<button type="button" id="btnPublishPost" class="px-4 py-2.5 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">Publish to Blogger</button>` : ``}
                ${row.id ? `<button type="button" id="btnEnqueuePublish" class="px-4 py-2.5 rounded-2xl border border-indigo-200 text-indigo-700 font-black text-sm">Enqueue Publish</button>` : ``}
                ${hasRemote ? `<button type="button" id="btnRefreshRemotePost" class="px-4 py-2.5 rounded-2xl border border-sky-200 text-sky-700 font-black text-sm">Refresh Remote</button>` : ``}
                ${hasRemote ? `<button type="button" id="btnDeleteRemotePost" class="px-4 py-2.5 rounded-2xl border border-rose-200 text-rose-700 font-black text-sm">Delete Remote</button>` : ``}
                ${row.id ? `<button type="button" id="btnViewAudit" class="px-4 py-2.5 rounded-2xl border border-slate-200 font-black text-sm">View Audit</button>` : ``}
                ${row.id ? `<button type="button" id="btnDeletePost" class="px-4 py-2.5 rounded-2xl border border-red-200 text-red-600 font-black text-sm">Delete</button>` : ``}
                <button type="button" id="btnCancelPost" class="px-4 py-2.5 rounded-2xl border font-black text-sm">Cancel</button>
              </div>

              <div id="auditMiniBox" class="space-y-2"></div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">CONTENT HTML</label>
                <textarea name="content_html" id="content_html" rows="16" class="w-full px-4 py-3 rounded-2xl border text-sm font-mono">${esc(row.content_html || "")}</textarea>
              </div>

              <div class="rounded-2xl border p-3">
                <div class="text-xs font-black text-slate-500 mb-2">LIVE PREVIEW</div>
                <div id="htmlPreview" class="rounded-2xl bg-slate-50 p-4 overflow-auto min-h-[180px]"></div>
              </div>
            </div>
          </form>
        `;
      }

      function openDeleteLocal(row){
        openConfirm(
          "Delete Local Post",
          "This action will remove the local post from D1.",
          `<div class="font-black text-red-600">${esc(row.title || row.id)}</div><div class="text-xs text-slate-500 mt-2">${esc(row.slug || "-")}</div>`,
          async ()=>{
            setMsg("muted", "Deleting...");
            const r = await save({ action:"delete", id: row.id });
            if(r.status !== "ok"){
              setMsg("error", "Delete failed: " + r.status);
              return;
            }
            closeConfirm();
            closeModal();
            setMsg("success", "Post deleted.");
            await render();
          },
          true
        );
      }

      function openDeleteRemote(row){
        openConfirm(
          "Delete Remote Blogger Post",
          "This action will remove the post from Blogger remote.",
          `<div class="font-black text-rose-700">${esc(row.title || row.id)}</div><div class="text-xs text-slate-500 mt-2">Remote ID: ${esc(row.external_id || row.map_remote_id || "-")}</div>`,
          async ()=>{
            setMsg("muted", "Deleting remote Blogger post...");
            const r = await deleteRemotePost(row.id, ACTIVE_SITE_ID);
            if(r.status !== "ok"){
              setMsg("error", "Remote delete failed: " + r.status);
              return;
            }
            closeConfirm();
            closeModal();
            setMsg("success", "Remote Blogger post deleted.");
            await render();
          },
          true
        );
      }

      function openPublishRemote(row){
        openConfirm(
          "Publish Post to Blogger",
          "This action will create or update the remote Blogger post.",
          `<div class="font-black text-emerald-700">${esc(row.title || row.id)}</div><div class="text-xs text-slate-500 mt-2">${esc(row.slug || "-")}</div><div class="mt-3 flex gap-2 flex-wrap">${statusBadge(row.status)}${syncBadge(row)}${dirtyBadge(row)}${scheduleBadge(row.__schedule)}</div>`,
          async ()=>{
            setMsg("muted", "Publishing to Blogger...");
            const r = await publishPost(row.id, ACTIVE_SITE_ID);
            if(r.status !== "ok"){
              setMsg("error", "Publish failed: " + r.status);
              return;
            }
            closeConfirm();
            closeModal();
            setMsg("success", "Post published to Blogger.");
            await render();
          },
          false
        );
      }

      async function bindAuditMini(row){
        const box = q("auditMiniBox");
        if(!box || !row?.id) return;
        box.innerHTML = `<div class="text-xs text-slate-500">Loading audit...</div>`;
        const r = await loadLedger(row.id, ACTIVE_SITE_ID);
        if(r.status !== "ok"){
          box.innerHTML = `<div class="text-xs text-red-500">Audit load failed.</div>`;
          return;
        }
        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        box.innerHTML = !items.length
          ? `<div class="text-xs text-slate-500">No audit entries.</div>`
          : `
            <div class="rounded-2xl border p-3">
              <div class="text-xs font-black text-slate-500 mb-2">LATEST AUDIT</div>
              <div class="space-y-2">
                ${items.slice(0, 5).map(x => `
                  <div class="rounded-xl bg-slate-50 p-3">
                    <div class="text-xs font-black">${esc(x.event_type || "-")}</div>
                    <div class="text-[11px] text-slate-500 mt-1">${esc(fmtDate((x.created_at || 0) * 1000))}</div>
                  </div>
                `).join("")}
              </div>
            </div>
          `;
      }

      function bindModal(row = {}){
        const form = q("postForm");
        const htmlEl = q("content_html");
        const preview = q("htmlPreview");

        const asyncEngine = afvCreateEngine(form, {
          slug: {
            debounce_ms: 500,
            min_length: 2,
            skip_if_empty: true,
            validate: async (value)=>{
              const r = await Orland.api("/api/validate/post-slug", {
                method: "POST",
                body: JSON.stringify({
                  slug: value,
                  exclude_id: row?.id || ""
                })
              });
              if(r.status !== "ok") return { ok:false, message:"Validation request failed" };
              return r.data?.available
                ? { ok:true, message:"Slug available" }
                : { ok:false, used:true, message:"Slug already used" };
            }
          }
        });

        asyncEngine.bind();

        function renderPreview(){
          preview.innerHTML = htmlEl.value || `<div class="text-xs text-slate-500">Empty preview.</div>`;
        }

        renderPreview();
        bindAuditMini(row);
        htmlEl.addEventListener("input", renderPreview);

        q("btnCancelPost")?.addEventListener("click", closeModal);
        q("btnDeletePost")?.addEventListener("click", ()=> openDeleteLocal(row));
        q("btnDeleteRemotePost")?.addEventListener("click", ()=> openDeleteRemote(row));
        q("btnPublishPost")?.addEventListener("click", ()=> openPublishRemote(row));

        q("btnEnqueuePublish")?.addEventListener("click", async ()=>{
          setMsg("muted", "Enqueue publish...");
          const r = await enqueuePublish(row.id, ACTIVE_SITE_ID);
          if(r.status !== "ok"){
            setMsg("error", "Enqueue failed: " + r.status);
            return;
          }
          setMsg("success", "Publish job enqueued.");
          await render();
        });

        q("btnRefreshRemotePost")?.addEventListener("click", async ()=>{
          setMsg("muted", "Refreshing remote Blogger post...");
          const r = await refreshRemotePost(row.id, ACTIVE_SITE_ID);
          if(r.status !== "ok"){
            setMsg("error", "Remote refresh failed: " + r.status);
            return;
          }
          closeModal();
          setMsg("success", r.data?.remote_deleted ? "Remote post not found. Local map updated." : "Remote post refreshed.");
          await render();
        });

        q("btnSchedulePost")?.addEventListener("click", async ()=>{
          const dt = q("scheduleAt")?.value || "";
          const ts = dt ? Math.floor(new Date(dt).getTime() / 1000) : 0;
          if(!ts){
            setMsg("error", "Schedule datetime required.");
            return;
          }
          setMsg("muted", "Creating schedule...");
          const r = await createSchedule({
            action:"create",
            site_id: ACTIVE_SITE_ID || null,
            item_kind:"post",
            item_id: row.id,
            job_type:"publish_post",
            planned_at: ts,
            timezone:"Asia/Jakarta",
            note:"scheduled from post editor"
          });
          if(r.status !== "ok"){
            setMsg("error", "Schedule failed: " + (r.data?.error || r.status));
            return;
          }
          setMsg("success", "Schedule created.");
          await render();
        });

        q("btnViewAudit")?.addEventListener("click", async ()=>{
          await bindAuditMini(row);
          setMsg("success", "Audit loaded.");
        });

        q("modalBody").querySelectorAll(".tplBtn").forEach(btn => {
          btn.addEventListener("click", ()=>{
            const key = btn.getAttribute("data-template");
            htmlEl.value = TEMPLATES[key] || "";
            renderPreview();
          });
        });

        form.addEventListener("submit", async (ev)=>{
          ev.preventDefault();

          const payload = {
            action: form.mode.value,
            id: form.id.value.trim(),
            title: form.title.value.trim(),
            slug: form.slug.value.trim(),
            status: form.status.value,
            labels_json: form.labels.value.split(",").map(s => s.trim()).filter(Boolean),
            content_html: htmlEl.value
          };

          clearAsyncState(form, "slug");

          if(!payload.title){
            setMsg("error", "Title required.");
            return;
          }

          if(!payload.slug){
            setInlineError(form, "slug", "Slug wajib diisi.");
            setMsg("error", "Periksa field post yang belum valid.");
            return;
          }

          const asyncResult = await asyncEngine.validateAll();
          const asyncHasError = Object.values(asyncResult).some(x => x && x.ok === false);
          if(asyncHasError){
            setMsg("error", "Masih ada unique field post yang bentrok.");
            return;
          }

          if(asyncEngine.isBusy()){
            setMsg("error", "Masih menunggu pengecekan field post.");
            return;
          }

          setMsg("muted", "Saving...");
          const r = await save(payload);
          if(r.status !== "ok"){
            setMsg("error", "Save failed: " + r.status);
            return;
          }

          closeModal();
          setMsg("success", "Post saved.");
          await render();
        });
      }

      function filteredItems(){
        const qv = String(q("qSearch").value || "").trim().toLowerCase();
        return !qv ? ITEMS : ITEMS.filter(x => {
          const hay = [x.title, x.slug, x.status, x.external_id ? "remote linked" : "local only"].join(" ").toLowerCase();
          return hay.includes(qv);
        });
      }

      function pagedItems(rows){
        const totalPages = Math.max(1, Math.ceil(rows.length / 8));
        if(PAGE > totalPages) PAGE = totalPages;
        if(PAGE < 1) PAGE = 1;
        const start = (PAGE - 1) * 8;
        return { totalPages, items: rows.slice(start, start + 8) };
      }

      function renderList(){
        const rows = filteredItems().map(x => ({ ...x, __schedule: findScheduleForPost(x.id) }));
        const pager = pagedItems(rows);

        if(!rows.length){
          q("listBox").innerHTML = `<div class="text-sm text-slate-500">No local posts.</div>`;
          q("pageInfo").textContent = "0 items";
          return;
        }

        q("listBox").innerHTML = pager.items.map(x => `
          <button class="w-full text-left rounded-2xl border p-4 hover:bg-slate-50 itemRow" data-id="${esc(x.id)}">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-base font-extrabold">${esc(x.title || "Untitled")}</div>
                <div class="text-xs text-slate-500 mt-1">${esc(x.slug || "")}</div>
                <div class="flex gap-2 flex-wrap mt-3">
                  ${statusBadge(x.status)}
                  ${syncBadge(x)}
                  ${dirtyBadge(x)}
                  ${scheduleBadge(x.__schedule)}
                </div>
              </div>
            </div>
          </button>
        `).join("");

        q("pageInfo").textContent = `Page ${PAGE} / ${pager.totalPages} • ${rows.length} items`;
        q("btnPrev").disabled = PAGE <= 1;
        q("btnNext").disabled = PAGE >= pager.totalPages;

        q("listBox").querySelectorAll(".itemRow").forEach(btn => {
          btn.onclick = ()=>{
            const row = rows.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(!row) return;
            openModal("Edit Post", formHtml(row));
            bindModal(row);
          };
        });
      }

      async function render(){
        setMsg("muted", "Loading...");
        await renderSitePicker();

        const [r, s] = await Promise.all([
          loadLocal(),
          loadSchedules(ACTIVE_SITE_ID)
        ]);

        if(r.status !== "ok"){
          q("listBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          setMsg("error", "Load failed: " + r.status);
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        SCHEDULES = s.status === "ok" ? (Array.isArray(s.data?.items) ? s.data.items : []) : [];
        PAGE = 1;
        renderList();
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("sitePicker").onchange = async ()=>{
        ACTIVE_SITE_ID = String(q("sitePicker").value || "");
        await render();
      };
      q("qSearch").oninput = ()=>{ PAGE = 1; renderList(); };
      q("btnPrev").onclick = ()=>{ PAGE--; renderList(); };
      q("btnNext").onclick = ()=>{ PAGE++; renderList(); };
      q("btnNew").onclick = ()=>{ openModal("Create Post", formHtml({})); bindModal({}); };

      q("btnRemote").onclick = async ()=>{
        q("remoteBox").innerHTML = `<div class="text-sm text-slate-500">Loading remote posts...</div>`;
        q("remoteCount").textContent = "loading...";
        const r = await loadRemote();

        if(r.status !== "ok"){
          q("remoteBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          q("remoteCount").textContent = "error";
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        q("remoteBox").innerHTML = renderRemoteItems(items);
        q("remoteCount").textContent = `${items.length} items`;
      };

      q("btnModalClose").onclick = closeModal;
      q("modalBackdrop").addEventListener("click", (e)=>{ if(e.target === q("modalBackdrop")) closeModal(); });
      q("btnConfirmCancel").onclick = closeConfirm;
      q("btnConfirmOk").onclick = async ()=>{ if(typeof confirmAction === "function") await confirmAction(); };
      q("confirmBackdrop").addEventListener("click", (e)=>{ if(e.target === q("confirmBackdrop")) closeConfirm(); });

      await render();
    }
  };
}
