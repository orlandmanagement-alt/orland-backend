export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadSites(){
    return await Orland.api("/api/blogspot/sites_multi");
  }

  async function saveSite(payload){
    return await Orland.api("/api/blogspot/sites_multi", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"Blogspot Multi Site",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">Blogspot Multi Site</div>
                <div class="text-sm text-slate-500 mt-1">Manage multi-blog tenant isolation.</div>
              </div>
              <button id="btnReload" class="px-4 py-3 rounded-2xl border font-black text-sm">Reload</button>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4">
            <form id="siteForm" class="rounded-3xl border border-slate-200 p-5 space-y-4">
              <div class="text-xl font-extrabold">Site Form</div>
              <input id="xAction" type="hidden" value="create">
              <div><input id="xId" class="w-full px-4 py-3 rounded-2xl border" placeholder="site id"></div>
              <div><input id="xBlogId" class="w-full px-4 py-3 rounded-2xl border" placeholder="blog_id"></div>
              <div><input id="xBlogName" class="w-full px-4 py-3 rounded-2xl border" placeholder="blog_name"></div>
              <div><input id="xBlogUrl" class="w-full px-4 py-3 rounded-2xl border" placeholder="blog_url"></div>
              <div>
                <select id="xStatus" class="w-full px-4 py-3 rounded-2xl border">
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </div>
              <label class="flex items-center gap-3"><input id="xIsDefault" type="checkbox"><span class="font-semibold text-sm">Default Site</span></label>
              <div class="flex gap-2 flex-wrap">
                <button class="px-4 py-3 rounded-2xl bg-black text-white font-black text-sm">Save</button>
                <button type="button" id="btnReset" class="px-4 py-3 rounded-2xl border font-black text-sm">Reset</button>
              </div>
            </form>

            <div class="rounded-3xl border border-slate-200 p-5">
              <div class="text-xl font-extrabold">Sites</div>
              <div id="listBox" class="mt-4 space-y-3"></div>
            </div>
          </div>
        </div>
      `;

      const q = id => host.querySelector("#" + id);
      let ITEMS = [];

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      function resetForm(){
        q("xAction").value = "create";
        q("xId").value = "";
        q("xBlogId").value = "";
        q("xBlogName").value = "";
        q("xBlogUrl").value = "";
        q("xStatus").value = "active";
        q("xIsDefault").checked = false;
      }

      function fillForm(row){
        q("xAction").value = "update";
        q("xId").value = row.id || "";
        q("xBlogId").value = row.blog_id || "";
        q("xBlogName").value = row.blog_name || "";
        q("xBlogUrl").value = row.blog_url || "";
        q("xStatus").value = row.status || "active";
        q("xIsDefault").checked = Number(row.is_default || 0) === 1;
      }

      function renderList(){
        q("listBox").innerHTML = !ITEMS.length
          ? `<div class="text-sm text-slate-500">No sites.</div>`
          : ITEMS.map(x => `
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="text-sm font-extrabold">${esc(x.blog_name || "-")}</div>
              <div class="text-xs text-slate-500 mt-1">${esc(x.id || "-")} • blog_id=${esc(x.blog_id || "-")}</div>
              <div class="text-xs text-slate-500 mt-1">${esc(x.blog_url || "-")}</div>
              <div class="mt-3 flex gap-2 flex-wrap">
                <button class="btnEdit px-3 py-2 rounded-xl border text-xs font-black" data-id="${esc(x.id)}">Edit</button>
                <button class="btnActive px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-black" data-id="${esc(x.id)}">Set Active</button>
                <button class="btnDelete px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-black" data-id="${esc(x.id)}">Delete</button>
              </div>
            </div>
          `).join("");

        q("listBox").querySelectorAll(".btnEdit").forEach(btn => {
          btn.onclick = ()=> {
            const row = ITEMS.find(x => String(x.id) === String(btn.getAttribute("data-id")));
            if(row) fillForm(row);
          };
        });

        q("listBox").querySelectorAll(".btnActive").forEach(btn => {
          btn.onclick = async ()=> {
            const id = String(btn.getAttribute("data-id") || "");
            const r = await saveSite({ action:"set_active", id });
            if(r.status !== "ok"){ setMsg("error", "Set active failed"); return; }
            setMsg("success", "Active site updated.");
          };
        });

        q("listBox").querySelectorAll(".btnDelete").forEach(btn => {
          btn.onclick = async ()=> {
            const id = String(btn.getAttribute("data-id") || "");
            const r = await saveSite({ action:"delete", id });
            if(r.status !== "ok"){ setMsg("error", "Delete failed"); return; }
            setMsg("success", "Site deleted.");
            await render();
          };
        });
      }

      async function render(){
        setMsg("muted", "Loading...");
        const r = await loadSites();
        if(r.status !== "ok"){ setMsg("error", "Load failed"); return; }
        ITEMS = Array.isArray(r.data?.items) ? r.data.items : [];
        renderList();
        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("btnReset").onclick = resetForm;
      q("siteForm").onsubmit = async (e)=>{
        e.preventDefault();
        const payload = {
          action: q("xAction").value,
          id: q("xId").value.trim(),
          blog_id: q("xBlogId").value.trim(),
          blog_name: q("xBlogName").value.trim(),
          blog_url: q("xBlogUrl").value.trim(),
          status: q("xStatus").value,
          is_default: q("xIsDefault").checked
        };
        const r = await saveSite(payload);
        if(r.status !== "ok"){ setMsg("error", "Save failed"); return; }
        setMsg("success", "Saved.");
        resetForm();
        await render();
      };

      resetForm();
      await render();
    }
  };
}
