export default function(Orland){
  const esc = (s)=>String(s??"").replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
  async function list(){ return await Orland.api("/api/menus"); }
  async function save(payload){ return await Orland.api("/api/menus",{ method:"POST", body: JSON.stringify(payload) }); }
  async function del(id){ return await Orland.api("/api/menus?id="+encodeURIComponent(id),{ method:"DELETE" }); }

  function pill(txt){
    return `<span class="inline-flex items-center rounded-full border border-slate-200 dark:border-darkBorder px-2 py-0.5 text-[10px] text-slate-500">${esc(txt)}</span>`;
  }

  return {
    title: "Menu Builder",
    async mount(host){
      host.innerHTML = `
        <style>
          /* mobile compact */
          .mb-row{display:flex; gap:10px; align-items:center; padding:12px 0; border-top:1px solid rgba(148,163,184,.25)}
          .mb-left{min-width:0; flex:1}
          .mb-title{font-weight:900; font-size:14px; line-height:1.2}
          .mb-meta{font-size:11px; opacity:.7; display:flex; gap:6px; flex-wrap:wrap; margin-top:4px}
          .mb-actions{display:flex; gap:8px; align-items:center}
          .mb-iconbtn{width:34px; height:34px; display:flex; align-items:center; justify-content:center; border-radius:12px; border:1px solid rgba(148,163,184,.25)}
          .mb-iconbtn:hover{opacity:.9}
          .mb-edit{padding:8px 10px; border-radius:12px; background:rgba(15,23,42,.08)}
          .dark .mb-edit{background:rgba(255,255,255,.06)}
          .mb-num{width:52px; text-align:center; border-radius:12px; border:1px solid rgba(148,163,184,.25); padding:6px 8px; font-size:12px; font-weight:800}
        </style>

        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-lg font-black">Menus</div>
              <div class="text-xs text-slate-500">CRUD menu sidebar + sort_order.</div>
            </div>
            <button id="btnReload" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-bold">Reload</button>
          </div>

          <div class="mt-3 flex gap-2">
            <input id="q" class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs bg-white dark:bg-dark" placeholder="filter label/path...">
          </div>

          <div class="mt-4" id="box">Loading…</div>
        </div>
      `;

      const box = host.querySelector("#box");
      const q = host.querySelector("#q");
      host.querySelector("#btnReload").onclick = ()=>render();

      q.addEventListener("input", ()=>render(true));

      let rows = [];
      async function render(clientOnly){
        if(!clientOnly){
          box.innerHTML = "Loading…";
          const r = await list();
          if(r.status!=="ok"){
            box.innerHTML = `<div class="text-sm text-red-500">Failed: ${esc(r.status)}</div><pre class="text-[11px] mt-2 whitespace-pre-wrap">${esc(JSON.stringify(r.data||{},null,2))}</pre>`;
            return;
          }
          rows = r.data?.menus || [];
        }

        const term = (q.value||"").toLowerCase().trim();
        const items = !term ? rows : rows.filter(x =>
          String(x.label||"").toLowerCase().includes(term) ||
          String(x.path||"").toLowerCase().includes(term) ||
          String(x.code||"").toLowerCase().includes(term)
        );

        if(!items.length){
          box.innerHTML = `<div class="text-xs text-slate-500">No data.</div>`;
          return;
        }

        box.innerHTML = items.map(m=>{
          return `
            <div class="mb-row">
              <div class="mb-left">
                <div class="flex items-center gap-2 min-w-0">
                  <i class="${esc(m.icon||"fa-solid fa-circle-dot")}"></i>
                  <div class="mb-title truncate">${esc(m.label||m.code||m.id)}</div>
                </div>
                <div class="mb-meta">
                  ${pill(m.code||"")}
                  ${pill(m.id||"")}
                  ${m.parent_id ? pill("parent: "+m.parent_id) : pill("root")}
                  ${pill(m.path||"/")}
                </div>
              </div>

              <div class="mb-actions">
                <input class="mb-num" value="${esc(m.sort_order||50)}" data-sort="${esc(m.id)}" />
                <button class="mb-iconbtn" data-up="${esc(m.id)}" title="Up"><i class="fa-solid fa-arrow-up"></i></button>
                <button class="mb-iconbtn" data-down="${esc(m.id)}" title="Down"><i class="fa-solid fa-arrow-down"></i></button>
                <button class="mb-edit text-xs font-black" data-edit="${esc(m.id)}">Edit</button>
              </div>
            </div>
          `;
        }).join("");

        // wire actions
        box.querySelectorAll("[data-up]").forEach(btn=>{
          btn.onclick = ()=>move(btn.getAttribute("data-up"), -1);
        });
        box.querySelectorAll("[data-down]").forEach(btn=>{
          btn.onclick = ()=>move(btn.getAttribute("data-down"), +1);
        });
        box.querySelectorAll("[data-edit]").forEach(btn=>{
          btn.onclick = ()=>edit(btn.getAttribute("data-edit"));
        });
        box.querySelectorAll("[data-sort]").forEach(inp=>{
          inp.onchange = ()=>setSort(inp.getAttribute("data-sort"), inp.value);
        });
      }

      function findIdx(id){ return rows.findIndex(x=>String(x.id)===String(id)); }

      async function setSort(id, val){
        const m = rows.find(x=>String(x.id)===String(id));
        if(!m) return;
        const sort_order = Number(val||m.sort_order||50);
        const payload = { id:m.id, code:m.code, label:m.label, path:m.path, parent_id:m.parent_id||null, sort_order, icon:m.icon||null };
        const r = await save(payload);
        if(r.status!=="ok") alert("Failed: "+r.status);
        await render(false);
      }

      async function move(id, dir){
        const idx = findIdx(id);
        if(idx<0) return;
        // only reorder inside same parent group
        const parent = rows[idx].parent_id || null;
        const group = rows.filter(x => (x.parent_id||null) === parent).sort((a,b)=>(a.sort_order||50)-(b.sort_order||50));
        const gidx = group.findIndex(x=>String(x.id)===String(id));
        const swap = group[gidx+dir];
        if(!swap) return;

        const a = group[gidx];
        const b = swap;
        const sa = a.sort_order||50;
        const sb = b.sort_order||50;

        await save({ id:a.id, code:a.code, label:a.label, path:a.path, parent_id:a.parent_id||null, sort_order:sb, icon:a.icon||null });
        await save({ id:b.id, code:b.code, label:b.label, path:b.path, parent_id:b.parent_id||null, sort_order:sa, icon:b.icon||null });

        await render(false);
      }

      async function edit(id){
        const m = rows.find(x=>String(x.id)===String(id));
        if(!m) return;

        const label = prompt("Label:", m.label||"");
        if(label===null) return;
        const path = prompt("Path:", m.path||"/");
        if(path===null) return;
        const icon = prompt("Icon (FontAwesome class):", m.icon||"fa-solid fa-circle-dot");
        if(icon===null) return;

        const payload = { id:m.id, code:m.code, label, path, parent_id:m.parent_id||null, sort_order:Number(m.sort_order||50), icon };
        const r = await save(payload);
        if(r.status!=="ok") alert("Failed: "+r.status);
        await render(false);
      }

      await render(false);
    }
  };
}
