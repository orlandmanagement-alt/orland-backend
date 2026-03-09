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

// ---------- sidebar dropdown state ----------
function loadOpenState(){
  try{
    const j = localStorage.getItem("orland_nav_open") || "{}";
    const o = JSON.parse(j);
    return (o && typeof o === "object") ? o : {};
  }catch{ return {}; }
}
function saveOpenState(state){
  try{ localStorage.setItem("orland_nav_open", JSON.stringify(state||{})); }catch{}
}
function isPathActive(activePath, itemPath){
  return String(activePath||"") === String(itemPath||"");
}
function isAnyChildActive(activePath, submenus){
  for(const s of (submenus||[])){
    if(isPathActive(activePath, s.path)) return true;
  }
  return false;
}

function mkBtn(item, active){
  const a = document.createElement("button");
  a.type = "button";
  a.className = "w-full flex items-center gap-3 px-6 py-2.5 transition-colors duration-150 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5";
  if(active) a.classList.add("sidebar-active");
  a.innerHTML = `<i class="${item.icon||"fa-solid fa-circle-dot"} w-5 text-center"></i><span class="font-medium">${item.label||item.id}</span>`;
  return a;
}

function mkGroup(sectionId, items, activePath){
  const root = qs(sectionId);
  if(!root) return;
  root.innerHTML = "";

  // dedupe
  const seen = new Set();
  const uniq = [];
  for(const it of (items||[])){
    const key = String(it.id||"") + "|" + String(it.path||"");
    if(seen.has(key)) continue;
    seen.add(key);
    uniq.push(it);
  }

  const openState = window.Orland?.state?.navOpen || {};

  for(const it of uniq){
    const hasSub = !!(it.submenus && it.submenus.length);

    if(!hasSub){
      const btn = mkBtn(it, isPathActive(activePath, it.path));
      btn.onclick = () => window.Orland.navigate(it.path || "/dashboard");
      root.appendChild(btn);
      continue;
    }

    // parent dropdown
    const wrap = document.createElement("div");
    wrap.className = "select-none";

    const row = document.createElement("div");
    row.className = "w-full flex items-center justify-between px-6 py-2.5 transition-colors duration-150 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5";

    const left = document.createElement("button");
    left.type = "button";
    left.className = "flex items-center gap-3 flex-1 text-left";
    const parentActive = isPathActive(activePath, it.path) || isAnyChildActive(activePath, it.submenus);
    if(parentActive) row.classList.add("sidebar-active");
    left.innerHTML = `<i class="${it.icon||"fa-solid fa-circle-dot"} w-5 text-center"></i><span class="font-medium">${it.label||it.id}</span>`;

    const caret = document.createElement("button");
    caret.type = "button";
    caret.className = "ml-2 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-200/40 dark:hover:bg-white/10";
    caret.innerHTML = `<i class="fa-solid fa-chevron-down text-[11px]"></i>`;

    // auto-open if a child active
    const key = String(it.id || it.path || it.label);
    if(isAnyChildActive(activePath, it.submenus)) openState[key] = true;

    const sub = document.createElement("div");
    sub.className = "bg-slate-50/50 dark:bg-black/20 py-1";
    const isOpen = !!openState[key];
    if(!isOpen) sub.classList.add("hidden");

    // children
    for(const s of it.submenus){
      const b = document.createElement("button");
      b.type = "button";
      b.className = "w-full flex items-center pl-14 pr-6 py-2 text-xs font-medium border-l-2 transition-colors duration-150 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-transparent";
      if(isPathActive(activePath, s.path)){
        b.classList.add("text-primary");
        b.style.borderLeftColor = "#3b82f6";
      }
      b.textContent = s.label || s.id;
      b.onclick = ()=> window.Orland.navigate(s.path || "/dashboard");
      sub.appendChild(b);
    }

    function toggle(){
      const now = sub.classList.toggle("hidden") ? false : true;
      openState[key] = now;
      window.Orland.state.navOpen = openState;
      saveOpenState(openState);
      // rotate caret icon
      const ico = caret.querySelector("i");
      if(ico){
        ico.className = now ? "fa-solid fa-chevron-up text-[11px]" : "fa-solid fa-chevron-down text-[11px]";
      }
    }

    // parent click behavior:
    // - kalau parent punya route/module => navigate
    // - kalau tidak ada route => toggle dropdown (tidak navigate)
    left.onclick = ()=>{
      const reg = window.Orland?.registry?.routes || {};
      const p = String(it.path||"").replace(/\/+$/,"") || "/";
      if(reg[p]){
        window.Orland.navigate(p);
      }else{
        toggle();
      }
    };
    caret.onclick = (e)=>{ e.stopPropagation(); toggle(); };

    // initial caret
    const ico = caret.querySelector("i");
    if(ico){
      ico.className = isOpen ? "fa-solid fa-chevron-up text-[11px]" : "fa-solid fa-chevron-down text-[11px]";
    }

    row.appendChild(left);
    row.appendChild(caret);

    wrap.appendChild(row);
    wrap.appendChild(sub);
    root.appendChild(wrap);
  }
}

