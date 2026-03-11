function qs(id){ return document.getElementById(id); }

async function api(path, opt = {}) {
  const headers = Object.assign({}, opt.headers || {});
  if (opt.body != null && !headers["content-type"]) headers["content-type"] = "application/json";
  try{
    const res = await fetch(path, {
      method: opt.method || "GET",
      headers,
      body: opt.body || undefined,
      credentials: "include"
    });
    const ct = res.headers.get("content-type") || "";
    if(!ct.includes("application/json")){
      const t = await res.text().catch(()=> "");
      return { status:"server_error", data:{ http:res.status, body:t.slice(0,280) } };
    }
    return await res.json();
  }catch(e){
    return { status:"network_error", data:{ message:String(e?.message || e) } };
  }
}

function diceBear(seed){
  const s = encodeURIComponent(String(seed || "user"));
  return `https://api.dicebear.com/8.x/initials/svg?seed=${s}&backgroundColor=3b82f6&textColor=ffffff`;
}

function setBreadcrumb(path){
  const el = qs("breadcrumb");
  if(el) el.textContent = path || "/";
}

function mkBtn(item, active){
  const a = document.createElement("button");
  a.type = "button";
  a.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors duration-150 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5";
  if(active) a.classList.add("sidebar-active");
  a.innerHTML = `
    <i class="${item.icon || "fa-solid fa-circle-dot"} w-5 text-center"></i>
    <span class="font-medium truncate">${item.label || item.id || "-"}</span>
  `;
  a.onclick = () => window.Orland.navigate(item.path || "/dashboard");
  return a;
}

function mkSubBtn(item, active){
  const b = document.createElement("button");
  b.type = "button";
  b.className = "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors duration-150 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-700 dark:hover:text-slate-200";
  if(active) b.classList.add("sub-active");
  b.innerHTML = `
    <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
    <span class="truncate">${item.label || item.id || "-"}</span>
  `;
  b.onclick = ()=> window.Orland.navigate(item.path || "/dashboard");
  return b;
}

function pathStartsWith(activePath, basePath){
  const a = String(activePath || "");
  const b = String(basePath || "");
  if(!a || !b) return false;
  if(a === b) return true;
  return a.startsWith(b + "/");
}

function computeOpenGroups(items, activePath){
  const open = new Set();
  for(const it of (items || [])){
    const subs = Array.isArray(it.submenus) ? it.submenus : [];
    if(!subs.length) continue;

    const parentHit = pathStartsWith(activePath, it.path || "");
    const childHit = subs.some(s => pathStartsWith(activePath, s.path || ""));
    if(parentHit || childHit) open.add(String(it.id || it.path || ""));
  }
  return open;
}

function mkGroup(sectionId, items, activePath){
  const root = qs(sectionId);
  if(!root) return;
  root.innerHTML = "";

  const uniq = [];
  const seen = new Set();
  for(const it of (items || [])){
    const key = String(it.id || "") + "|" + String(it.path || "");
    if(seen.has(key)) continue;
    seen.add(key);
    uniq.push(it);
  }

  const openGroups = computeOpenGroups(uniq, activePath);
  const remembered = window.Orland.state.openMenus || {};

  for(const it of uniq){
    const subs = Array.isArray(it.submenus) ? it.submenus : [];
    const isParentActive = pathStartsWith(activePath, it.path || "");
    const hasActiveChild = subs.some(s => pathStartsWith(activePath, s.path || ""));
    const isOpen = openGroups.has(String(it.id || it.path || "")) || remembered[String(it.id || it.path || "")] === true;

    if(subs.length){
      const wrap = document.createElement("div");
      wrap.className = "mb-1";

      const head = document.createElement("button");
      head.type = "button";
      head.className = "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors duration-150 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5";
      if(isParentActive || hasActiveChild) head.classList.add("sidebar-active");

      head.innerHTML = `
        <i class="${it.icon || "fa-solid fa-folder"} w-5 text-center"></i>
        <span class="font-medium truncate flex-1 text-left">${it.label || it.id || "-"}</span>
        <i class="fa-solid ${isOpen ? "fa-chevron-up" : "fa-chevron-down"} text-[10px] opacity-70"></i>
      `;

      const groupKey = String(it.id || it.path || "");
      head.onclick = ()=>{
        const cur = !!window.Orland.state.openMenus[groupKey];
        window.Orland.state.openMenus[groupKey] = !cur;
        window.Orland.renderNav(window.Orland.state.path);
      };

      wrap.appendChild(head);

      const subWrap = document.createElement("div");
      subWrap.className = isOpen ? "mt-1 ml-3 pl-3 border-l border-slate-200 dark:border-darkBorder space-y-1" : "hidden";

      for(const s of subs){
        const active = pathStartsWith(activePath, s.path || "");
        subWrap.appendChild(mkSubBtn(s, active));
      }

      wrap.appendChild(subWrap);
      root.appendChild(wrap);
    }else{
      const active = pathStartsWith(activePath, it.path || "");
      root.appendChild(mkBtn(it, active));
    }
  }
}

