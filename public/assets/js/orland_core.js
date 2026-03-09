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
  a.className = "w-full flex items-center gap-3 px-6 py-2.5 transition-colors duration-150 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5";
  if(active) a.classList.add("sidebar-active");
  a.innerHTML = `<i class="${item.icon||"fa-solid fa-circle-dot"} w-5 text-center"></i><span class="font-medium">${item.label||item.id}</span>`;
  a.onclick = () => window.Orland.navigate(item.path || "/dashboard");
  return a;
}

function mkSubBtn(s, activePath){
  const b = document.createElement("button");
  b.className = "w-full flex items-center pl-14 pr-6 py-2 text-xs font-semibold border-l-2 transition-colors duration-150 text-slate-500 hover:text-slate-900 dark:text-slate-300/80 dark:hover:text-white border-transparent";
  if((activePath||"") === (s.path||"")){
    b.classList.add("text-primary");
    b.style.borderLeftColor = "#3b82f6";
  }
  b.innerHTML = `<span class="truncate">${s.label || s.id}</span>`;
  b.onclick = ()=> window.Orland.navigate(s.path || "/dashboard");
  return b;
}

function mkGroup(sectionId, items, activePath){
  const root = qs(sectionId);
  if(!root) return;
  root.innerHTML = "";

  const seen = new Set();
  const uniq = [];
  for(const it of (items||[])){
    const key = String(it.id||"") + "|" + String(it.path||"");
    if(seen.has(key)) continue;
    seen.add(key);
    uniq.push(it);
  }

  for(const it of uniq){
    if(it.submenus && it.submenus.length){
      const wrap = document.createElement("div");
      wrap.className = "mb-1";

      const head = document.createElement("button");
      head.className = "w-full flex items-center justify-between gap-3 px-6 py-2.5 transition-colors duration-150 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5";
      const isActiveParent = (activePath||"") === (it.path||"");
      if(isActiveParent) head.classList.add("sidebar-active");
      head.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
          <i class="${it.icon||"fa-solid fa-circle-dot"} w-5 text-center"></i>
          <span class="font-medium truncate">${it.label||it.id}</span>
        </div>
        <i class="fa-solid fa-chevron-down text-[10px] opacity-70"></i>
      `;

      // dropdown state (open jika salah satu child aktif)
      const anyChildActive = it.submenus.some(s => (s.path||"") === (activePath||""));
      const keyOpen = "orland_nav_open_" + String(it.id||it.path||"group");
      let open = (localStorage.getItem(keyOpen)==="1") || anyChildActive;

      const sub = document.createElement("div");
      sub.className = "bg-slate-50/60 dark:bg-black/20 py-1";
      if(!open) sub.style.display = "none";
      for(const s of it.submenus) sub.appendChild(mkSubBtn(s, activePath));

      head.onclick = ()=>{
        open = !open;
        localStorage.setItem(keyOpen, open ? "1" : "0");
        sub.style.display = open ? "block" : "none";
      };

      wrap.appendChild(head);
      wrap.appendChild(sub);
      root.appendChild(wrap);
    } else {
      root.appendChild(mkBtn(it, (activePath||"") === (it.path||"")));
    }
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
  state: { me:null, nav:null, path:"/dashboard" },

  async bootDashboard(){
    const me = await api("/api/me");
    if(me.status !== "ok"){ location.href="/login.html"; return; }
    this.state.me = me.data;

    try{ this.registry = await getRegistry(); }catch{ this.registry = { routes:{} }; }

    const nm = qs("hdrName"); if(nm) nm.textContent = me.data.display_name || me.data.email_norm || me.data.id;
    const em = qs("hdrEmail"); if(em) em.textContent = me.data.email_norm || "";
    const av = qs("hdrAvatar"); if(av) av.src = diceBear(me.data.email_norm || me.data.id);

    const nav = await api("/api/nav");
    if(nav.status==="ok"){
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
    if(p==="/") p="/dashboard";

    const reg = this.registry?.routes || {};
    if(!reg[p]){
      const ch = resolveParentToFirstChild(p);
      if(ch) p = ch;
    }

    this.state.path = p;
    if(replace) history.replaceState({}, "", p);
    else history.pushState({}, "", p);

    this.renderNav(p);

    // auto close sidebar on mobile (index.html define window.__orlandCloseSidebar)
    if(window.__orlandCloseSidebar && window.innerWidth < 1024) window.__orlandCloseSidebar();

    await loadModuleByPath(p);
  }
};

window.addEventListener("popstate", async ()=>{
  const p = location.pathname || "/dashboard";
  await window.Orland.navigate(p, true);
});
