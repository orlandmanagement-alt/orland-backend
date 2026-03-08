export default function CmsPosts(Orland){
  return {
    title: "Blogspot • Manage Posts",
    async mount(host){
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div class="text-sm font-bold">Posts</div>
              <div class="text-xs text-slate-500">Draft/simpan di D1. Publish ke Blogspot bisa ditambah di tahap berikutnya.</div>
            </div>
            <div class="flex gap-2">
              <input id="q" class="px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder" placeholder="search title/slug">
              <button id="btnNew" class="px-3 py-2 rounded-lg text-xs font-bold bg-primary text-white">New</button>
              <button id="btnReload" class="px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900">Reload</button>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
            <div class="lg:col-span-1">
              <div id="list" class="space-y-2"></div>
            </div>
            <div class="lg:col-span-2">
              <div class="border border-slate-200 dark:border-darkBorder rounded-xl p-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input id="id" hidden>
                  <div>
                    <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Title</label>
                    <input id="title" class="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder">
                  </div>
                  <div>
                    <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400">Slug</label>
                    <input id="slug" class="w-full mt-2 px-3 py-2 rounded-lg text-xs bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder">
                  </div>
                  <div class="md:col-span-2">
                    <label class="text-[11px] font-bold uppercase tracking-widest text-slate-400">HTML</label>
                    <textarea id="html" rows="10" class="w-full mt-2 px-3 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder"></textarea>
                  </div>
                </div>
                <div class="flex gap-2 mt-3">
                  <button id="btnSave" class="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-white">Save</button>
                  <button id="btnDel" class="px-4 py-2 rounded-lg text-xs font-bold bg-danger text-white">Delete</button>
                </div>
                <details class="mt-3">
                  <summary class="text-xs text-slate-500">Debug</summary>
                  <pre id="out" class="text-[11px] whitespace-pre-wrap text-slate-500 mt-2"></pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      `;

      const out = host.querySelector("#out");
      const list = host.querySelector("#list");

      const load = async ()=>{
        const q = (host.querySelector("#q").value||"").trim();
        const r = await Orland.api(`/api/cms/items?kind=post&limit=80&q=${encodeURIComponent(q)}`);
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
          b.onclick = async ()=>{
            const id = b.getAttribute("data-id");
            const it = items.find(z=>z.id===id);
            host.querySelector("#id").value = it.id;
            host.querySelector("#title").value = it.title || "";
            host.querySelector("#slug").value = it.slug || "";
            const full = await Orland.api("/api/cms/items?kind=post&limit=1&q="+encodeURIComponent(it.title||""));
            out.textContent = JSON.stringify(full,null,2);
            // content_html tidak ada di list query (hemat), jadi fetch detail pakai query kedua: ambil by id via save endpoint (simple approach)
          };
        });
      };

      host.querySelector("#btnReload").onclick = load;
      host.querySelector("#q").onkeydown = (e)=>{ if(e.key==="Enter") load(); };

      host.querySelector("#btnNew").onclick = ()=>{
        host.querySelector("#id").value = "";
        host.querySelector("#title").value = "";
        host.querySelector("#slug").value = "";
        host.querySelector("#html").value = "<h2>New Post</h2><p>...</p>";
      };

      host.querySelector("#btnSave").onclick = async ()=>{
        const payload = {
          id: (host.querySelector("#id").value||"").trim() || null,
          kind: "post",
          title: (host.querySelector("#title").value||"").trim(),
          slug: (host.querySelector("#slug").value||"").trim() || null,
          content_html: host.querySelector("#html").value || "",
          status: "draft"
        };
        const rr = await Orland.api("/api/cms/items",{ method:"POST", body: JSON.stringify(payload) });
        out.textContent = JSON.stringify(rr,null,2);
        Orland.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok") await load();
      };

      host.querySelector("#btnDel").onclick = async ()=>{
        const id = (host.querySelector("#id").value||"").trim();
        if(!id) return Orland.toast("Select item first","error");
        if(!confirm("Delete item?")) return;
        const rr = await Orland.api("/api/cms/items?id="+encodeURIComponent(id), { method:"DELETE" });
        out.textContent = JSON.stringify(rr,null,2);
        Orland.toast(rr.status, rr.status==="ok"?"success":"error");
        if(rr.status==="ok"){ host.querySelector("#id").value=""; await load(); }
      };

      await load();
    }
  };
}
