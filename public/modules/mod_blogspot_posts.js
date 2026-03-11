export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadLocal(){ return await Orland.api("/api/blogspot/posts"); }
  async function loadRemote(){ return await Orland.api("/api/blogspot/posts?source=remote&maxResults=10"); }
  async function save(payload){
    return await Orland.api("/api/blogspot/posts", {
      method: "POST",
      body: JSON.stringify(payload)
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
    if(s === "published"){
      return `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">published</span>`;
    }
    return `<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-black">draft</span>`;
  }

  function fmtDate(v){
    if(!v) return "-";
    try{
      return new Date(v).toLocaleString("id-ID");
    }catch{
      return String(v);
    }
  }

  function renderRemoteItems(items){
    if(!items.length){
      return `<div class="text-sm text-slate-500">No remote posts.</div>`;
    }

    return items.map(x => `
      <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
        <div class="text-sm font-extrabold">${esc(x.title || "Untitled")}</div>

        <div class="mt-2 space-y-1 text-[11px] text-slate-500">
          <div><span class="font-bold">ID:</span> ${esc(x.id || "-")}</div>
          <div><span class="font-bold">Published:</span> ${esc(fmtDate(x.published))}</div>
          <div><span class="font-bold">Updated:</span> ${esc(fmtDate(x.updated))}</div>
        </div>

        ${x.url ? `
          <div class="mt-3">
            <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" class="text-xs font-bold text-primary break-all">
              ${esc(x.url)}
            </a>
          </div>
        ` : ""}
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
              <div class="text-sm text-slate-500">Local CMS posts + remote Blogger preview.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
              <button id="btnRemote" class="px-4 py-3 rounded-2xl border border-amber-200 text-amber-700 font-black text-sm">
                <i class="fa-solid fa-cloud-arrow-down mr-2"></i>Remote Preview
              </button>
              <button id="btnNew" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
                <i class="fa-solid fa-plus mr-2"></i>New Post
              </button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div class="xl:col-span-2 rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Local Posts</div>
                <input id="qSearch" class="w-full xl:w-72 px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Search title / slug / status">
              </div>
              <div id="listBox" class="mt-4 space-y-3"></div>
              <div class="mt-4 flex items-center justify-between gap-3 flex-wrap">
                <div id="pageInfo" class="text-xs text-slate-500"></div>
                <div class="flex gap-2">
                  <button id="btnPrev" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Prev</button>
                  <button id="btnNext" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black">Next</button>
                </div>
              </div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
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
            <div class="w-full max-w-5xl rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-4 lg:px-5 py-4 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between gap-3">
                <div>
                  <div id="modalTitle" class="text-lg lg:text-xl font-extrabold">Post</div>
                  <div class="text-xs text-slate-500 mt-1">Create / edit post</div>
                </div>
                <button id="btnModalClose" class="w-10 h-10 rounded-full border border-slate-200 dark:border-darkBorder">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div id="modalBody" class="p-4 lg:p-5"></div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let ITEMS = [];
      let PAGE = 1;
      const PAGE_SIZE = 8;

      function setMsg(kind, text){
        q("msg").className = "text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
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

      function openDeleteModal(row){
        openModal("Delete Post", `
          <div class="space-y-4">
            <div class="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div class="font-black text-red-600">Confirm delete</div>
              <div class="text-sm text-slate-700 mt-2">
                Post <span class="font-black">${esc(row.title || row.id)}</span> akan dihapus.
              </div>
              <div class="text-xs text-slate-500 mt-2">${esc(row.slug || "")}</div>
            </div>
            <div class="flex justify-end gap-2">
              <button id="btnCancelDelete" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
              <button id="btnConfirmDelete" class="px-4 py-2.5 rounded-2xl bg-red-600 text-white font-black text-sm">Delete</button>
            </div>
          </div>
        `);

        q("btnCancelDelete").onclick = closeModal;
        q("btnConfirmDelete").onclick = async ()=>{
          setMsg("muted", "Deleting...");
          const r = await save({ action:"delete", id: row.id });
          if(r.status !== "ok"){
            setMsg("error", "Delete failed: " + r.status);
            return;
          }
          closeModal();
          setMsg("success", "Post deleted.");
          await render();
        };
      }

      function formHtml(row = {}){
        const labels = Array.isArray(row.labels_json) ? row.labels_json.join(", ") : "";
        return `
          <form id="postForm" class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="space-y-4">
              <input type="hidden" name="mode" value="${row.id ? "update" : "create"}">

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">ID</label>
                <input name="id" value="${esc(row.id || "")}" ${row.id ? "readonly" : ""} class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 text-sm font-semibold">
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">TITLE</label>
                <input name="title" value="${esc(row.title || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">SLUG</label>
                  <input name="slug" value="${esc(row.slug || "")}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">STATUS</label>
                  <select name="status" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    <option value="draft" ${row.status === "draft" || !row.status ? "selected" : ""}>draft</option>
                    <option value="published" ${row.status === "published" ? "selected" : ""}>published</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">LABELS</label>
                <input name="labels" value="${esc(labels)}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="news, update, campaign">
              </div>

              <div>
                <div class="text-sm font-bold text-slate-500 mb-2">STARTER TEMPLATES</div>
                <div class="flex flex-wrap gap-2">
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-bold" data-template="article">Article</button>
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-bold" data-template="announcement">Announcement</button>
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-bold" data-template="cta">CTA</button>
                </div>
              </div>

              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save</button>
                ${row.id ? `<button type="button" id="btnDeletePost" class="px-4 py-2.5 rounded-2xl border border-red-200 text-red-600 font-black text-sm">Delete</button>` : ``}
                <button type="button" id="btnCancelPost" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">CONTENT HTML</label>
                <textarea name="content_html" id="content_html" rows="16" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-mono">${esc(row.content_html || "")}</textarea>
              </div>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-xs font-black text-slate-500 mb-2">LIVE PREVIEW</div>
                <div id="htmlPreview" class="rounded-2xl bg-slate-50 dark:bg-black/20 p-4 overflow-auto min-h-[180px]"></div>
              </div>
            </div>
          </form>
        `;
      }

      function bindModal(row = {}){
        const form = q("postForm");
        const htmlEl = q("content_html");
        const preview = q("htmlPreview");

        function renderPreview(){
          preview.innerHTML = htmlEl.value || `<div class="text-xs text-slate-500">Empty preview.</div>`;
        }

        renderPreview();
        htmlEl.addEventListener("input", renderPreview);

        q("btnCancelPost")?.addEventListener("click", closeModal);

        q("btnDeletePost")?.addEventListener("click", ()=>{
          closeModal();
          openDeleteModal(row);
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

          if(!payload.title){
            setMsg("error", "Title required.");
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
        const rows = !qv ? ITEMS : ITEMS.filter(x => {
          const hay = [x.title, x.slug, x.status].join(" ").toLowerCase();
          return hay.includes(qv);
        });
        return rows;
      }

      function pagedItems(rows){
        const totalPages = Math.max(1, Math.ceil(rows.length / 8));
        if(PAGE > totalPages) PAGE = totalPages;
        if(PAGE < 1) PAGE = 1;
        const start = (PAGE - 1) * 8;
        return {
          totalPages,
          items: rows.slice(start, start + 8)
        };
      }

      function renderList(){
        const rows = filteredItems();
        const pager = pagedItems(rows);

        if(!rows.length){
          q("listBox").innerHTML = `<div class="text-sm text-slate-500">No local posts.</div>`;
          q("pageInfo").textContent = "0 items";
          return;
        }

        q("listBox").innerHTML = pager.items.map(x => `
          <button class="w-full text-left rounded-2xl border border-slate-200 dark:border-darkBorder p-4 hover:bg-slate-50 dark:hover:bg-white/5 itemRow" data-id="${esc(x.id)}">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-base font-extrabold">${esc(x.title || "Untitled")}</div>
                <div class="text-xs text-slate-500 mt-1">${esc(x.slug || "")}</div>
              </div>
              <div>${statusBadge(x.status)}</div>
            </div>
          </button>
        `).join("");

        q("pageInfo").textContent = `Page ${PAGE} / ${pager.totalPages} • ${rows.length} items`;
        q("btnPrev").disabled = PAGE <= 1;
        q("btnNext").disabled = PAGE >= pager.totalPages;

        q("listBox").querySelectorAll(".itemRow").forEach(btn => {
          btn.onclick = ()=>{
            const row = ITEMS.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(!row) return;
            openModal("Edit Post", formHtml(row));
            bindModal(row);
          };
        });
      }

      async function render(){
        setMsg("muted", "Loading...");
        const r = await loadLocal();
        if(r.status !== "ok"){
          q("listBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          setMsg("error", "Load failed: " + r.status);
          return;
        }
        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        PAGE = 1;
        renderList();
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("qSearch").oninput = ()=>{ PAGE = 1; renderList(); };
      q("btnPrev").onclick = ()=>{ PAGE--; renderList(); };
      q("btnNext").onclick = ()=>{ PAGE++; renderList(); };

      q("btnNew").onclick = ()=>{
        openModal("Create Post", formHtml({}));
        bindModal({});
      };

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
      q("modalBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("modalBackdrop")) closeModal();
      });

      await render();
    }
  };
}
