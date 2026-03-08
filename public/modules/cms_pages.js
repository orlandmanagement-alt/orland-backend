export default function CmsPages(Orland){
  return {
    title: "Blogspot • Static Pages",
    async mount(host){
      // reuse same UI as posts, but kind=page
      const Mod = (await import("/modules/cms_posts.js")).default;
      const base = Mod(Orland);
      const origMount = base.mount;
      base.title = "Blogspot • Static Pages";

      base.mount = async (h)=>{
        await origMount(h);
        // patch labels + API kind
        h.querySelector("div.text-sm.font-bold").textContent = "Pages";
        h.querySelector("div.text-xs.text-slate-500").textContent = "Draft page disimpan di D1 (cms_items.kind=page).";

        const q = h.querySelector("#q");
        const btnReload = h.querySelector("#btnReload");
        const btnSave = h.querySelector("#btnSave");
        const btnNew = h.querySelector("#btnNew");
        const btnDel = h.querySelector("#btnDel");
        const out = h.querySelector("#out");
        const list = h.querySelector("#list");

        async function load(){
          const qq = (q.value||"").trim();
          const r = await Orland.api(`/api/cms/items?kind=page&limit=80&q=${encodeURIComponent(qq)}`);
          out.textContent = JSON.stringify(r,null,2);
          if(r.status!=="ok"){ list.innerHTML = `<div class="text-xs text-slate-500">Failed: ${r.status}</div>`; return; }
          const items = r.data.items || [];
          list.innerHTML = items.map(x=>`
            <button class="w-full text-left px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5"
              data-id="${x.id}">
              <div class="text-xs font-bold">${Orland.esc(x.title)}</div>
              <div class="text-[11px] text-slate-500">${Orland.esc(x.slug||"")}</div>
            </button>
          `).join("");
          list.querySelectorAll("button[data-id]").forEach(b=>{
            b.onclick = ()=>{
              const id = b.getAttribute("data-id");
              const it = items.find(z=>z.id===id);
              h.querySelector("#id").value = it.id;
              h.querySelector("#title").value = it.title || "";
              h.querySelector("#slug").value = it.slug || "";
            };
          });
        }

        btnReload.onclick = load;
        q.onkeydown = (e)=>{ if(e.key==="Enter") load(); };

        btnNew.onclick = ()=>{
          h.querySelector("#id").value = "";
          h.querySelector("#title").value = "";
          h.querySelector("#slug").value = "";
          h.querySelector("#html").value = "<h2>New Page</h2><p>...</p>";
        };

        btnSave.onclick = async ()=>{
          const payload = {
            id: (h.querySelector("#id").value||"").trim() || null,
            kind: "page",
            title: (h.querySelector("#title").value||"").trim(),
            slug: (h.querySelector("#slug").value||"").trim() || null,
            content_html: h.querySelector("#html").value || "",
            status: "draft"
          };
          const rr = await Orland.api("/api/cms/items",{ method:"POST", body: JSON.stringify(payload) });
          out.textContent = JSON.stringify(rr,null,2);
          Orland.toast(rr.status, rr.status==="ok"?"success":"error");
          if(rr.status==="ok") await load();
        };

        btnDel.onclick = async ()=>{
          const id = (h.querySelector("#id").value||"").trim();
          if(!id) return Orland.toast("Select item first","error");
          if(!confirm("Delete page?")) return;
          const rr = await Orland.api("/api/cms/items?id="+encodeURIComponent(id), { method:"DELETE" });
          out.textContent = JSON.stringify(rr,null,2);
          Orland.toast(rr.status, rr.status==="ok"?"success":"error");
          if(rr.status==="ok"){ h.querySelector("#id").value=""; await load(); }
        };

        await load();
      };

      return base;
    }
  };
}