async function getRegistry(){
  const r = await api("/api/registry");
  if(r.status === "ok" && r.data?.routes) return { routes: r.data.routes };
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
      host.innerHTML = `<div class="text-xs text-red-500">Invalid module export: ${String(r.export || "default")}</div>`;
      return;
    }
    const inst = factory(window.Orland);
    document.title = inst.title ? `ORLAND | ${inst.title}` : "ORLAND | Enterprise Operations";
    setBreadcrumb(path);
    await inst.mount(host);
  }catch(e){
    host.innerHTML = `
      <div class="rounded-2xl border border-red-300 bg-white dark:bg-darkLighter p-4 text-red-600">
        <div class="text-sm font-extrabold">Module import error</div>
        <div class="text-xs mt-2">module=<code>${String(r.module || "")}</code></div>
        <div class="text-xs mt-1">Path: <code>${String(path || "")}</code></div>
        <pre class="text-[11px] mt-3 whitespace-pre-wrap">${String(e?.message || e)}</pre>
      </div>
    `;
  }
}

function resolveParentToFirstChild(path){
  const nav = window.Orland.state.nav;
  const all = []
    .concat(nav?.menus?.core || [])
    .concat(nav?.menus?.integrations || [])
    .concat(nav?.menus?.system || [])
    .concat(nav?.menus?.config || []);

  const hit = all.find(x => (x.path || "") === path && Array.isArray(x.submenus) && x.submenus.length);
  if(hit) return hit.submenus[0]?.path || null;
  return null;
}

window.Orland = {
  diceBear,
  api,
  registry: { routes:{} },
  state: {
    me:null,
    nav:null,
    path:"/dashboard",
    openMenus:{}
  },

  async bootDashboard(){
    const me = await api("/api/me");
    if(me.status !== "ok"){
      location.href = "/login.html";
      return;
    }
    this.state.me = me.data;

    try{
      this.registry = await getRegistry();
    }catch{
      this.registry = { routes:{} };
    }

    const nm = qs("hdrName");
    if(nm) nm.textContent = me.data.display_name || me.data.email_norm || me.data.id || "—";

    const em = qs("hdrEmail");
    if(em) em.textContent = me.data.email_norm || "";

    const av = qs("hdrAvatar");
    if(av) av.src = diceBear(me.data.email_norm || me.data.id);

    const nav = await api("/api/nav");
    if(nav.status === "ok"){
      this.state.nav = nav.data;
      this.renderNav(location.pathname || "/dashboard");
    }

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
    if(p === "/") p = "/dashboard";

    const reg = this.registry?.routes || {};
    if(!reg[p]){
      const ch = resolveParentToFirstChild(p);
      if(ch) p = ch;
    }

    this.state.path = p;

    if(replace) history.replaceState({}, "", p);
    else history.pushState({}, "", p);

    this.renderNav(p);
    if(window.__orlandCloseSidebar) window.__orlandCloseSidebar();

    await loadModuleByPath(p);

    if(window.innerWidth < 1024 && typeof window.__orlandCloseSidebar === "function"){
      window.__orlandCloseSidebar();
    }
  }
};

window.addEventListener("popstate", async ()=>{
  const p = location.pathname || "/dashboard";
  await window.Orland.navigate(p, true);
});
