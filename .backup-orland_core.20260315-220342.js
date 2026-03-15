import {
  normalizeGroupKey,
  findActiveGroup,
  renderGroupedSidebarHtml,
  bindSidebarGroupToggle
} from "./group_key_sidebar.js";

import {
  getFavorites,
  toggleFavorite,
  isFavorite,
  addRecent,
  getRecent,
  clearRecent,
  groupSavedItems,
  renderSavedGroupedSection
} from "./group_key_favorites.js";

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

function pathStartsWith(activePath, basePath){
  const a = String(activePath || "");
  const b = String(basePath || "");
  if(!a || !b) return false;
  if(a === b) return true;
  return a.startsWith(b + "/");
}

function normalizeNavItems(items){
  const rows = Array.isArray(items) ? items : [];
  return rows.map(x => ({
    id: String(x?.id || ""),
    code: String(x?.code || ""),
    label: String(x?.label || x?.id || "-"),
    path: String(x?.path || "/dashboard"),
    parent_id: x?.parent_id ? String(x.parent_id) : null,
    sort_order: Number(x?.sort_order ?? 9999),
    icon: String(x?.icon || "fa-solid fa-circle-dot"),
    group_key: normalizeGroupKey(x?.group_key)
  }));
}

function groupNavItemsIntoLegacyBuckets(items){
  const rows = Array.isArray(items) ? items : [];
  return {
    core: rows.filter(x => ["dashboard", "access", "users"].includes(normalizeGroupKey(x.group_key))),
    integrations: rows.filter(x => ["content"].includes(normalizeGroupKey(x.group_key))),
    system: rows.filter(x => ["security", "ops", "data", "audit"].includes(normalizeGroupKey(x.group_key))),
    config: rows.filter(x => ["settings"].includes(normalizeGroupKey(x.group_key)))
  };
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
  const allItems = Array.isArray(nav?.items) ? nav.items : [];
  const hit = allItems.find(x => (x.path || "") === path);

  if(!hit) return null;

  const children = allItems
    .filter(x => String(x.parent_id || "") === String(hit.id || ""))
    .sort((a, b)=>{
      const sa = Number(a.sort_order ?? 9999);
      const sb = Number(b.sort_order ?? 9999);
      if(sa !== sb) return sa - sb;
      return String(a.label || "").localeCompare(String(b.label || ""));
    });

  if(children.length) return children[0].path || null;
  return null;
}

function renderLegacyFallbackNav(activePath){
  const m = window.Orland.state.nav?.menus || { core:[], integrations:[], system:[], config:[] };

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

  function computeOpenGroups(items, path){
    const open = new Set();
    for(const it of (items || [])){
      const subs = Array.isArray(it.submenus) ? it.submenus : [];
      if(!subs.length) continue;

      const parentHit = pathStartsWith(path, it.path || "");
      const childHit = subs.some(s => pathStartsWith(path, s.path || ""));
      if(parentHit || childHit) open.add(String(it.id || it.path || ""));
    }
    return open;
  }

  function mkGroup(sectionId, items, path){
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

    const openGroups = computeOpenGroups(uniq, path);
    const remembered = window.Orland.state.openMenus || {};

    for(const it of uniq){
      const subs = Array.isArray(it.submenus) ? it.submenus : [];
      const isParentActive = pathStartsWith(path, it.path || "");
      const hasActiveChild = subs.some(s => pathStartsWith(path, s.path || ""));
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
          const active = pathStartsWith(path, s.path || "");
          subWrap.appendChild(mkSubBtn(s, active));
        }

        wrap.appendChild(subWrap);
        root.appendChild(wrap);
      }else{
        const active = pathStartsWith(path, it.path || "");
        root.appendChild(mkBtn(it, active));
      }
    }
  }

  mkGroup("nav-core", m.core, activePath);
  mkGroup("nav-integrations", m.integrations, activePath);
  mkGroup("nav-system", m.system, activePath);
  mkGroup("nav-config", m.config, activePath);
}

function currentNavItem(path){
  const p = String(path || "").trim();
  const allItems = Array.isArray(window.Orland.state.nav?.items) ? window.Orland.state.nav.items : [];
  return allItems.find(x => String(x.path || "") === p) || null;
}

function bindFavRecentSection(root){
  root.querySelectorAll(".favRecentItem").forEach(el => {
    el.addEventListener("click", ()=>{
      const path = String(el.getAttribute("data-path") || "").trim();
      if(path) window.Orland.navigate(path);
    });
  });

  root.querySelectorAll(".favToggleBtn").forEach(btn => {
    btn.addEventListener("click", ()=>{
      const path = String(btn.getAttribute("data-path") || "").trim();
      const item = currentNavItem(path);
      if(!item) return;
      toggleFavorite(item);
      window.Orland.renderNav(window.Orland.state.path);
    });
  });

  root.querySelectorAll(".groupedNavFavBtn").forEach(btn => {
    btn.addEventListener("click", (e)=>{
      e.preventDefault();
      e.stopPropagation();
      const path = String(btn.getAttribute("data-path") || "").trim();
      const item = currentNavItem(path);
      if(!item) return;
      toggleFavorite(item);
      window.Orland.renderNav(window.Orland.state.path);
    });
  });

  root.querySelectorAll(".btnClearRecent").forEach(btn => {
    btn.addEventListener("click", ()=>{
      clearRecent();
      window.Orland.renderNav(window.Orland.state.path);
    });
  });
}

