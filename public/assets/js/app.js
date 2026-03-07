/* Orland Dashboard — multipage app.js (SAFE, anti redirect-loop)
 * Same-origin API under /api/*
 */
(function(){
  "use strict";

  // -------------------------
  // API helper (returns {status,data,http})
  // -------------------------
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

      const http = res.status;
      const ct = res.headers.get("content-type") || "";

      // if JSON -> parse
      if (ct.includes("application/json")) {
        const j = await res.json();
        // normalize: include http to allow logic decisions
        if (j && typeof j === "object" && j.status) return { ...j, http };
        return { status:"server_error", data:{ http, body:"invalid_json_shape" }, http };
      }

      // non-json response (cloudflare html error page, etc)
      const text = await res.text().catch(() => "");
      return { status:"server_error", data:{ http, body: text.slice(0, 280) }, http };

    } catch (e) {
      return { status:"network_error", data:{ message: String(e?.message || e), url: path }, http: 0 };
    }
  }

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const esc = (s)=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");

  function toast(msg, type="info"){
    const host = document.getElementById("toast-host");
    if(!host) return alert(msg);
    const div = document.createElement("div");
    div.className = "toast-item";
    div.innerHTML = `<div style="font-weight:800">${esc(type.toUpperCase())}</div><div class="small-muted" style="margin-top:4px">${esc(msg)}</div>`;
    host.appendChild(div);
    setTimeout(()=>{ div.style.opacity="0"; div.style.transform="translateY(6px)"; }, 2400);
    setTimeout(()=>div.remove(), 3200);
  }

  function diceBear(seed){
    const s = encodeURIComponent(String(seed||"user"));
    return `https://api.dicebear.com/8.x/initials/svg?seed=${s}&backgroundColor=6d28d9&textColor=ffffff`;
  }

  function bindPasswordToggles(){
    $$(".pw-toggle").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const id = btn.getAttribute("data-target");
        const input = document.getElementById(id);
        if(!input) return;
        const isPw = input.getAttribute("type")==="password";
        input.setAttribute("type", isPw ? "text" : "password");
        btn.innerHTML = isPw ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
      });
    });
  }

  // --------------------------------
  // REDIRECT POLICY (IMPORTANT)
  // --------------------------------
  function shouldRedirectToLogin(meResp){
    // redirect ONLY when truly unauthorized
    return (
      meResp?.status === "unauthorized" ||
      meResp?.http === 401 ||
      meResp?.http === 403
    );
  }

  function showFatal(boxSel, msg, payload){
    const box = $(boxSel);
    if(!box) return;
    box.innerHTML = `
      <div class="orland-card p-3" style="border:1px solid rgba(255,0,0,.2)">
        <div style="font-weight:900;color:#ffb4b4">Backend error</div>
        <div class="small-muted mt-2">${esc(msg)}</div>
        <details class="mt-2">
          <summary class="small-muted">Debug</summary>
          <pre class="small-muted mt-2" style="white-space:pre-wrap">${esc(JSON.stringify(payload,null,2))}</pre>
        </details>
        <div class="small-muted mt-2">Tip: cek D1 schema/binding + logs Pages Functions.</div>
      </div>
    `;
  }

  // ---------- Auth pages ----------
  async function pageLogin(){
    const out = $("#debugOut");

    // ✅ SAFE check session - DO NOT redirect on 500
    const me0 = await api("/api/me");
    if (out) out.textContent = JSON.stringify(me0, null, 2);
    if(me0.status === "ok"){
      location.href="/dashboard.html";
      return;
    }
    if (shouldRedirectToLogin(me0)) {
      // ok, stay on login
    } else if (me0.status === "server_error" || me0.status === "network_error") {
      // show warning but don't redirect
      toast("Server sedang error. Login bisa gagal sampai backend normal.", "error");
    }

    const st = await api("/api/setup/status");
    if(out) out.textContent = JSON.stringify(st,null,2);
    if(st.status==="ok" && st.data?.setup_required){
      location.href = "/setup.html";
      return;
    }

    $("#btnLogin")?.addEventListener("click", async ()=>{
      const email = String($("#email")?.value||"").trim().toLowerCase();
      const password = String($("#password")?.value||"");
      const r = await api("/api/login", { method:"POST", body: JSON.stringify({ email, password }) });
      if(out) out.textContent = JSON.stringify(r,null,2);

      if(r.status==="ok"){
        toast("Login sukses", "success");
        location.href="/dashboard.html";
      } else {
        toast("Login gagal: "+r.status, "error");
      }
    });

    $("#password")?.addEventListener("keydown",(e)=>{ if(e.key==="Enter") $("#btnLogin")?.click(); });
  }

  async function pageSetup(){
    const out = $("#debugOut");
    const st = await api("/api/setup/status");
    if(out) out.textContent = JSON.stringify(st,null,2);

    const params = new URLSearchParams(location.search);
    const invite = params.get("invite");

    if(st.status==="ok" && !st.data?.setup_required && !invite){
      location.href = "/index.html";
      return;
    }

    $("#btnSetup")?.addEventListener("click", async ()=>{
      const display_name = String($("#display_name")?.value||"").trim();
      const email = String($("#email")?.value||"").trim().toLowerCase();
      const password = String($("#password")?.value||"");
      if(!email.includes("@") || password.length<10){ toast("Email invalid / password min 10", "error"); return; }

      const r = await api("/api/setup/bootstrap", { method:"POST", body: JSON.stringify({ email, display_name, password }) });
      if(out) out.textContent = JSON.stringify(r,null,2);
      if(r.status==="ok"){ toast("Berhasil. Silakan login.", "success"); location.href="/index.html"; }
      else toast("Gagal: "+r.status, "error");
    });
  }

  async function pageResetRequest(){
    const out = $("#debugOut");
    $("#btnSend")?.addEventListener("click", async ()=>{
      const email = String($("#email")?.value||"").trim().toLowerCase();
      const r = await api("/api/password/reset/request", { method:"POST", body: JSON.stringify({ email }) });
      if(out) out.textContent = JSON.stringify(r,null,2);
      toast("Jika email terdaftar, link reset dikirim.", "info");
    });
  }

  async function pageResetConfirm(){
    const out = $("#debugOut");
    const token = new URLSearchParams(location.search).get("token") || "";
    if(!token){ toast("Token tidak ada", "error"); return; }
    const v = await api("/api/password/reset/validate", { method:"POST", body: JSON.stringify({ token }) });
    if(out) out.textContent = JSON.stringify(v,null,2);
    if(v.status!=="ok"){ toast("Token invalid/expired", "error"); return; }

    $("#btnReset")?.addEventListener("click", async ()=>{
      const new_password = String($("#password")?.value||"");
      if(new_password.length<10){ toast("Password min 10", "error"); return; }
      const r = await api("/api/password/reset/confirm", { method:"POST", body: JSON.stringify({ token, new_password }) });
      if(out) out.textContent = JSON.stringify(r,null,2);
      if(r.status==="ok"){ toast("Reset sukses. Silakan login.", "success"); location.href="/index.html"; }
      else toast("Gagal: "+r.status, "error");
    });
  }

  // ---------- Shared authed shell ----------
  async function bootAuthed(pageKey){
    const out = $("#debugOut");
    const me = await api("/api/me");
    if(out) out.textContent = JSON.stringify(me,null,2);

    // ✅ Redirect ONLY on unauthorized
    if (shouldRedirectToLogin(me)) {
      location.href="/index.html";
      return null;
    }

    // ✅ If server error -> show error UI, DO NOT redirect (prevents loop)
    if (me.status !== "ok") {
      toast("Tidak bisa memuat sesi karena backend error.", "error");
      showFatal("#opsBox", "Gagal memuat /api/me (backend error).", me);
      return null;
    }

    $("#meName").textContent = me.data.display_name || me.data.email_norm || me.data.id;
    $("#meRole").textContent = (me.data.roles||[]).join(", ");
    $("#meAvatar").src = diceBear(me.data.email_norm || me.data.id);

    $("#btnLogout")?.addEventListener("click", async ()=>{
      await api("/api/logout", { method:"POST", body:"{}" });
      location.href="/index.html";
    });

    $("#navToggle")?.addEventListener("click", ()=>{
      $("#sidebar")?.classList.toggle("open");
    });

    const nav = await api("/api/nav");
    if(nav.status==="ok"){
      renderNav(nav.data.tree || nav.data.menus || []);
    }

    const map = {
      overview:["Overview","Ringkasan sistem & KPI"],
      profile:["Profile","Akun kamu & ganti password"],
      users:["Users","CRUD admin/staff"],
      roles:["Roles","Kelola role"],
      menus:["Menus","Kelola menu"],
      rbac:["RBAC","Assign menu ke role"],
      security:["Security","Metrics & trend"],
      ipblocks:["IP Blocks","Kelola IP blokir"],
      audit:["Audit Logs","Jejak aktivitas"],
      ops:["Ops","System status"],
    };
    const t = map[pageKey] || ["Dashboard",""];
    $("#pageTitle").textContent = t[0];
    $("#pageSubtitle").textContent = t[1];

    return me;
  }

  function renderNav(tree){
    const root = $("#navList");
    if(!root) return;

    const fixed = [{ label:"Profile", code:"profile", path:"/profile", icon:"fa-solid fa-id-badge", children:[] }];

    const items = [];
    const walk = (node, depth=0)=>{
      items.push({ ...node, depth });
      (node.children||[]).forEach(ch=>walk(ch, depth+1));
    };
    (fixed.concat(Array.isArray(tree)?tree:[])).forEach(n=>walk(n,0));

    root.innerHTML = items.map(m=>{
      const pad = 10 + (m.depth*14);
      const icon = m.icon ? `<i class="${esc(m.icon)}"></i>` : `<i class="fa-solid fa-circle-dot" style="opacity:.55"></i>`;
      const href = pathToHref(m.path || "");
      return `<a class="nav-item" href="${esc(href)}" style="padding-left:${pad}px" data-href="${esc(href)}">${icon}<span>${esc(m.label||m.code||"Menu")}</span></a>`;
    }).join("");

    const cur = location.pathname.replace(/\/+$/,"");
    $$(".nav-item", root).forEach(a=>{
      const h = (a.getAttribute("data-href")||"").replace(/\/+$/,"");
      a.classList.toggle("active", h===cur);
    });
  }

  function pathToHref(p){
    const map = {
      "/dashboard": "/dashboard.html",
      "/users": "/users.html",
      "/roles": "/roles.html",
      "/menus": "/menus.html",
      "/rbac": "/rbac.html",
      "/security": "/security.html",
      "/ipblocks": "/ipblocks.html",
      "/audit": "/audit.html",
      "/ops": "/ops.html",
      "/profile": "/profile.html",
    };
    return map[p] || "/dashboard.html";
  }

  // ---------- Pages ----------
  async function pageOverview(){
    const me = await bootAuthed("overview"); if(!me) return;
    const out = $("#debugOut");

    const ops = await api("/api/ops/status");
    if(out) out.textContent = JSON.stringify({ me, ops }, null, 2);

    if(ops.status==="ok"){
      $("#kpiUsers").textContent = ops.data.users;
      $("#kpiRoles").textContent = ops.data.roles;
      $("#kpiMenus").textContent = ops.data.menus;
      $("#kpiIpBlocks").textContent = ops.data.ip_blocks_active;
      $("#opsBox").innerHTML = `
        <div class="row g-2">
          <div class="col-md-4"><div class="kpi"><div class="small-muted">Incidents open</div><div style="font-size:22px;font-weight:900">${esc(ops.data.incidents_open)}</div></div></div>
          <div class="col-md-4"><div class="kpi"><div class="small-muted">Role menus</div><div style="font-size:22px;font-weight:900">${esc(ops.data.role_menus)}</div></div></div>
          <div class="col-md-4"><div class="kpi"><div class="small-muted">Active IP blocks</div><div style="font-size:22px;font-weight:900">${esc(ops.data.ip_blocks_active)}</div></div></div>
        </div>
      `;
    } else {
      // ✅ do not redirect; just show error
      showFatal("#opsBox", "Gagal memuat /api/ops/status", ops);
    }
  }

  // ---------- Boot ----------
  document.addEventListener("DOMContentLoaded", async ()=>{
    bindPasswordToggles();

    const dp = document.body.getAttribute("data-page") || "";
    if(dp==="login"){ await pageLogin(); return; }
    if(dp==="setup"){ await pageSetup(); return; }
    if(dp==="reset-request"){ await pageResetRequest(); return; }
    if(dp==="reset-confirm"){ await pageResetConfirm(); return; }

    const page = window.__PAGE__ || "";
    if(page==="overview") return pageOverview();

    // fallback
    await bootAuthed("overview");
  });
})();
