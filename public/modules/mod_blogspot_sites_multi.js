export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function apiList(){
    return await Orland.api("/api/blogspot/sites_multi");
  }

  async function apiSave(payload){
    return await Orland.api("/api/blogspot/sites_multi", {
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
    return `<span class="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-black">inactive</span>`;
  }

  function defaultBadge(v){
    return Number(v || 0) === 1
      ? `<span class="px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-black">default</span>`
      : ``;
  }

  return {
    title:"Blogspot Multi Site",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-2xl font-extrabold text-slate-900 dark:text-white">Blogspot Multi Site</div>
              <div class="text-sm text-slate-500">Config center untuk site Blogspot multi tenant.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-4 py-3 rounded-2xl border font-black text-sm">Reload</button>
              <button id="btnNew" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">New Site</button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
            <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="flex items-center justify-between gap-3 flex-wrap">
                <div class="text-xl font-extrabold">Sites List</div>
                <input id="qSearch" class="w-full xl:w-72 px-4 py-3 rounded-2xl border text-sm font-semibold" placeholder="Search site / blog / account / url">
              </div>
              <div id="listBox" class="mt-4 space-y-3"></div>
            </div>

            <div class="space-y-4">
              <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div id="editorTitle" class="text-xl font-extrabold">Create Site</div>
                    <div class="text-xs text-slate-500 mt-1">Manage multi site configuration.</div>
                  </div>
                  <button id="btnReset" class="px-3 py-2 rounded-xl border text-xs font-black">Reset</button>
                </div>

                <form id="siteForm" class="mt-4 grid grid-cols-1 gap-4">
                  <input type="hidden" name="mode" value="create">

                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">ID</label>
                    <input name="id" class="w-full px-4 py-3 rounded-2xl border bg-white dark:bg-dark text-sm font-semibold" placeholder="site_main">
                  </div>

                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">ACCOUNT ID</label>
                    <input name="account_id" class="w-full px-4 py-3 rounded-2xl border bg-white dark:bg-dark text-sm font-semibold" placeholder="acct_main">
                  </div>

                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">BLOG ID</label>
                    <input name="blog_id" class="w-full px-4 py-3 rounded-2xl border bg-white dark:bg-dark text-sm font-semibold" placeholder="1234567890123456789">
                  </div>

                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">BLOG NAME</label>
                    <input name="blog_name" class="w-full px-4 py-3 rounded-2xl border bg-white dark:bg-dark text-sm font-semibold" placeholder="Main Public Blog">
                  </div>

                  <div>
                    <label class="block text-sm font-bold text-slate-500 mb-2">BLOG URL</label>
                    <input name="blog_url" class="w-full px-4 py-3 rounded-2xl border bg-white dark:bg-dark text-sm font-semibold" placeholder="https://example.blogspot.com">
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-sm font-bold text-slate-500 mb-2">STATUS</label>
                      <select name="status" class="w-full px-4 py-3 rounded-2xl border bg-white dark:bg-dark text-sm font-semibold">
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </div>

                    <label class="flex items-center gap-3 mt-8">
                      <input name="set_as_default" type="checkbox">
                      <span class="text-sm font-semibold">Set as default site</span>
                    </label>
                  </div>

                  <div class="flex gap-2 flex-wrap">
                    <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save</button>
                    <button type="button" id="btnTestConnection" class="px-4 py-2.5 rounded-2xl border border-sky-200 text-sky-700 font-black text-sm">Test Connection</button>
                    <button type="button" id="btnDelete" class="hidden px-4 py-2.5 rounded-2xl border border-red-200 text-red-600 font-black text-sm">Delete</button>
                  </div>
                </form>
              </div>

              <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
                <div class="text-xl font-extrabold">Result</div>
                <pre id="rawBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 border rounded-2xl p-4">{}</pre>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let ITEMS = [];
      let ACTIVE = null;

      function setMsg(kind, text){
        q("msg").className = "text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function resetForm(row = null){
        const f = q("siteForm");
        ACTIVE = row || null;

        f.mode.value = row ? "update" : "create";
        f.id.value = row?.id || "";
        f.id.readOnly = !!row;
        f.account_id.value = row?.account_id || "";
        f.blog_id.value = row?.blog_id || "";
        f.blog_name.value = row?.blog_name || "";
        f.blog_url.value = row?.blog_url || "";
        f.status.value = row?.status || "active";
        f.set_as_default.checked = Number(row?.is_default || 0) === 1;

        q("editorTitle").textContent = row ? "Edit Site" : "Create Site";
        q("btnDelete").classList.toggle("hidden", !row);
      }

      function filteredItems(){
        const kw = String(q("qSearch").value || "").trim().toLowerCase();
        if(!kw) return ITEMS;
        return ITEMS.filter(x => {
          const hay = [
            x.id,
            x.account_id,
            x.blog_id,
            x.blog_name,
            x.blog_url,
            x.status
          ].join(" ").toLowerCase();
          return hay.includes(kw);
        });
      }

      function renderList(){
        const rows = filteredItems();

        if(!rows.length){
          q("listBox").innerHTML = `<div class="text-sm text-slate-500">No sites found.</div>`;
          return;
        }

        q("listBox").innerHTML = rows.map(x => `
          <button class="w-full text-left rounded-2xl border p-4 hover:bg-slate-50 dark:hover:bg-white/5 itemRow ${ACTIVE && ACTIVE.id === x.id ? "ring-2 ring-primary/40" : ""}" data-id="${esc(x.id)}">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex gap-2 flex-wrap">
                  ${statusBadge(x.status)}
                  ${defaultBadge(x.is_default)}
                </div>
                <div class="text-base font-extrabold mt-3">${esc(x.blog_name || x.id)}</div>
                <div class="text-xs text-slate-500 mt-1">site: ${esc(x.id)}</div>
                <div class="text-xs text-slate-500 mt-1">account: ${esc(x.account_id || "-")}</div>
                <div class="text-xs text-slate-500 mt-1">blog_id: ${esc(x.blog_id || "-")}</div>
                <div class="text-xs text-slate-500 mt-1 break-all">${esc(x.blog_url || "-")}</div>
                <div class="text-xs text-slate-500 mt-2">updated: ${esc(fmtTs(x.updated_at))}</div>
              </div>
              <div class="flex gap-2 shrink-0">
                <button class="btnDefault px-3 py-2 rounded-xl border border-sky-200 text-sky-700 text-xs font-black" data-id="${esc(x.id)}">Set Default</button>
                <button class="btnTest px-3 py-2 rounded-xl border border-violet-200 text-violet-700 text-xs font-black" data-id="${esc(x.id)}">Test</button>
              </div>
            </div>
          </button>
        `).join("");

        q("listBox").querySelectorAll(".itemRow").forEach(el => {
          el.onclick = (ev)=>{
            if(ev.target.closest(".btnDefault") || ev.target.closest(".btnTest")) return;
            const id = String(el.getAttribute("data-id") || "");
            const row = ITEMS.find(x => String(x.id) === id) || null;
            resetForm(row);
            renderList();
          };
        });

        q("listBox").querySelectorAll(".btnDefault").forEach(el => {
          el.onclick = async (ev)=>{
            ev.stopPropagation();
            const id = String(el.getAttribute("data-id") || "");
            setMsg("muted", "Setting default site...");
            const r = await apiSave({ action:"set_default", site_id:id });
            q("rawBox").textContent = JSON.stringify(r, null, 2);
            if(r.status !== "ok"){
              setMsg("error", "Set default failed: " + (r.data?.error || r.status));
              return;
            }
            setMsg("success", "Default site updated.");
            await render();
          };
        });

        q("listBox").querySelectorAll(".btnTest").forEach(el => {
          el.onclick = async (ev)=>{
            ev.stopPropagation();
            const id = String(el.getAttribute("data-id") || "");
            setMsg("muted", "Testing site connection...");
            const r = await apiSave({ action:"test_connection", site_id:id });
            q("rawBox").textContent = JSON.stringify(r, null, 2);
            if(r.status !== "ok" || r.data?.ok === false){
              setMsg("error", "Connection test failed.");
              return;
            }
            setMsg("success", "Connection OK.");
          };
        });
      }

      async function render(){
        setMsg("muted", "Loading sites...");
        const r = await apiList();
        q("rawBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + r.status);
          q("listBox").innerHTML = `<div class="text-sm text-red-500">Load sites failed.</div>`;
          return;
        }

        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];

        if(ACTIVE){
          ACTIVE = ITEMS.find(x => String(x.id) === String(ACTIVE.id)) || null;
        }

        renderList();

        if(!ACTIVE){
          resetForm(null);
        }else{
          resetForm(ACTIVE);
        }

        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("btnNew").onclick = ()=>{
        resetForm(null);
        renderList();
      };
      q("btnReset").onclick = ()=>{
        resetForm(ACTIVE || null);
      };
      q("qSearch").oninput = renderList;

      q("btnDelete").onclick = async ()=>{
        const f = q("siteForm");
        const id = String(f.id.value || "").trim();
        if(!id){
          setMsg("error", "Site id required.");
          return;
        }

        setMsg("muted", "Deleting site...");
        const r = await apiSave({ action:"delete", id });
        q("rawBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Delete failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Site deleted.");
        resetForm(null);
        await render();
      };

      q("btnTestConnection").onclick = async ()=>{
        const f = q("siteForm");
        const payload = {
          action: "test_connection",
          id: String(f.id.value || "").trim(),
          account_id: String(f.account_id.value || "").trim(),
          blog_id: String(f.blog_id.value || "").trim(),
          blog_name: String(f.blog_name.value || "").trim(),
          blog_url: String(f.blog_url.value || "").trim(),
          status: String(f.status.value || "active").trim()
        };

        setMsg("muted", "Testing site connection...");
        const r = await apiSave(payload);
        q("rawBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok" || r.data?.ok === false){
          setMsg("error", "Connection test failed.");
          return;
        }

        setMsg("success", "Connection OK.");
      };

      q("siteForm").onsubmit = async (ev)=>{
        ev.preventDefault();
        const f = q("siteForm");

        const payload = {
          action: f.mode.value,
          id: String(f.id.value || "").trim(),
          account_id: String(f.account_id.value || "").trim(),
          blog_id: String(f.blog_id.value || "").trim(),
          blog_name: String(f.blog_name.value || "").trim(),
          blog_url: String(f.blog_url.value || "").trim(),
          status: String(f.status.value || "active").trim(),
          set_as_default: !!f.set_as_default.checked
        };

        if(!payload.id || !payload.account_id || !payload.blog_id || !payload.blog_name){
          setMsg("error", "ID, ACCOUNT ID, BLOG ID, BLOG NAME wajib diisi.");
          return;
        }

        setMsg("muted", "Saving site...");
        const r = await apiSave(payload);
        q("rawBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Save failed: " + (r.data?.error || r.status));
          return;
        }

        setMsg("success", "Site saved.");
        await render();
      };

      await render();
    }
  };
}
