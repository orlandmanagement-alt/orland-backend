/* Orland Core (FINAL)
 * - Loads /api/me, /api/nav
 * - Builds sidebar sections: core/integrations/system/config
 * - Client-side router: loads modules via public/modules/registry.js (dynamic import)
 * - No auto refresh loop (only history.pushState + render)
 */
(function(){
  "use strict";

  // ---------- helpers ----------
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;"); }

  async function api(path, opt = {}) {
    const headers = Object.assign({}, opt.headers || {});
    if (opt.body != null && !headers["content-type"]) headers["content-type"] = "application/json";
    try {
      const res = await fetch(path, {
        method: opt.method || "GET",
        headers,
        body: opt.body || undefined,
        credentials: "include",
      });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text().catch(() => "");
        return { status: "server_error", data: { http: res.status, body: text.slice(0, 280) } };
      }
      return await res.json();
    } catch (e) {
      return { status: "network_error", data: { message: String(e?.message || e) } };
    }
  }

  function toast(msg, type="info"){
    const host = $("toast-host");
    if(!host) return;
    const div = document.createElement("div");
    div.className = "fixed z-[200] right-4 bottom-4 max-w-[320px] rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-xl p-3 text-xs";
    div.innerHTML = `<div class="font-bold">${esc(type.toUpperCase())}</div><div class="mt-1 text-slate-500">${esc(msg)}</div>`;
    host.appendChild(div);
    setTimeout(()=>{ div.style.opacity="0"; div.style.transform="translateY(6px)"; div.style.transition="all .35s"; }, 2200);
    setTimeout(()=>div.remove(), 2800);
  }

  function diceBear(seed){
    const s = encodeURIComponent(String(seed||"user"));
    return `https://api.dicebear.com/8.x/initials/svg?seed=${s}&backgroundColor=3b82f6&textColor=ffffff`;
  }

  function setBreadcrumb(text){
    const el = $("breadcrumb");
    if(el) el.textContent = text || "/";
  }

  // ---------- menu render ----------
  function makeMenuButton(item){
    const btn = document.createElement("button");
    btn.className = "w-full flex items-center justify-between px-6 py-2.5 transition-colors duration-150 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5";
    btn.innerHTML = `
      <div class="flex items-center gap-3">
        <i class="${esc(item.icon||"fa-solid fa-circle-dot")} w-5 text-center"></i>
        <span class="font-medium text-[13px]">${esc(item.label||item.id)}</span>
      </div>
      ${item.submenus ? `<i class="fa-solid fa-chevron-down text-[10px] opacity-70"></i>` : ``}
    `;
    return btn;
  }

  function makeSubButton(sub, active){
    const b = document.createElement("button");
    b.className = "w-full flex items-center pl-14 pr-6 py-2 text-xs font-medium border-l-2 transition-colors duration-150 " +
      (active ? "text-primary border-primary" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 border-transparent");
    b.textContent = sub.label || sub.id;
    return b;
  }

  function markActiveButtons(){
    const cur = location.pathname.replace(/\/+$/,"") || "/";
    document.querySelectorAll("button[data-path]").forEach(b=>{
      const p = (b.getAttribute("data-path")||"").replace(/\/+$/,"") || "/";
      b.classList.toggle("sidebar-active", p === cur);
    });
  }

  function renderSection(targetId, items){
    const host = $(targetId);
    if(!host) return;
    host.innerHTML = "";

    (items||[]).forEach(item=>{
      if(!item) return;

      if(!item.submenus || !item.submenus.length){
        const btn = makeMenuButton(item);
        btn.dataset.path = item.path || "/";
        btn.onclick = ()=>Orland.goto(item.path || "/");
        host.appendChild(btn);
        return;
      }

      // dropdown group
      const wrap = document.createElement("div");
      wrap.className = "mb-1";
      const head = makeMenuButton(item);

      const panel = document.createElement("div");
      panel.className = "bg-slate-50/50 dark:bg-black/20 py-1";
      panel.style.display = "none";

      head.onclick = ()=>{
        const open = panel.style.display !== "none";
        panel.style.display = open ? "none" : "block";
      };

      wrap.appendChild(head);
      (item.submenus||[]).forEach(sub=>{
        const b = makeSubButton(sub, false);
        b.dataset.path = sub.path || "/";
        b.onclick = ()=>Orland.goto(sub.path || "/");
        panel.appendChild(b);
      });
      wrap.appendChild(panel);
      host.appendChild(wrap);
    });

    markActiveButtons();
  }

  // ---------- module loader ----------
  async function loadRegistry(){
    // registry.js must export: export const routes = [{ path, loader }]
    try {
      const mod = await import("/modules/registry.js");
      return Array.isArray(mod.routes) ? mod.routes : [];
    } catch (e) {
      toast("registry.js missing / error", "error");
      return [];
    }
  }

  function matchRoute(routes, path){
    // exact first, then prefix (longest)
    const p = (path||"/").replace(/\/+$/,"") || "/";
    let exact = routes.find(r => (r.path||"") === p);
    if(exact) return exact;

    // prefix match
    const pref = routes
      .filter(r => p.startsWith((r.path||"") + "/"))
      .sort((a,b)=> (b.path||"").length - (a.path||"").length)[0];
    return pref || null;
  }

  async function renderCurrent(){
    const host = $("module-host");
    if(!host) return;

    const path = (location.pathname||"/").replace(/\/+$/,"") || "/";

    const routes = await loadRegistry();
    const m = matchRoute(routes, path);

    if(!m){
      host.innerHTML = `<div class="text-xs text-slate-500">No module for <code>${esc(path)}</code></div>`;
      setBreadcrumb("/" + path.split("/").filter(Boolean).join(" / "));
      markActiveButtons();
      return;
    }

    setBreadcrumb("/" + path.split("/").filter(Boolean).join(" / "));
    markActiveButtons();

    host.innerHTML = `<div class="text-xs text-slate-500">Loading module…</div>`;
    try{
      const mod = await m.loader();
      const factory = mod.default;
      if(typeof factory !== "function") throw new Error("module default export must be a function(ctx)");
      const instance = factory({
        api, toast, setBreadcrumb,
        goto: Orland.goto
      });
      if(!instance || typeof instance.mount !== "function") throw new Error("module must return {mount(host)}");
      instance.mount(host);
    }catch(e){
      host.innerHTML = `<div class="text-xs text-slate-500">Module error: ${esc(e?.message||e)}</div>`;
      toast("Module error: "+String(e?.message||e), "error");
    }
  }

  // ---------- core boot ----------
  async function bootDashboard(){
    // session check
    const me = await api("/api/me");
    if(me.status !== "ok"){
      // go login (your project uses /login.html or /index.html)
      location.href = "/login.html";
      return;
    }

    // set identity
    const u = me.data || {};
    const name = u.display_name || u.email_norm || u.id || "—";
    const email = u.email_norm || "—";
    if($("meName")) $("meName").textContent = name;
    if($("meEmail")) $("meEmail").textContent = email;
    if($("meAvatar")) $("meAvatar").src = diceBear(email);

    // nav
    const nav = await api("/api/nav");
    if(nav.status === "ok"){
      const menus = nav.data?.menus || { core:[], integrations:[], system:[], config:[] };
      renderSection("nav-core", menus.core || []);
      renderSection("nav-integrations", menus.integrations || []);
      renderSection("nav-system", menus.system || []);
      renderSection("nav-config", menus.config || []);
    } else {
      toast("Nav failed: "+nav.status, "error");
    }

    // theme toggle
    const btnTheme = $("btnTheme");
    btnTheme && (btnTheme.onclick = ()=>{
      const isDark = document.documentElement.classList.toggle("dark");
      localStorage.setItem("theme", isDark ? "dark" : "light");
      const icon = btnTheme.querySelector("i");
      if(icon) icon.className = isDark ? "fa-solid fa-sun text-warning" : "fa-solid fa-moon";
    });

    // logout
    $("btnLogout") && ($("btnLogout").onclick = async ()=>{
      await api("/api/logout", { method:"POST", body:"{}" });
      location.href = "/login.html";
    });

    // router
    window.addEventListener("popstate", renderCurrent);
    await renderCurrent();
  }

  // ---------- navigation API ----------
  function goto(path){
    const p = (path||"/").trim() || "/";
    if(p === location.pathname) return;
    history.pushState({}, "", p);
    renderCurrent();
  }

  // expose
  window.Orland = { api, toast, bootDashboard, goto };
})();
