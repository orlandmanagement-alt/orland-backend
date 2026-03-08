/*
  Orland Admin Dashboard (Tailwind + Alpine) - Module Loader
  - Sidebar menu from /api/nav
  - Route by menu.path (no .html)
  - Lazy-load modules from public/modules/*
*/
(function(){
  "use strict";

  async function api(path, opt = {}){
    const headers = Object.assign({}, opt.headers || {});
    if (opt.body != null && !headers["content-type"]) headers["content-type"] = "application/json";
    try{
      const res = await fetch(path, { method: opt.method || "GET", headers, body: opt.body || undefined, credentials:"include" });
      const ct = res.headers.get("content-type") || "";
      if(!ct.includes("application/json")){
        const text = await res.text().catch(()=> "");
        return { status:"server_error", data:{ http: res.status, body: text.slice(0, 500) } };
      }
      return await res.json();
    }catch(e){
      return { status:"network_error", data:{ message: String(e?.message || e) } };
    }
  }

  function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }
  function toast(msg,type="info"){
    try{ window.dispatchEvent(new CustomEvent("orland:toast",{ detail:{ msg, type } })); }
    catch{ alert(msg); }
  }

  async function loadRegistry(){
    const mod = await import("/modules/registry.js");
    return mod.ModuleRegistry || {};
  }

  function flattenMenus(menus){
    const out = [];
    function pushSection(list){
      (list||[]).forEach(m=>{
        out.push(m);
        (m.submenus||[]).forEach(s=>out.push({ ...s, _isSub:true, _parent:m }));
      });
    }
    pushSection(menus.core);
    pushSection(menus.integrations);
    pushSection(menus.system);
    pushSection(menus.config);
    return out;
  }

  async function mountModule(path, ctx){
    const registry = await loadRegistry();
    const loader = registry[path];
    const mountEl = document.getElementById("moduleMount");
    if(!mountEl) return;

    if(!loader){
      mountEl.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div class="w-20 h-20 rounded-full bg-slate-100 dark:bg-darkBorder flex items-center justify-center text-3xl text-slate-400 mb-4">
            <i class="fa-solid fa-person-digging"></i>
          </div>
          <div class="text-lg font-bold">Module not installed</div>
          <div class="text-xs text-slate-500 mt-2">Path: <code>${esc(path)}</code></div>
        </div>
      `;
      return;
    }

    mountEl.innerHTML = `<div class="text-xs text-slate-500">Loading module…</div>`;
    const m = await loader();
    if(typeof m.mount !== "function"){
      mountEl.innerHTML = `<div class="text-sm text-red-500">Invalid module: ${esc(path)}</div>`;
      return;
    }
    await m.mount({ ...ctx, api, toast, mountEl });
  }

  // Expose to Alpine
  window.__orland = { api, toast, mountModule, flattenMenus };

})();