function renderFavoriteRecentBlocks(target){
  const favorites = groupSavedItems(getFavorites());
  const recent = groupSavedItems(getRecent());

  return `
    <div class="space-y-3 mb-4">
      ${renderSavedGroupedSection({
        title: "Favorites",
        sections: favorites,
        emptyText: "No favorites yet.",
        itemClass: "favRecentItem",
        actionLabel: "saved"
      })}
      ${renderSavedGroupedSection({
        title: "Recent",
        sections: recent,
        emptyText: "No recent access yet.",
        itemClass: "favRecentItem",
        actionLabel: "recent",
        showClear: true,
        clearId: "btnClearRecent"
      })}
    </div>
  `;
}

function renderGroupedNav(activePath){
  const allItems = Array.isArray(window.Orland.state.nav?.items)
    ? window.Orland.state.nav.items
    : [];

  const navCore = qs("nav-core");
  const navIntegrations = qs("nav-integrations");
  const navSystem = qs("nav-system");
  const navConfig = qs("nav-config");

  if(!navCore) return;

  if(navIntegrations) navIntegrations.innerHTML = "";
  if(navSystem) navSystem.innerHTML = "";
  if(navConfig) navConfig.innerHTML = "";

  let currentPath = String(activePath || "/dashboard").trim() || "/dashboard";
  if(currentPath === "/") currentPath = "/dashboard";

  const activeGroup = findActiveGroup(allItems, currentPath);
  if(activeGroup && !window.Orland.state.sidebarGroupsExpanded.includes(activeGroup)){
    window.Orland.state.sidebarGroupsExpanded = Array.from(new Set(
      [activeGroup].concat(window.Orland.state.sidebarGroupsExpanded || [])
    ));
  }

  const sidebarHtml = renderGroupedSidebarHtml({
    items: allItems,
    currentPath,
    expandedGroups: window.Orland.state.sidebarGroupsExpanded,
    onPathPrefix: ""
  });

  const activeItem = currentNavItem(currentPath);
  const favBar = activeItem ? `
    <div class="mb-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-3">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[11px] font-black uppercase tracking-wide text-slate-500">Current</div>
          <div class="text-xs font-semibold truncate mt-1">${activeItem.label}</div>
          <div class="text-[10px] text-slate-500 mt-1 truncate">${activeItem.path}</div>
        </div>
        <button
          type="button"
          class="groupedNavFavBtn px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-black"
          data-path="${activeItem.path}"
        >
          ${isFavorite(activeItem.path) ? "Unfavorite" : "Favorite"}
        </button>
      </div>
    </div>
  ` : "";

  navCore.innerHTML = `
    ${favBar}
    ${renderFavoriteRecentBlocks(navCore)}
    <div class="space-y-3">${sidebarHtml}</div>
  `;

  bindSidebarGroupToggle(
    navCore,
    ()=>window.Orland.state.sidebarGroupsExpanded,
    (next)=>{
      window.Orland.state.sidebarGroupsExpanded = Array.isArray(next) ? next : [];
      window.Orland.renderNav(window.Orland.state.path);
    }
  );

  navCore.querySelectorAll("[data-path]").forEach(el => {
    if(el.classList.contains("favRecentItem")) return;
    if(el.classList.contains("groupedNavFavBtn")) return;
    el.addEventListener("click", (e)=>{
      e.preventDefault();
      const path = String(el.getAttribute("data-path") || "").trim() || "/dashboard";
      window.Orland.navigate(path);
    });
  });

  bindFavRecentSection(navCore);
}

window.Orland = {
  diceBear,
  api,
  registry: { routes:{} },
  state: {
    me:null,
    nav:null,
    path:"/dashboard",
    openMenus:{},
    sidebarGroupsExpanded:[]
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
      const rawItems = Array.isArray(nav.data?.items) ? nav.data.items : [];
      const items = normalizeNavItems(rawItems);

      this.state.nav = {
        ...nav.data,
        items,
        menus: groupNavItemsIntoLegacyBuckets(items)
      };

      const firstActiveGroup = findActiveGroup(items, location.pathname || "/dashboard");
      this.state.sidebarGroupsExpanded = firstActiveGroup ? [firstActiveGroup] : ["dashboard", "access"];

      this.renderNav(location.pathname || "/dashboard");
    }

    const p = (location.pathname === "/" ? "/dashboard" : location.pathname);
    await this.navigate(p, true);
  },

  renderNav(activePath){
    const hasGroupedItems = Array.isArray(this.state.nav?.items) && this.state.nav.items.length > 0;
    if(hasGroupedItems){
      renderGroupedNav(activePath);
      return;
    }
    renderLegacyFallbackNav(activePath);
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

    const navItem = currentNavItem(p);
    if(navItem) addRecent(navItem);

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
