function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

export default function BlogspotPosts(Orland){
  const KIND="post";
  async function list(q=""){ return await Orland.api("/api/integrations/blogspot/items?kind="+KIND+"&limit=80"+(q?("&q="+encodeURIComponent(q)):"")); }
  async function save(payload){ return await Orland.api("/api/integrations/blogspot/items",{ method:"POST", body: JSON.stringify({ ...payload, kind: KIND }) }); }
  async function del(id){ return await Orland.api("/api/integrations/blogspot/items?id="+encodeURIComponent(id),{ method:"DELETE" }); }

  return {
    title:"Manage Posts",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div class="text-sm font-extrabold">Manage Posts</div>
              <div class="text-xs opacity-70">Post disimpan di D1 <code>cms_items</code> (kind=post).</div>
            </div>
            <div class="flex gap-2">
              <input id="q" class="px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="search title/slug">
              <button id="btnNew" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">+ New</button>
              <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Reload</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <div class="lg:col-span-1">
              <div class="text-xs font-bold mb-2">Posts</div>
              <div id="list" class="rounded-xl border border-slate-200 dark:border-darkBorder overflow-hidden"></div>
            </div>

            <div class="lg:col-span-2">
              <div class="text-xs font-bold mb-2">Editor</div>
              <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-3">
                <input id="id" class="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="id (auto)">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
                  <input id="title" class="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Title">
                  <input id="slug" class="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="Slug (optional)">
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2">
                  <select id="status" class="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder">
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                  <input id="meta" class="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder='meta_json (optional)'>
                </div>
                <textarea id="html" class="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-white dark:bg-dark border border-slate-200 dark:border-darkBorder" style="min-height:240px" placeholder="<h1>...</h1>"></textarea>

                <div class="flex gap-2 mt-3">
                  <button id="btnSave" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white hover:opacity-90">Save</button>
                  <button id="btnDelete" class="px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">Delete</button>
                </div>

                <details class="mt-3">
                  <summary class="text-xs opacity-70 cursor-pointer">Debug</summary>
                  <pre id="dbg" class="text-[11px] opacity-70 mt-2 whitespace-pre-wrap"></pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      `;

      const $=(id)=>host.querySelector(id);
      const dbg=$("#dbg");
      let items=[];

      function pick(it){
        $("#id").value = it.id||"";
        $("#title").value = it.title||"";
        $("#slug").value = it.slug||"";
        $("#status").value = it.status||"draft";
        $("#meta").value = it.meta_json && it.meta_json!=="{}" ? it.meta_json : "";
        $("#html").value = it.content_html||"";
      }

      function render(){
        const box=$("#list");
        box.innerHTML = items.map(it=>`
          <button class="w-full text-left px-3 py-2 border-b border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-id="${esc(it.id)}">
            <div class="text-xs font-bold truncate">${esc(it.title)}</div>
            <div class="text-[11px] opacity-70 truncate">${esc(it.slug||"")}</div>
          </button>
        `).join("") || `<div class="px-3 py-3 text-xs opacity-70">No posts.</div>`;

        box.querySelectorAll("button[data-id]").forEach(b=>{
          b.onclick=()=>{
            const it = items.find(x=>x.id===b.getAttribute("data-id"));
            if(it) pick(it);
          };
        });
      }

      async function reload(){
        const r = await list($("#q").value.trim());
        dbg.textContent = JSON.stringify(r,null,2);
        if(r.status!=="ok") return Orland.toast?.("Load failed: "+r.status,"error");
        items = r.data.items||[];
        render();
        if(items[0] && !$("#id").value) pick(items[0]);
      }

      $("#btnReload").onclick=reload;
      $("#q").onkeydown=(e)=>{ if(e.key==="Enter") reload(); };

      $("#btnNew").onclick=()=>{
        $("#id").value="";
        $("#title").value="";
        $("#slug").value="";
        $("#status").value="draft";
        $("#meta").value="";
        $("#html").value="";
      };

      $("#btnSave").onclick=async ()=>{
        let meta = $("#meta").value.trim();
        if(meta){
          try{ meta = JSON.stringify(JSON.parse(meta)); }catch{}
        } else meta="{}";
        const payload = {
          id: $("#id").value.trim() || undefined,
          title: $("#title").value.trim(),
          slug: $("#slug").value.trim() || undefined,
          status: $("#status").value,
          meta_json: meta,
          content_html: $("#html").value
        };
        const r = await save(payload);
        dbg.textContent = JSON.stringify(r,null,2);
        if(r.status==="ok"){ Orland.toast?.("Saved","success"); await reload(); }
        else Orland.toast?.("Save failed: "+r.status,"error");
      };

      $("#btnDelete").onclick=async ()=>{
        const id = $("#id").value.trim();
        if(!id) return Orland.toast?.("Pick a post first","error");
        if(!confirm("Delete this post?")) return;
        const r = await del(id);
        dbg.textContent = JSON.stringify(r,null,2);
        if(r.status==="ok"){ Orland.toast?.("Deleted","success"); $("#btnNew").click(); await reload(); }
        else Orland.toast?.("Delete failed: "+r.status,"error");
      };

      await reload();
    }
  };
}
