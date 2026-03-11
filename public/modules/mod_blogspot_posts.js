export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  async function loadLocal(){ return await Orland.api("/api/blogspot/posts"); }
  async function loadRemote(){ return await Orland.api("/api/blogspot/posts?source=remote&maxResults=10"); }
  async function save(payload){
    return await Orland.api("/api/blogspot/posts", { method:"POST", body: JSON.stringify(payload) });
  }

  return {
    title:"Blogspot Posts",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-4 max-w-6xl">
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div class="text-xl font-extrabold text-slate-900 dark:text-white">Blogspot Posts</div>
              <div class="text-sm text-slate-500">Local CMS posts + remote Blogger preview.</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              <button id="btnReload" class="px-3 py-2 rounded-xl text-xs font-black border border-slate-200 dark:border-darkBorder">Reload Local</button>
              <button id="btnRemote" class="px-3 py-2 rounded-xl text-xs font-black border border-amber-200 text-amber-700">Load Remote Preview</button>
              <button id="btnNew" class="px-3 py-2 rounded-xl text-xs font-black bg-primary text-white">New Post</button>
            </div>
          </div>

          <div id="msg" class="text-sm text-slate-500"></div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-sm font-extrabold">Editor</div>
              <div class="space-y-3 mt-4">
                <input id="id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 text-sm" placeholder="id (auto create if empty)">
                <input id="title" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm" placeholder="Title">
                <input id="slug" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm" placeholder="Slug">
                <input id="labels" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm" placeholder="labels comma separated">
                <select id="status" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm">
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </select>
                <textarea id="content_html" rows="12" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-black/20 text-sm font-mono" placeholder="<div>HTML content</div>"></textarea>
                <div class="flex gap-2 flex-wrap">
                  <button id="btnSave" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Save Local</button>
                  <button id="btnDelete" class="px-4 py-2.5 rounded-2xl border border-red-200 text-red-600 font-black text-sm">Delete</button>
                  <button id="btnClear" class="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Clear</button>
                </div>
              </div>
            </div>

            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
              <div class="text-sm font-extrabold">Remote Preview</div>
              <pre id="remoteBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 dark:bg-black/20 rounded-2xl p-4 border border-slate-200 dark:border-darkBorder">[]</pre>
            </div>
          </div>

          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="text-sm font-extrabold">Local Posts</div>
            <div id="box" class="space-y-3 mt-4"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#"+id);

      function fill(x = {}){
        q("id").value = x.id || "";
        q("title").value = x.title || "";
        q("slug").value = x.slug || "";
        q("labels").value = Array.isArray(x.labels_json) ? x.labels_json.join(",") : "";
        q("status").value = x.status || "draft";
        q("content_html").value = x.content_html || "";
      }

      function read(){
        return {
          action: q("id").value.trim() ? "update" : "create",
          id: q("id").value.trim(),
          title: q("title").value.trim(),
          slug: q("slug").value.trim(),
          status: q("status").value,
          labels_json: q("labels").value.split(",").map(s => s.trim()).filter(Boolean),
          content_html: q("content_html").value
        };
      }

      async function render(){
        q("box").innerHTML = "Loading...";
        const r = await loadLocal();
        if(r.status !== "ok"){
          q("box").innerHTML = `<pre class="text-[11px] whitespace-pre-wrap text-red-500">${esc(JSON.stringify(r,null,2))}</pre>`;
          return;
        }

        const items = r.data?.items || [];
        if(!items.length){
          q("box").innerHTML = `<div class="text-xs text-slate-500">No local posts.</div>`;
          return;
        }

        q("box").innerHTML = items.map(x => `
          <button class="w-full text-left bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder rounded-2xl p-4 hover:bg-slate-50 dark:hover:bg-white/5 itemRow" data-id="${esc(x.id)}">
            <div class="text-sm font-extrabold">${esc(x.title || "Untitled")}</div>
            <div class="text-[11px] text-slate-500 mt-1">${esc(x.slug || "")} • ${esc(x.status || "draft")}</div>
          </button>
        `).join("");

        q("box").querySelectorAll(".itemRow").forEach(btn => {
          btn.onclick = ()=>{
            const id = btn.getAttribute("data-id");
            const row = items.find(x => String(x.id) === String(id));
            if(row) fill(row);
          };
        });
      }

      q("btnReload").onclick = render;
      q("btnNew").onclick = ()=>fill({});
      q("btnClear").onclick = ()=>fill({});

      q("btnSave").onclick = async ()=>{
        q("msg").className = "text-sm text-slate-500";
        q("msg").textContent = "Saving...";
        const payload = read();
        if(!payload.title){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Title required.";
          return;
        }
        const r = await save(payload);
        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Save failed: " + r.status;
          return;
        }
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Saved local post.";
        if(r.data?.id) q("id").value = r.data.id;
        await render();
      };

      q("btnDelete").onclick = async ()=>{
        const id = q("id").value.trim();
        if(!id){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Select post first.";
          return;
        }
        const r = await save({ action:"delete", id });
        if(r.status !== "ok"){
          q("msg").className = "text-sm text-red-500";
          q("msg").textContent = "Delete failed: " + r.status;
          return;
        }
        fill({});
        q("msg").className = "text-sm text-emerald-600";
        q("msg").textContent = "Deleted.";
        await render();
      };

      q("btnRemote").onclick = async ()=>{
        q("remoteBox").textContent = "Loading...";
        const r = await loadRemote();
        q("remoteBox").textContent = JSON.stringify(r, null, 2);
      };

      await render();
    }
  };
}
