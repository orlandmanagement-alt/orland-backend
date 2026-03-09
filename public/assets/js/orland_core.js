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

function isMobile(){
  return window.matchMedia && window.matchMedia("(max-width: 1023px)").matches;
}

function closeSidebarMobile(){
  if(!isMobile()) return;
  const sidebar = qs("sidebar");
  const overlay = qs("sidebarOverlay");
  sidebar?.classList.add("-translate-x-full");
  overlay?.classList.add("hidden");
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
  const r = await api("/api/registry");
  if(r.status==="ok" && r.data?.routes) return { routes: r.data.routes };
  return { routes:{} };
}

async function loadModuleByPath(path){
  const host = qs("module-host");
  if(!host) return;

  const reg = window.Orland.registry || { routes:{} };
  const r = reg.routes[path];

  const showError = (title, errText) => {
    host.innerHTML = `
      <div class="bg-white dark:bg-darkLighter border border-slate-200 dark:border-darkBorder rounded-2xl p-4">
        <div class="text-sm font-extrabold text-red-500">${title}</div>
        <pre class="text-[11px] mt-2 opacity-80 whitespace-pre-wrap">${errText}</pre>
        <div class="text-[11px] opacity-70 mt-3">Path: <code>${path}</code></div>
      </div>
    `;
  };

  if(!r){
    try{
      const mod = await import("/modules/mod_placeholder.js");
      const inst = mod.default(window.Orland);
      document.title = inst.title ? `ORLAND | ${inst.title}` : "ORLAND | Enterprise Operations";
      setBreadcrumb(path);
      await inst.mount(host);
      return;
    }catch(e){
      return showError("Missing route + placeholder failed", String(e?.stack||e));
    }
  }

  host.innerHTML = `<div class="text-xs text-slate-500">Loading module: ${path} ...</div>`;

  try{
    const mod = await import(r.module);
    const factory = (r.export && mod[r.export]) ? mod[r.export] : (mod.default || null);
    if(!factory) return showError("Invalid module export", `module=${r.module}\nexport=${r.export}`);

    const inst = factory(window.Orland);
    document.title = inst.title ? `ORLAND | ${inst.title}` : "ORLAND | Enterprise Operations";
    setBreadcrumb(path);
    await inst.mount(host);
  }catch(e){
    showError("Module import error", `module=${r.module}\n\n${String(e?.stack||e)}`);
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

function applyThemeFromStorage(){
  const t = localStorage.getItem("theme") || "dark";
  const isDark = (t === "dark");
  document.documentElement.classList.toggle("dark", isDark);
  const ic = qs("themeIcon");
  if(ic) ic.className = isDark ? "fa-solid fa-moon" : "fa-solid fa-sun text-warning";
}

window.Orland = {
  api,
  diceBear,
  registry: { routes:{} },
  state: { me:null, nav:null, path:"/dashboard" },

  applyThemeFromStorage,

  toggleTheme(){
    const cur = (localStorage.getItem("theme")||"dark");
    localStorage.setItem("theme", cur==="dark" ? "light" : "dark");
    applyThemeFromStorage();
  },

  async bootDashboard(){
    const me = await api("/api/me");
    if(me.status !== "ok"){ location.href="/login.html"; return; }
    this.state.me = me.data;

    // registry
    try{ this.registry = await getRegistry(); }catch{ this.registry = { routes:{} }; }

    // header profile
    const nm = qs("hdrName"); if(nm) nm.textContent = me.data.display_name || me.data.email_norm || me.data.id;
    const em = qs("hdrEmail"); if(em) em.textContent = me.data.email_norm || "";
    const av = qs("hdrAvatar"); if(av) av.src = diceBear(me.data.email_norm || me.data.id);

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

    // parent to first child
    const reg = this.registry?.routes || {};
    if(!reg[p]){
      const ch = resolveParentToFirstChild(p);
      if(ch) p = ch;
    }

    this.state.path = p;
    if(replace) history.replaceState({}, "", p);
    else history.pushState({}, "", p);

    this.renderNav(p);

    // auto-close sidebar on mobile after navigate
    closeSidebarMobile();

    await loadModuleByPath(p);
  }
};

window.addEventListener("popstate", async ()=>{
  const p = location.pathname || "/dashboard";
  await window.Orland.navigate(p, true);
});