async function getRegistry(){
  const r = await api("/api/registry");
  if(r.status==="ok" && r.data?.routes) return { routes: r.data.routes };
  return { routes:{} };
}

async function loadModuleByPath(path){
  const host = qs("module-host");
  if(!host) return;

  const reg = window.Orland.registry || { routes:{} };
  const r = reg.routes[path];

  if(!r){
    const mod = await import("/modules/mod_placeholder.js");
    const inst = mod.default(window.Orland);
    document.title = inst.title ? `ORLAND | ${inst.title}` : "ORLAND | Enterprise Operations";
    setBreadcrumb(path);
    await inst.mount(host);
    return;
  }

  host.innerHTML = `<div class="text-xs text-slate-500">Loading module: ${path} ...</div>`;

  try{
    const mod = await import(r.module);
    const factory = (r.export && mod[r.export]) ? mod[r.export] : (mod.default || null);
    if(!factory){
      host.innerHTML = `<div class="text-xs text-red-400">Invalid module export: ${r.export}</div>`;
      return;
    }
    const inst = factory(window.Orland);
    document.title = inst.title ? `ORLAND | ${inst.title}` : "ORLAND | Enterprise Operations";
    setBreadcrumb(path);
    await inst.mount(host);
  }catch(e){
    host.innerHTML = `
      <div class="rounded-2xl border border-red-300 bg-white p-4 text-red-600">
        <div class="text-sm font-extrabold">Module import error</div>
        <div class="text-xs mt-2">module=<code>${r.module}</code></div>
        <div class="text-xs mt-1">Path: <code>${path}</code></div>
        <pre class="text-[11px] mt-3 whitespace-pre-wrap">${String(e?.message||e)}</pre>
      </div>
    `;
  }
}

function resolveParentToFirstChild(path){
  const nav = window.Orland.state.nav;
  const all = []
    .concat(nav?.menus?.core||[])
    .concat(nav?.menus?.integrations||[])
    .concat(nav?.menus?.system||[])
    .concat(nav?.menus?.config||[]);
  const hit = all.find(x => (x.path||"") === path && x.submenus && x.submenus.length);
  if(hit) return hit.submenus[0]?.path || null;
  return null;
}

window.Orland = {
  diceBear,
  api,
  registry: { routes:{} },
  state: { me:null, nav:null, path:"/dashboard", navOpen: loadOpenState() },

  async bootDashboard(){
    const me = await api("/api/me");
    if(me.status !== "ok"){ location.href="/login.html"; return; }
    this.state.me = me.data;

    // registry
    try{ this.registry = await getRegistry(); }catch{ this.registry = { routes:{} }; }

    // header profile (index.html expects hdrName/hdrEmail/hdrAvatar)
    const nm = qs("hdrName"); if(nm) nm.textContent = me.data.display_name || me.data.email_norm || me.data.id;
    const em = qs("hdrEmail"); if(em) em.textContent = me.data.email_norm || "";
    const av = qs("hdrAvatar"); if(av) av.src = diceBear(me.data.email_norm || me.data.id);

    // nav
    const nav = await api("/api/nav");
    if(nav.status==="ok"){
      this.state.nav = nav.data;
      this.renderNav(location.pathname || "/dashboard");
    }

    // initial route
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
    let p = (path || "/dashboard").replace(/\/+$/,"") || "/";
    if(p==="/") p="/dashboard";

    // if missing module for parent, redirect to submenu first
    const reg = this.registry?.routes || {};
    if(!reg[p]){
      const ch = resolveParentToFirstChild(p);
      if(ch) p = ch;
    }

    this.state.path = p;
    if(replace) history.replaceState({}, "", p);
    else history.pushState({}, "", p);

    this.renderNav(p);

    // close sidebar on mobile (index.html defines window.__orlandCloseSidebar)
    if (window.__orlandCloseSidebar) window.__orlandCloseSidebar();

    await loadModuleByPath(p);
  }
};

window.addEventListener("popstate", async ()=>{
  const p = location.pathname || "/dashboard";
  await window.Orland.navigate(p, true);
});
