export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadWidgets(section="", status=""){
    const q = new URLSearchParams();
    if(section) q.set("section", section);
    if(status) q.set("status", status);
    return await Orland.api("/api/blogspot/widgets?" + q.toString());
  }

  async function saveWidget(payload){
    return await Orland.api("/api/blogspot/widgets", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  function statusBadge(v){
    const s = String(v || "active").toLowerCase();
    if(s === "active"){
      return `<span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-black">active</span>`;
    }
    return `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">${esc(s)}</span>`;
  }

  const TEMPLATES = {
    hero: `<div class="rounded-3xl bg-slate-900 text-white p-6">
  <div class="text-3xl font-extrabold">Hero Banner</div>
  <div class="mt-2 text-slate-300">Tambahkan intro singkat di sini.</div>
  <div class="mt-4">
    <a href="#" class="inline-flex px-4 py-2 rounded-2xl bg-white text-slate-900 font-bold">Open</a>
  </div>
</div>`,
    card_grid: `<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div class="rounded-2xl border border-slate-200 p-4"><div class="font-bold">Card 1</div><div class="text-sm text-slate-500 mt-2">Description</div></div>
  <div class="rounded-2xl border border-slate-200 p-4"><div class="font-bold">Card 2</div><div class="text-sm text-slate-500 mt-2">Description</div></div>
  <div class="rounded-2xl border border-slate-200 p-4"><div class="font-bold">Card 3</div><div class="text-sm text-slate-500 mt-2">Description</div></div>
</div>`,
    notice: `<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
  <div class="font-bold text-amber-700">Notice</div>
  <div class="text-sm text-slate-600 mt-2">Tampilkan informasi penting di sini.</div>
</div>`,
    html_block: `<div class="rounded-2xl border border-slate-200 p-4">
  <h3 class="text-xl font-bold">Custom HTML Block</h3>
  <p class="mt-2">Isi HTML bebas di sini.</p>
</div>`
  };

  return {
    title:"Blogspot Widgets / Home",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-7xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Widgets / Home</div>
              <div class="text-sm text-slate-500">Kelola home block / widget berbasis HTML custom.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                <i class="fa-solid fa-rotate mr-2"></i>Reload
              </button>
              <button id="btnNew" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
                <i class="fa-solid fa-plus mr-2"></i>New Widget
              </button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-xl font-extrabold">Filters</div>
                <div class="text-sm text-slate-500 mt-1">Filter berdasarkan section dan status.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <select id="fSection" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="">All section</option>
                  <option value="home" selected>home</option>
                  <option value="hero">hero</option>
                  <option value="sidebar">sidebar</option>
                  <option value="footer">footer</option>
                </select>
                <select id="fStatus" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                  <option value="">All status</option>
                  <option value="active" selected>active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Widgets List</div>
              <div id="listBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold">Preview Selected</div>
              <div id="previewBox" class="mt-4 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 min-h-[240px] overflow-auto">
                <div class="text-sm text-slate-500">Pilih widget dari list untuk preview.</div>
              </div>
            </div>
          </div>
        </div>

        <div id="modalBackdrop" class="hidden fixed inset-0 z-[100] bg-black/50 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-6xl rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-4 lg:px-5 py-4 border-b border-slate-200 dark:border-darkBorder flex items-center justify-between gap-3">
                <div>
                  <div id="modalTitle" class="text-lg lg:text-xl font-extrabold">Widget</div>
                  <div class="text-xs text-slate-500 mt-1">Create / edit widget block</div>
                </div>
                <button id="btnModalClose" class="w-10 h-10 rounded-full border border-slate-200 dark:border-darkBorder">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              <div id="modalBody" class="p-4 lg:p-5"></div>
            </div>
          </div>
        </div>

        <div id="confirmBackdrop" class="hidden fixed inset-0 z-[120] bg-black/60 p-3 lg:p-6 overflow-auto">
          <div class="min-h-full flex items-start lg:items-center justify-center">
            <div class="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
              <div class="px-5 py-4 border-b border-slate-200 dark:border-darkBorder">
                <div id="confirmTitle" class="text-lg font-extrabold">Confirm Action</div>
                <div id="confirmDesc" class="text-sm text-slate-500 mt-1">Are you sure?</div>
              </div>
              <div class="p-5">
                <div id="confirmMeta" class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-4 text-sm break-words"></div>
                <div class="mt-5 flex justify-end gap-2">
                  <button id="btnConfirmCancel" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
                  <button id="btnConfirmOk" class="px-4 py-2.5 rounded-2xl bg-red-600 text-white font-black text-sm">Confirm</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let ITEMS = [];
      let confirmAction = null;
      let ACTIVE = null;

      function setMsg(kind, text){
        q("msg").className = "text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function openModal(title, body){
        q("modalTitle").textContent = title || "Widget";
        q("modalBody").innerHTML = body || "";
        q("modalBackdrop").classList.remove("hidden");
      }

      function closeModal(){
        q("modalBackdrop").classList.add("hidden");
        q("modalBody").innerHTML = "";
      }

      function openConfirm(title, desc, metaHtml, onOk){
        q("confirmTitle").textContent = title || "Confirm";
        q("confirmDesc").textContent = desc || "";
        q("confirmMeta").innerHTML = metaHtml || "-";
        confirmAction = onOk;
        q("confirmBackdrop").classList.remove("hidden");
      }

      function closeConfirm(){
        q("confirmBackdrop").classList.add("hidden");
        q("confirmMeta").innerHTML = "";
        confirmAction = null;
      }

      function renderList(){
        if(!ITEMS.length){
          q("listBox").innerHTML = `<div class="text-sm text-slate-500">No widgets found.</div>`;
          return;
        }

        q("listBox").innerHTML = ITEMS.map(x => `
          <button class="w-full text-left rounded-2xl border border-slate-200 dark:border-darkBorder p-4 hover:bg-slate-50 dark:hover:bg-white/5 itemRow ${ACTIVE && ACTIVE.id === x.id ? 'ring-2 ring-primary/40' : ''}" data-id="${esc(x.id)}">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-base font-extrabold">${esc(x.title || "Untitled")}</div>
                <div class="text-xs text-slate-500 mt-1">section: ${esc(x.section || "-")} • sort: ${esc(x.sort_order)}</div>
                <div class="text-xs text-slate-500 mt-1">updated: ${esc(fmtTs(x.updated_at))}</div>
                <div class="flex gap-2 flex-wrap mt-3">
                  ${statusBadge(x.status)}
                </div>
              </div>
              <div class="flex gap-2 shrink-0">
                <button class="btnEdit px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-id="${esc(x.id)}">Edit</button>
                <button class="btnDelete px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-black" data-id="${esc(x.id)}">Delete</button>
              </div>
            </div>
          </button>
        `).join("");

        q("listBox").querySelectorAll(".itemRow").forEach(el => {
          el.onclick = (ev)=>{
            if(ev.target.closest(".btnEdit") || ev.target.closest(".btnDelete")) return;
            const id = el.getAttribute("data-id");
            ACTIVE = ITEMS.find(x => String(x.id) === String(id)) || null;
            renderPreview();
            renderList();
          };
        });

        q("listBox").querySelectorAll(".btnEdit").forEach(el => {
          el.onclick = (ev)=>{
            ev.stopPropagation();
            const id = el.getAttribute("data-id");
            const row = ITEMS.find(x => String(x.id) === String(id));
            if(!row) return;
            openEditor(row);
          };
        });

        q("listBox").querySelectorAll(".btnDelete").forEach(el => {
          el.onclick = (ev)=>{
            ev.stopPropagation();
            const id = el.getAttribute("data-id");
            const row = ITEMS.find(x => String(x.id) === String(id));
            if(!row) return;
            openConfirm(
              "Delete Widget",
              "This action will remove widget block from database.",
              `<div class="font-black text-red-600">${esc(row.title || row.id)}</div><div class="text-xs text-slate-500 mt-2">section: ${esc(row.section || "-")} • sort: ${esc(row.sort_order)}</div>`,
              async ()=>{
                setMsg("muted", "Deleting widget...");
                const r = await saveWidget({ action:"delete", id: row.id });
                if(r.status !== "ok"){
                  setMsg("error", "Delete failed: " + r.status);
                  return;
                }
                closeConfirm();
                setMsg("success", "Widget deleted.");
                if(ACTIVE && ACTIVE.id === row.id) ACTIVE = null;
                await render();
              }
            );
          };
        });
      }

      function renderPreview(){
        if(!ACTIVE){
          q("previewBox").innerHTML = `<div class="text-sm text-slate-500">Pilih widget dari list untuk preview.</div>`;
          return;
        }
        q("previewBox").innerHTML = ACTIVE?.payload_json?.html || `<div class="text-sm text-slate-500">No HTML payload.</div>`;
      }

      function editorHtml(row = {}){
        const payload = row.payload_json && typeof row.payload_json === "object" ? row.payload_json : {};
        return `
          <form id="widgetForm" class="grid grid-cols-1 xl:grid-cols-2 gap-4">
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

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">SECTION</label>
                  <select name="section" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    <option value="home" ${row.section === "home" || !row.section ? "selected" : ""}>home</option>
                    <option value="hero" ${row.section === "hero" ? "selected" : ""}>hero</option>
                    <option value="sidebar" ${row.section === "sidebar" ? "selected" : ""}>sidebar</option>
                    <option value="footer" ${row.section === "footer" ? "selected" : ""}>footer</option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">SORT ORDER</label>
                  <input name="sort_order" type="number" value="${esc(row.sort_order ?? 0)}" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                </div>

                <div>
                  <label class="block text-sm font-bold text-slate-500 mb-2">STATUS</label>
                  <select name="status" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
                    <option value="active" ${row.status === "active" || !row.status ? "selected" : ""}>active</option>
                    <option value="inactive" ${row.status === "inactive" ? "selected" : ""}>inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <div class="text-sm font-bold text-slate-500 mb-2">TEMPLATES</div>
                <div class="flex gap-2 flex-wrap">
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-template="hero">Hero</button>
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-template="card_grid">Card Grid</button>
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-template="notice">Notice</button>
                  <button type="button" class="tplBtn px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black" data-template="html_block">HTML Block</button>
                </div>
              </div>

              <div class="flex gap-2 flex-wrap">
                <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save</button>
                <button type="button" id="btnCancelWidget" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Cancel</button>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-bold text-slate-500 mb-2">HTML PAYLOAD</label>
                <textarea id="htmlPayload" rows="18" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-mono">${esc(payload.html || "")}</textarea>
              </div>

              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-3">
                <div class="text-xs font-black text-slate-500 mb-2">LIVE PREVIEW</div>
                <div id="htmlPreview" class="rounded-2xl bg-slate-50 dark:bg-black/20 p-4 min-h-[220px] overflow-auto"></div>
              </div>
            </div>
          </form>
        `;
      }

      function openEditor(row = {}){
        openModal(row.id ? "Edit Widget" : "Create Widget", editorHtml(row));

        const form = q("widgetForm");
        const htmlEl = q("htmlPayload");
        const preview = q("htmlPreview");

        function renderHtml(){
          preview.innerHTML = htmlEl.value || `<div class="text-sm text-slate-500">Empty preview.</div>`;
        }

        renderHtml();
        htmlEl.addEventListener("input", renderHtml);

        q("btnCancelWidget").onclick = closeModal;

        q("modalBody").querySelectorAll(".tplBtn").forEach(btn => {
          btn.onclick = ()=>{
            const key = btn.getAttribute("data-template");
            htmlEl.value = TEMPLATES[key] || "";
            renderHtml();
          };
        });

        form.onsubmit = async (ev)=>{
          ev.preventDefault();

          const payload = {
            action: form.mode.value,
            id: form.id.value.trim(),
            title: form.title.value.trim(),
            section: form.section.value,
            sort_order: Number(form.sort_order.value || 0),
            status: form.status.value,
            payload_json: {
              html: htmlEl.value
            }
          };

          if(!payload.title){
            setMsg("error", "Title required.");
            return;
          }

          setMsg("muted", "Saving widget...");
          const r = await saveWidget(payload);
          if(r.status !== "ok"){
            setMsg("error", "Save failed: " + r.status);
            return;
          }

          closeModal();
          setMsg("success", "Widget saved.");
          await render();
        };
      }

      async function render(){
        setMsg("muted", "Loading widgets...");
        const r = await loadWidgets(q("fSection").value, q("fStatus").value);

        if(r.status !== "ok"){
          q("listBox").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r, null, 2))}</pre>`;
          setMsg("error", "Load failed: " + r.status);
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        if(ACTIVE){
          ACTIVE = ITEMS.find(x => String(x.id) === String(ACTIVE.id)) || null;
        }
        renderList();
        renderPreview();
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("btnNew").onclick = ()=>openEditor({});
      q("fSection").onchange = render;
      q("fStatus").onchange = render;

      q("btnModalClose").onclick = closeModal;
      q("modalBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("modalBackdrop")) closeModal();
      });

      q("btnConfirmCancel").onclick = closeConfirm;
      q("btnConfirmOk").onclick = async ()=>{
        if(typeof confirmAction === "function") await confirmAction();
      };
      q("confirmBackdrop").addEventListener("click", (e)=>{
        if(e.target === q("confirmBackdrop")) closeConfirm();
      });

      await render();
    }
  };
}
