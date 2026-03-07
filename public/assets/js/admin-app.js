/* Orland Admin Alpine App (REAL API, RBAC nav from /api/nav)
 * - index.html (dashboard) requires login (redirect to /login.html)
 * - login.html authenticates via /api/login (HttpOnly sid cookie)
 */

function orlandAdminApp(){
  const API = {
    async req(path, opt={}){
      const headers = Object.assign({}, opt.headers||{});
      if(opt.body != null && !headers["content-type"]) headers["content-type"] = "application/json";
      try{
        const res = await fetch(path, {
          method: opt.method || "GET",
          headers,
          body: opt.body || undefined,
          credentials: "include",
        });
        const ct = res.headers.get("content-type") || "";
        if(!ct.includes("application/json")){
          const text = await res.text().catch(()=> "");
          return { status:"server_error", data:{ http:res.status, body:text.slice(0,400) } };
        }
        return await res.json();
      }catch(e){
        return { status:"network_error", data:{ message:String(e?.message||e) } };
      }
    }
  };

  function esc(s){ return String(s??""); }

  function toast(msg, type="info"){
    const host = document.getElementById("toastHost");
    if(!host){ alert(msg); return; }
    const map = { info:"bg-slate-900/95", success:"bg-emerald-600/95", error:"bg-rose-600/95", warn:"bg-amber-500/95" };
    const el = document.createElement("div");
    el.className = "px-4 py-3 rounded-xl text-white shadow-lg border border-white/10 " + (map[type] || map.info);
    el.innerHTML = `<div class="text-xs font-bold tracking-widest uppercase">${esc(type)}</div>
                    <div class="text-sm mt-1">${esc(msg)}</div>`;
    host.appendChild(el);
    setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(6px)"; el.style.transition="all .25s"; }, 2600);
    setTimeout(()=> el.remove(), 3200);
  }

  function applyTheme(isDark){
    localStorage.setItem("theme", isDark ? "dark" : "light");
    if(isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }

  function groupFromCodeOrPath(m){
    const code = String(m.code||"");
    const path = String(m.path||"");
    const k = (code || path).toLowerCase();

    // Core
    if(["dashboard","users","roles","menus","rbac","projects"].some(x => k.includes(x))) return "core";
    // Integrations
    if(["blog","blogspot","cms","posts","pages","widgets"].some(x => k.includes(x))) return "integrations";
    // System/Ops
    return "system";
  }

  function toIconDefault(m){
    // fallback icon
    const code = String(m.code||"");
    if(code.includes("dashboard")) return "fa-solid fa-gauge-high";
    if(code.includes("users")) return "fa-solid fa-users-gear";
    if(code.includes("roles")) return "fa-solid fa-user-tag";
    if(code.includes("menus")) return "fa-solid fa-list";
    if(code.includes("rbac")) return "fa-solid fa-user-shield";
    if(code.includes("security")) return "fa-solid fa-shield-halved";
    if(code.includes("audit")) return "fa-solid fa-clipboard-list";
    if(code.includes("ops")) return "fa-solid fa-satellite-dish";
    if(code.includes("ip")) return "fa-solid fa-ban";
    return "fa-solid fa-circle-dot";
  }

  function buildNavModel(navTree){
    // Flatten tree -> keep children as submenus if they exist
    const out = { core:[], integrations:[], system:[] };

    const list = Array.isArray(navTree) ? navTree : [];
    for(const m of list){
      const g = groupFromCodeOrPath(m);
      const icon = m.icon || toIconDefault(m);
      const node = {
        id: m.code || m.id,
        label: m.label || m.code || "Menu",
        icon,
        path: m.path || "#",
        submenus: (m.children||[]).map(ch => ({
          id: ch.code || ch.id,
          label: ch.label || ch.code || "Submenu",
          icon: ch.icon || toIconDefault(ch),
          path: ch.path || "#",
        }))
      };
      out[g].push(node);
    }

    // Sort within groups (optional, keep stable)
    return out;
  }

  function pathToLocation(path){
    // Admin multipage mapping (optional). If kamu pakai 1 index SPA, tetap "#"
    // Karena kamu minta index.html adalah dashboard utama, kita pakai hash internal.
    // Jadi klik menu hanya mengubah state (page/subpage), bukan navigasi URL.
    // Kalau mau multipage lagi nanti, tinggal ganti jadi .html mapping.
    return path || "#";
  }

  return {
    // ---------- core state ----------
    isLoggedIn: false,
    isLoggingIn: false,
    sidebarOpen: false,
    darkMode: (localStorage.getItem("theme") === "dark"),
    me: null,

    // routing internal UI
    page: "dashboard",
    subpage: null,

    // RBAC nav from backend
    menus: { core:[], integrations:[], system:[] },

    // data cache
    data: { admins:[], loadingAdmins:false },

    // ---------- lifecycle ----------
    async init(){
      applyTheme(this.darkMode);

      // If this is the dashboard page, enforce login
      const requireAuth = document.body.getAttribute("data-require-auth") === "1";
      if(requireAuth){
        const ok = await this.loadSession();
        if(!ok){
          location.href = "/login.html";
          return;
        }
        await this.loadNav();
        // default route
        this.navigate("dashboard");
      }

      this.$watch("darkMode", () => applyTheme(this.darkMode));
    },

    // ---------- auth ----------
    async loadSession(){
      const me = await API.req("/api/me");
      if(me.status === "ok"){
        this.me = me.data;
        this.isLoggedIn = true;
        return true;
      }
      this.me = null;
      this.isLoggedIn = false;
      return false;
    },

    async doLogin(){
      const email = String(this.$refs.email?.value||"").trim().toLowerCase();
      const password = String(this.$refs.password?.value||"");
      if(!email.includes("@") || password.length < 6){
        toast("Email/password tidak valid.", "error"); return;
      }

      this.isLoggingIn = true;
      const r = await API.req("/api/login", { method:"POST", body: JSON.stringify({ email, password }) });
      this.isLoggingIn = false;

      if(r.status !== "ok"){
        toast("Login gagal: " + r.status, "error");
        return;
      }

      // now cookie sid set
      const ok = await this.loadSession();
      if(!ok){
        toast("Login sukses tapi session gagal dibaca.", "error");
        return;
      }
      toast("Login sukses.", "success");
      location.href = "/";
    },

    async logout(){
      await API.req("/api/logout", { method:"POST", body:"{}" });
      this.me = null;
      this.isLoggedIn = false;
      location.href = "/login.html";
    },

    // ---------- nav / RBAC ----------
    async loadNav(){
      const nav = await API.req("/api/nav");
      if(nav.status !== "ok"){
        toast("Gagal load nav: " + nav.status, "error");
        return;
      }
      // API nav could return {tree} or {menus}
      const tree = nav.data?.tree || nav.data?.menus || [];
      this.menus = buildNavModel(tree);

      // Add fixed profile (always)
      this.menus.system.unshift({ id:"profile", label:"My Profile", icon:"fa-solid fa-id-badge", path:"/profile", submenus:[] });
    },

    // ---------- routing ----------
    navigate(targetPage, targetSubpage=null){
      this.page = targetPage;

      // default subpage
      if(!targetSubpage){
        const all = [...this.menus.core, ...this.menus.integrations, ...this.menus.system];
        const menu = all.find(x => x.id === targetPage);
        if(menu && menu.submenus && menu.submenus.length){
          this.subpage = menu.submenus[0].id;
        }else{
          this.subpage = null;
        }
      }else{
        this.subpage = targetSubpage;
      }

      this.sidebarOpen = false;

      // eager-load data for specific pages
      if(this.page === "users"){
        // we use subpage=admin for now
        this.loadAdmins();
      }
      if(this.page === "dashboard"){
        setTimeout(()=> this.initChart(), 60);
      }
    },

    // ---------- dashboard chart ----------
    initChart(){
      const canvas = document.getElementById("mainChart");
      if(!canvas || !window.Chart) return;

      const chartOld = window.Chart.getChart("mainChart");
      if(chartOld) chartOld.destroy();

      const ctx = canvas.getContext("2d");
      const isDark = this.darkMode;
      const gridColor = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
      const textColor = isDark ? "#94a3b8" : "#64748b";

      new window.Chart(ctx, {
        type:"line",
        data:{
          labels:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
          datasets:[{
            label:"Traffic",
            data:[120,190,150,250,220,310,280],
            borderColor:"#3b82f6",
            backgroundColor:"rgba(59,130,246,0.12)",
            borderWidth:2,
            fill:true,
            tension:0.4,
            pointBackgroundColor:"#fff",
            pointBorderColor:"#3b82f6",
            pointBorderWidth:2,
            pointRadius:4,
          }]
        },
        options:{
          maintainAspectRatio:false,
          responsive:true,
          plugins:{ legend:{ display:false }},
          scales:{
            y:{ beginAtZero:true, grid:{ color:gridColor }, ticks:{ color:textColor, font:{ size:10 }}, border:{ display:false }},
            x:{ grid:{ display:false }, ticks:{ color:textColor, font:{ size:10 }}, border:{ display:false }},
          }
        }
      });
    },

    // ---------- Users(Admin) (real API) ----------
    async loadAdmins(){
      if(this.subpage !== "admin") return;
      this.data.loadingAdmins = true;

      const r = await API.req("/api/users/admin?limit=50");
      this.data.loadingAdmins = false;

      if(r.status !== "ok"){
        toast("Load admin users gagal: " + r.status, "error");
        this.data.admins = [];
        return;
      }

      // normalize row fields from backend
      this.data.admins = (r.data?.users || []).map(u => ({
        id: u.id,
        name: u.display_name || "-",
        email: u.email_norm || "-",
        role: (u.roles||[]).join(", "),
        status: u.status || "active",
      }));
    },

    // UI helper
    sidebarBtnClass(id){
      return this.page === id ? "sidebar-active text-primary" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5";
    },

    // Theme
    toggleTheme(){ this.darkMode = !this.darkMode; },
  };
}
