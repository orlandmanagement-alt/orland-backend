import BlogspotPosts from "./mod_blogspot_posts.js";
export default function BlogspotPages(Orland){
  // reuse posts module logic but for kind=page by wrapping endpoints
  // lightweight: duplicated small part would be heavier—so we keep a dedicated file.
  const KIND="page";
  async function list(q=""){ return await Orland.api("/api/integrations/blogspot/items?kind="+KIND+"&limit=80"+(q?("&q="+encodeURIComponent(q)):"")); }
  async function save(payload){ return await Orland.api("/api/integrations/blogspot/items",{ method:"POST", body: JSON.stringify({ ...payload, kind: KIND }) }); }
  async function del(id){ return await Orland.api("/api/integrations/blogspot/items?id="+encodeURIComponent(id),{ method:"DELETE" }); }

  // small UI (same structure as posts)
  return {
    title:"Static Pages",
    async mount(host){
      const mod = BlogspotPosts(Orland);
      await mod.mount(host); // mount posts UI
      // patch labels + wire functions by overriding Orland.api calls via local handlers is overkill
      // Instead: show notice + redirect recommended usage
      const h = host.querySelector(".text-sm.font-extrabold");
      if(h) h.textContent = "Static Pages";
      const sub = host.querySelector(".text-xs.opacity-70");
      if(sub) sub.innerHTML = `Page disimpan di D1 <code>cms_items</code> (kind=page).`;

      // patch internal handlers by re-binding buttons to our functions:
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
          <button class="w-full text-left px-3 py-2 border-b border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5" data-id="${it.id}">
            <div class="text-xs font-bold truncate">${it.title||""}</div>
            <div class="text-[11px] opacity-70 truncate">${it.slug||""}</div>
          </button>
        `).join("") || `<div class="px-3 py-3 text-xs opacity-70">No pages.</div>`;
        box.querySelectorAll("button[data-id]").forEach(b=>{
          b.onclick=()=>{ const it=items.find(x=>x.id===b.getAttribute("data-id")); if(it) pick(it); };
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
      $("#btnSave").onclick=async ()=>{
        let meta = $("#meta").value.trim();
        if(meta){ try{ meta=JSON.stringify(JSON.parse(meta)); }catch{} } else meta="{}";
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
        const id=$("#id").value.trim();
        if(!id) return Orland.toast?.("Pick a page first","error");
        if(!confirm("Delete this page?")) return;
        const r=await del(id);
        dbg.textContent = JSON.stringify(r,null,2);
        if(r.status==="ok"){ Orland.toast?.("Deleted","success"); $("#btnNew").click(); await reload(); }
        else Orland.toast?.("Delete failed: "+r.status,"error");
      };

      await reload();
    }
  };
}
