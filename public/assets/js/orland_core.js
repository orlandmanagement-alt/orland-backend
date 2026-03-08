function qs(id){ return document.getElementById(id); }

async function api(path, opt = {}) {
  const headers = Object.assign({}, opt.headers || {});
  if (opt.body != null && !headers["content-type"]) headers["content-type"] = "application/json";
  try{
    const res = await fetch(path, { method: opt.method||"GET", headers, body: opt.body||undefined, credentials:"include" });
    const ct = res.headers.get("content-type")||"";
    if(!ct.includes("application/json")){
      const t = await res.text().catch(()=> "");
      return { status:"server_error", data:{ http:res.status, body:t.slice(0,280) } };
    }
    return await res.json();
  }catch(e){
    return { status:"network_error", data:{ message:String(e?.message||e) } };
  }
}

function diceBear(seed){
  const s = encodeURIComponent(String(seed||"user"));
  return `https://api.dicebear.com/8.x/initials/svg?seed=${s}&backgroundColor=3b82f6&textColor=ffffff`;
}

function setBreadcrumb(path){
  const el = qs("breadcrumb");
  if(el) el.textContent = path || "/";
}

function mkBtn(item, active){
  const a = document.createElement("button");
  a.className = "w-full flex items-center gap-3 px-6 py-2.5 transition-colors duration-150 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5";
  if(active) a.classList.add("sidebar-active");
  a.innerHTML = `<i class="${item.icon||"fa-solid fa-circle-dot"} w-5 text-center"></i><span class="font-medium">${item.label||item.id}</span>`;
  a.onclick = () => window.Orland.navigate(item.path || "/dashboard");
  return a;
}

function mkGroup(sectionId, items, activePath){
  const root = qs(sectionId);
  if(!root) return;
  root.innerHTML = "";
  for(const it of (items||[])){
    if(it.submenus && it.submenus.length){
      const wrap = document.createElement("div");
      const head = mkBtn(it, (activePath||"") === (it.path||""));
      head.onclick = () => window.Orland.navigate(it.path || it.submenus[0]?.path || "/dashboard");
      wrap.appendChild(head);

      const sub = document.createElement("div");
      sub.className = "bg-slate-50/50 dark:bg-black/20 py-1";
      for(const s of it.submenus){
        const b = document.createElement("button");
        b.className = "w-full flex items-center pl-14 pr-6 py-2 text-xs font-medium border-l-2 transition-colors duration-150 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-transparent";
        if((activePath||"") === (s.path||"")){
          b.classList.add("text-primary");
          b.style.borderLeftColor = "#3b82f6";
        }
        b.textContent = s.label || s.id;
        b.onclick = ()=> window.Orland.navigate(s.path || "/dashboard");
        sub.appendChild(b);
      }
      wrap.appendChild(sub);
      root.appendChild(wrap);
    } else {
      root.appendChild(mkBtn(it, (activePath||"") === (it.path||"")));
    }
  }
}

async function getRegistry(){
  // 1) Try server registry first (protected by auth)
  try{
    const r = await api("/api/registry");
    if(r.status === "ok" && r.data?.Registry) return r.data.Registry;
  }catch{}
  // 2) Fallback: local registry (public/modules/registry.js)
  try{
    const mod = await import("/modules/registry.js");
    if(mod.Registry) return mod.Registry;
  }catch{}
  // 3) last-resort empty
  return { routes:{} };
}

