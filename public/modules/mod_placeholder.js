export default function(){
  return {
    title: "Coming Soon",
    async mount(host){
      const Orland = window.Orland;

      const cur = (Orland?.state?.path) || (location.pathname || "/");
      const routes = Orland?.registry?.routes || {};

      // helper render safe
      const esc = (s)=> String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
      const btn = (id, text, cls="") => `<button id="${id}" class="px-3 py-2 rounded-lg text-xs font-bold ${cls}">${text}</button>`;

      // Try get nav fresh (optional)
      let nav = Orland?.state?.nav || null;
      try{
        const r = await Orland.api("/api/nav");
        if(r?.status === "ok"){
          nav = r.data;
          Orland.state.nav = nav;
        }
      }catch{}

      // Build list of nav paths (from nav.tree or nav.flat)
      const navPaths = new Set();
      try{
        if(Array.isArray(nav?.flat)){
          for(const m of nav.flat){
            if(m?.path) navPaths.add(String(m.path));
          }
        } else if(nav?.menus){
          // menus format: sections core/integrations/system/config with submenus
          const sections = ["core","integrations","system","config"];
          for(const k of sections){
            for(const item of (nav.menus[k] || [])){
              if(item?.path) navPaths.add(String(item.path));
              for(const sub of (item?.submenus || [])){
                if(sub?.path) navPaths.add(String(sub.path));
              }
            }
          }
        } else if(Array.isArray(nav?.tree)){
          // tree format
          const walk=(n)=>{
            if(n?.path) navPaths.add(String(n.path));
            for(const ch of (n?.children||[])) walk(ch);
          };
          for(const n of nav.tree) walk(n);
        }
      }catch{}

      // Determine missing in registry
      const missing = [];
      for(const p of Array.from(navPaths)){
        const clean = p.replace(/\/+$/,"") || "/";
        if(!routes[clean]) missing.push(clean);
      }
      missing.sort();

      // Render
      host.innerHTML = `
        <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
          <div class="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div class="text-lg font-extrabold">🚧 Module belum tersedia</div>
              <div class="text-xs text-slate-500 mt-1">
                Path: <code class="px-2 py-1 rounded bg-slate-100 dark:bg-black/30">${esc(cur)}</code>
              </div>
            </div>
            <div class="flex gap-2 flex-wrap">
              ${btn("btnGoDash","Dashboard","bg-primary text-white")}
              ${btn("btnReloadNav","Reload Menu","border border-slate-200 dark:border-darkBorder")}
              ${btn("btnCopyMissing","Copy missing routes","border border-slate-200 dark:border-darkBorder")}
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-2">Registry routes</div>
              <div class="text-xs text-slate-500 mb-2">Total: <b>${Object.keys(routes).length}</b></div>
              <div class="text-xs max-h-64 overflow-auto space-y-1">
                ${Object.keys(routes).sort().map(p=>`
                  <div class="flex items-center justify-between gap-2">
                    <code class="text-[11px]">${esc(p)}</code>
                    <span class="text-[10px] text-slate-400">${esc(routes[p]?.title || "")}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-2">Nav routes belum ada module</div>
              <div class="text-xs text-slate-500 mb-2">Missing: <b>${missing.length}</b></div>

              ${missing.length ? `
                <div class="text-xs max-h-64 overflow-auto space-y-1">
                  ${missing.map(p=>`
                    <div class="flex items-center justify-between gap-2">
                      <code class="text-[11px]">${esc(p)}</code>
                      <button class="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-black/30 hover:opacity-90"
                        data-go="${esc(p)}">Open</button>
                    </div>
                  `).join("")}
                </div>
                <div class="text-[11px] text-slate-500 mt-3">
                  Tips: tambahkan route-route di atas ke <code>public/modules/registry.js</code>.
                </div>
              ` : `
                <div class="text-xs text-slate-500">✅ Semua menu dari database sudah punya route di registry.</div>
              `}
            </div>
          </div>
        </div>
      `;

      // Bind buttons
      host.querySelector("#btnGoDash")?.addEventListener("click", ()=> Orland.navigate("/dashboard", false));
      host.querySelector("#btnReloadNav")?.addEventListener("click", async ()=>{
        const r = await Orland.api("/api/nav");
        if(r?.status==="ok"){
          Orland.state.nav = r.data;
          Orland.renderNav(Orland.state.path || "/dashboard");
          // reload current placeholder view
          Orland.navigate("/placeholder", true);
        }
      });

      host.querySelectorAll("[data-go]").forEach(b=>{
        b.addEventListener("click", ()=>{
          const p = b.getAttribute("data-go");
          if(p) Orland.navigate(p, false);
        });
      });

      host.querySelector("#btnCopyMissing")?.addEventListener("click", async ()=>{
        const txt = missing.map(p=>`"${p}": { module: "/modules/mod_placeholder.js", export: "default", title: "${p}" },`).join("\n");
        try{
          await navigator.clipboard.writeText(txt || "(no missing routes)");
          Orland?.toast?.("Copied!", "success");
        }catch{
          alert(txt || "(no missing routes)");
        }
      });
    }
  };
}
