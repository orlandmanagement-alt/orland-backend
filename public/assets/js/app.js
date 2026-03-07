function orlandApp(){
  return {
    sidebarOpen:false,
    darkMode: localStorage.getItem("theme")==="dark",
    me:null,

    loadingNav:true,
    menus:{ core:[], integrations:[], system:[] },

    page:"dashboard",
    subpage:null,

    // users
    userQ:"",
    loadingUsers:false,
    adminUsers:[],

    // debug (set false kalau sudah aman)
    debug:true,
    debugMsg:"",

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

    setDebug(msg){
      this.debugMsg = String(msg||"");
      if(this.debug) console.log("[ORLAND]", this.debugMsg);
    },

    avatarUrl(){
      const n = encodeURIComponent((this.me?.display_name || this.me?.email_norm || "Admin"));
      return `https://ui-avatars.com/api/?name=${n}&background=3b82f6&color=fff`;
    },

    applyTheme(){
      localStorage.setItem("theme", this.darkMode ? "dark" : "light");
      if(this.darkMode) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    },

    toggleTheme(){
      this.darkMode = !this.darkMode;
      this.applyTheme();
      if(this.page==="dashboard") setTimeout(()=>this.initChart(),150);
    },

    async init(){
      try{
        this.applyTheme();
        this.setDebug("init() start");

        const me = await this.api("/api/me");
        this.setDebug("api/me => "+me.status);

        if(me.status!=="ok"){
          this.setDebug("not authed, redirect login");
          location.href="/login.html";
          return;
        }
        this.me = me.data;

        await this.loadNav();

        // default page
        this.page = "dashboard";
        this.subpage = null;

        setTimeout(()=>this.initChart(), 250);
      }catch(e){
        this.setDebug("init crash: "+String(e?.message||e));
        alert("INIT ERROR: "+String(e?.message||e));
      }
    },

    async loadNav(){
      this.loadingNav=true;
      const nav = await this.api("/api/nav");
      this.loadingNav=false;

      this.setDebug("api/nav => "+nav.status);

      if(nav.status==="ok"){
        this.menus = nav.data.grouped || {core:[],integrations:[],system:[]};

        // safety inject
        const hasDash = (this.menus.core||[]).some(m=>m.code==="dashboard");
        if(!hasDash){
          this.menus.core.unshift({id:"m_core_dashboard",code:"dashboard",label:"Dashboard",path:"/dashboard",icon:"fa-solid fa-gauge-high",children:[]});
        }
        const hasUsers = (this.menus.core||[]).some(m=>m.code==="users");
        if(!hasUsers){
          this.menus.core.push({id:"m_core_users",code:"users",label:"User Manager",path:"/users",icon:"fa-solid fa-users-gear",children:[]});
        }
      } else {
        // jangan blank total
        this.menus.core = [
          {id:"m_core_dashboard",code:"dashboard",label:"Dashboard",path:"/dashboard",icon:"fa-solid fa-gauge-high",children:[]},
          {id:"m_core_users",code:"users",label:"User Manager",path:"/users",icon:"fa-solid fa-users-gear",children:[]},
        ];
        this.menus.integrations = [];
        this.menus.system = [];
      }
    },

    navigate(node, parent=null){
      if(parent){
        this.page = parent.code;
        this.subpage = node.code;
      }else{
        this.page = node.code;
        this.subpage = null;
      }
      this.sidebarOpen=false;

      if(this.page==="dashboard") setTimeout(()=>this.initChart(),150);
      if(this.page==="users") this.loadAdminUsers();
    },

    async logout(){
      await this.api("/api/logout", {method:"POST", body:"{}"});
      location.href="/login.html";
    },

    initChart(){
      try{
        const el = document.getElementById("mainChart");
        if(!el || !window.Chart) return;

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
              label:"Platform Traffic",
              data:[120,190,150,250,220,310,280],
              borderColor:"#3b82f6",
              backgroundColor:"rgba(59,130,246,0.1)",
              borderWidth:2,
              fill:true,
              tension:0.4,
              pointBackgroundColor:"#fff",
              pointBorderColor:"#3b82f6",
              pointBorderWidth:2,
              pointRadius:4
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
      }catch(e){
        this.setDebug("chart error: "+String(e?.message||e));
      }
    },

    async loadAdminUsers(){
      this.loadingUsers=true;
      const q = (this.userQ||"").trim();
      const url = "/api/users/admin?limit=80" + (q ? ("&q="+encodeURIComponent(q)) : "");
      const r = await this.api(url);
      this.loadingUsers=false;

      if(r.status==="ok"){
        this.adminUsers = r.data.users || [];
      }else{
        this.adminUsers = [];
        alert("Load users failed: "+r.status);
      }
    },

    async toggleUser(u){
      const action = (u.status==="active") ? "disable" : "enable";
      const r = await this.api("/api/users/admin",{method:"PUT", body:JSON.stringify({action, user_id:u.id})});
      if(r.status==="ok") this.loadAdminUsers();
      else alert("Failed: "+r.status);
    },

    async resetPw(u){
      const pw = prompt("New password (min 10):","");
      if(!pw || pw.length<10) return;
      const r = await this.api("/api/users/admin",{method:"PUT", body:JSON.stringify({action:"reset_password", user_id:u.id, new_password:pw})});
      if(r.status!=="ok") alert("Failed: "+r.status);
      else alert("OK");
    },

    async revoke(u){
      const r = await this.api("/api/users/admin",{method:"PUT", body:JSON.stringify({action:"revoke_sessions", user_id:u.id})});
      if(r.status!=="ok") alert("Failed: "+r.status);
      else alert("Sessions revoked");
    }
  }
}
