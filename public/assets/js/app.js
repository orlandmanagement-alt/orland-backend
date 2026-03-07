function orlandApp(){
  return {
    // --- guards ---
    __inited:false,
    __initLock:false,

    // --- UI state ---
    sidebarOpen:false,
    darkMode: localStorage.getItem("theme")==="dark",
    page:"dashboard",
    subpage:null,

    // --- auth/data ---
    me:null,
    menus:{ core:[], integrations:[], system:[] },
    loadingNav:true,

    // --- debug overlay ---
    debug:true,
    debugLines:[],
    dbg(msg){
      const s = `[${new Date().toISOString().slice(11,19)}] ${String(msg||"")}`;
      this.debugLines.unshift(s);
      this.debugLines = this.debugLines.slice(0,12);
      try{ console.log("[ORLAND]", s); }catch{}
    },

    // --- safe fetch ---
    async api(path,opt={}){
      const headers = Object.assign({}, opt.headers||{});
      if(opt.body!=null && !headers["content-type"]) headers["content-type"]="application/json";
      try{
        const r = await fetch(path,{method:opt.method||"GET",headers,body:opt.body||undefined,credentials:"include"});
        const ct = r.headers.get("content-type")||"";
        if(!ct.includes("application/json")){
          const t = await r.text().catch(()=> "");
          return {status:"server_error", data:{http:r.status, body:(t||"").slice(0,200)}};
        }
        return await r.json();
      }catch(e){
        return {status:"network_error", data:{message:String(e?.message||e)}};
      }
    },

    // --- theme ---
    applyTheme(){
      localStorage.setItem("theme", this.darkMode ? "dark" : "light");
      if(this.darkMode) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    },
    toggleTheme(){
      this.darkMode=!this.darkMode;
      this.applyTheme();
      if(this.page==="dashboard") setTimeout(()=>this.initChart(),150);
    },

    // --- IMPORTANT: init only once ---
    async initOnce(){
      // prevent re-init loop
      if(this.__inited) return;
      if(this.__initLock) return;
      this.__initLock = true;

      try{
        this.dbg("initOnce() start");
        this.applyTheme();

        // attach global error traps (debug in HP)
        if(!window.__ORLAND_ERR_HOOKED){
          window.__ORLAND_ERR_HOOKED = true;
          window.addEventListener("error", (e)=> {
            try{
              const m = e?.message || "unknown error";
              this.dbg("window.error: "+m);
            }catch{}
          });
          window.addEventListener("unhandledrejection", (e)=>{
            try{
              this.dbg("promise.reject: "+String(e?.reason?.message||e?.reason||e));
            }catch{}
          });
        }

        // auth check
        const me = await this.api("/api/me");
        this.dbg("/api/me => "+me.status);

        if(me.status!=="ok"){
          this.dbg("not authed -> go login");
          // stop loops: only redirect if not already on login
          if(!location.pathname.endsWith("/login.html")) location.href="/login.html";
          return;
        }
        this.me = me.data;

        // load nav
        await this.loadNav();

        // default page
        this.page = "dashboard";
        this.subpage = null;

        // close sidebar on outside click for mobile
        document.addEventListener("click", (ev)=>{
          const side = document.querySelector("aside");
          const btn  = ev.target.closest?.("[data-sidebar-open]");
          if(btn) return;
          if(!this.sidebarOpen) return;
          if(side && side.contains(ev.target)) return;
          this.sidebarOpen = false;
        }, { passive:true });

        setTimeout(()=>this.initChart(), 250);

        this.__inited = true;
        this.dbg("initOnce() done");
      }catch(e){
        this.dbg("init crash: "+String(e?.message||e));
        alert("INIT ERROR: "+String(e?.message||e));
      }finally{
        this.__initLock = false;
      }
    },

    async loadNav(){
      this.loadingNav=true;
      const nav = await this.api("/api/nav");
      this.loadingNav=false;
      this.dbg("/api/nav => "+nav.status);

      if(nav.status==="ok"){
        this.menus = nav.data.grouped || {core:[],integrations:[],system:[]};
      }else{
        // fallback minimal
        this.menus = {
          core:[
            {id:"m_dash", code:"dashboard", label:"Dashboard", icon:"fa-solid fa-gauge-high"},
            {id:"m_users", code:"users", label:"User Manager", icon:"fa-solid fa-users-gear"},
          ],
          integrations:[],
          system:[]
        };
        this.dbg("nav fallback used");
      }
    },

    // navigation click
    navigate(menu, sub=null){
      this.page = menu.code || menu.id || "dashboard";
      this.subpage = sub ? (sub.code || sub.id) : null;
      this.sidebarOpen=false;

      if(this.page==="dashboard") setTimeout(()=>this.initChart(),150);
    },

    // logout
    async logout(){
      await this.api("/api/logout", {method:"POST", body:"{}"});
      location.href="/login.html";
    },

    // chart safe
    initChart(){
      try{
        const el = document.getElementById("mainChart");
        if(!el){ this.dbg("chart: no canvas"); return; }
        if(!window.Chart){ this.dbg("chart: Chart.js not loaded"); return; }

        const existing = Chart.getChart("mainChart");
        if(existing) existing.destroy();

        const ctx = el.getContext("2d");
        const isDark = this.darkMode;
        const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
        const textColor = isDark ? "#94a3b8" : "#64748b";

        new Chart(ctx,{
          type:"line",
          data:{
            labels:["Mon","Tue","Wed","Thu","Fri","Sat","Sun"],
            datasets:[{
              label:"Traffic",
              data:[120,190,150,250,220,310,280],
              borderColor:"#3b82f6",
              backgroundColor:"rgba(59,130,246,0.1)",
              borderWidth:2,
              fill:true,
              tension:0.4,
              pointRadius:3
            }]
          },
          options:{
            maintainAspectRatio:false,
            responsive:true,
            plugins:{ legend:{display:false}},
            scales:{
              y:{ beginAtZero:true, grid:{color:gridColor}, ticks:{color:textColor,font:{size:10}}, border:{display:false}},
              x:{ grid:{display:false}, ticks:{color:textColor,font:{size:10}}, border:{display:false}}
            }
          }
        });

        this.dbg("chart: rendered");
      }catch(e){
        this.dbg("chart error: "+String(e?.message||e));
      }
    }
  }
}