async function loadModuleByPath(path){
  const host = qs("module-host");
  if(!host) return;

  const reg = window.Orland.registry || { routes:{} };
  const clean = String(path||"").replace(/\/+$/,"") || "/dashboard";
  const r = reg.routes[clean];

  // ✅ Fallback: route not registered => go placeholder (no loop)
  if(!r){
    // if placeholder exists in registry, navigate there
    if (clean !== "/placeholder" && reg.routes["/placeholder"]) {
      // IMPORTANT: use replace=true so back button isn't polluted
      return window.Orland.navigate("/placeholder", true);
    }

    // last-resort: render inline placeholder
    host.innerHTML = `
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-5">
        <div class="text-sm font-bold mb-1">Coming soon</div>
        <div class="text-xs text-slate-500 mb-3">
          Module untuk <code>${clean}</code> belum tersedia / belum terdaftar di registry.
        </div>
        <div class="flex gap-2 flex-wrap">
          <button id="btnGoDash" class="px-3 py-2 rounded-lg bg-primary text-white text-xs font-bold">
            Kembali ke Dashboard
          </button>
          <button id="btnReloadNav" class="px-3 py-2 rounded-lg border border-slate-200 dark:border-darkBorder text-xs font-bold">
            Reload Menu
          </button>
        </div>
      </div>
    `;
    document.title = "ORLAND | Coming soon";
    setBreadcrumb(clean);

    qs("btnGoDash")?.addEventListener("click", ()=> window.Orland.navigate("/dashboard", false));
    qs("btnReloadNav")?.addEventListener("click", async ()=>{
      const nav = await api("/api/nav");
      if(nav.status==="ok"){
        window.Orland.state.nav = nav.data;
        window.Orland.renderNav(window.Orland.state.path || "/dashboard");
      }
    });
    return;
  }

  host.innerHTML = `<div class="text-xs text-slate-500">Loading module: ${clean} ...</div>`;

  const mod = await import(r.module);
  const factory = (r.export && mod[r.export]) ? mod[r.export] : (mod.default || null);

  if(!factory){
    host.innerHTML = `
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-xl p-4">
        <div class="text-sm font-bold mb-1">Invalid module export</div>
        <div class="text-xs text-slate-500">
          Export <code>${r.export}</code> tidak ditemukan pada module <code>${r.module}</code>.
        </div>
      </div>
    `;
    return;
  }

  const inst = factory(window.Orland);
  document.title = inst.title ? `ORLAND | ${inst.title}` : "ORLAND | Enterprise Operations";
  setBreadcrumb(clean);
  await inst.mount(host);
}
window.Orland = {
  api,
  registry: { routes:{} },
  state: { me:null, nav:null, path:"/dashboard" },

  async bootDashboard(){
    const me = await api("/api/me");
    if(me.status !== "ok"){ location.href="/login.html"; return; }
    this.state.me = me.data;

    // registry (server -> local fallback)
    this.registry = await getRegistry();

    // profile box
    const nm = qs("meName"); if(nm) nm.textContent = me.data.display_name || me.data.email_norm || me.data.id;
    const em = qs("meEmail"); if(em) em.textContent = me.data.email_norm || "";
    const av = qs("meAvatar"); if(av) av.src = diceBear(me.data.email_norm || me.data.id);

    // nav
    const nav = await api("/api/nav");
    if(nav.status==="ok"){
      this.state.nav = nav.data;
      this.renderNav(location.pathname || "/dashboard");
    }

    // logout
    const lo = qs("btnLogout");
    lo && (lo.onclick = async ()=>{
      await api("/api/logout",{ method:"POST", body:"{}" });
      location.href="/login.html";
    });

    // initial route: "/" treated as "/dashboard" (NO redirects)
    const p = (location.pathname === "/" ? "/dashboard" : location.pathname);
    await this.navigate(p, true);
  },

  renderNav(activePath){
    const m = this.state.nav?.menus || { core:[], integrations:[], system:[], config:[] };
    mkGroup("nav-core", m.core, activePath);
    mkGroup("nav-integrations", m.integrations, activePath);
    mkGroup("nav-system", m.system, activePath);
    mkGroup("nav-config", m.config, activePath);
  },

  async navigate(path, replace=false){
    const p0 = String(path||"/dashboard");
    const p = (p0 === "/" ? "/dashboard" : p0).replace(/\/+$/,"") || "/dashboard";
    this.state.path = p;
    if(replace) history.replaceState({}, "", p);
    else history.pushState({}, "", p);
    this.renderNav(p);
    await loadModuleByPath(p);
  }
};

window.addEventListener("popstate", async ()=>{
  const p = (location.pathname === "/" ? "/dashboard" : (location.pathname||"/dashboard"));
  await window.Orland.navigate(p, true);
});
