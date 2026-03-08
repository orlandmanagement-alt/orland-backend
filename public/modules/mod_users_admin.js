export default function UsersAdminModule(Orland){
  const esc = (s)=> String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  const fmtTs = (t)=>{
    const n = Number(t||0);
    if(!n) return "-";
    try{
      const d = new Date(n*1000);
      return d.toISOString().replace("T"," ").slice(0,19) + "Z";
    }catch{ return String(t||"-"); }
  };

  const state = {
    q: "",
    limit: 50,
    loading: false,
    users: [],
    err: "",
  };

  function toast(msg, type="info"){
    // simple toast fallback (works even if toast-host is empty)
    try{
      const host = document.getElementById("toast-host");
      if(!host){ console.log(type,msg); return; }
      const el = document.createElement("div");
      el.className = "mb-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter px-3 py-2 shadow-xl";
      el.innerHTML = `<div class="text-xs font-bold">${esc(type.toUpperCase())}</div><div class="text-xs text-slate-500">${esc(msg)}</div>`;
      host.appendChild(el);
      setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateY(6px)"; el.style.transition="all .2s"; }, 2400);
      setTimeout(()=> el.remove(), 3000);
    }catch(e){ console.log(type,msg); }
  }

  async function load(){
    state.loading = true;
    state.err = "";
    render();

    const url = `/api/users/admin?limit=${encodeURIComponent(state.limit)}${state.q?`&q=${encodeURIComponent(state.q)}`:""}`;
    const r = await Orland.api(url);
    if(r.status !== "ok"){
      state.err = r.status || "error";
      state.users = [];
      state.loading = false;
      render();
      return;
    }
    state.users = (r.data?.users || []).map(u=>({
      id: u.id,
      email_norm: u.email_norm,
      display_name: u.display_name,
      status: u.status,
      roles: u.roles || [],
      last_login_at: u.last_login_at || null,
      created_at: u.created_at || null,
    }));
    state.loading = false;
    render();
  }

  async function act(payload){
    const r = await Orland.api("/api/users/admin", { method:"PUT", body: JSON.stringify(payload) });
    if(r.status === "ok") toast("OK", "success");
    else toast("Failed: " + r.status, "error");
    return r;
  }

  async function createUser(){
    const email = prompt("Email admin/staff:", "");
    if(!email) return;
    const display_name = prompt("Display name:", "") || "";
    const role = (prompt("Role (staff/admin/super_admin):", "staff") || "staff").trim();
    const password = prompt("Password (min 10):", "");
    if(!password || password.length < 10) return toast("Password min 10", "error");

    const r = await Orland.api("/api/users/admin", {
      method:"POST",
      body: JSON.stringify({ email, display_name, role, password })
    });
    if(r.status === "ok"){
      toast("User created", "success");
      await load();
    } else toast("Create failed: " + r.status, "error");
  }

  async function editUser(u){
    const name = prompt("Edit display name:", u.display_name || "") ?? null;
    if(name === null) return;
    const st = (prompt("Status (active/disabled):", u.status || "active") || u.status || "active").trim();
    const r = await act({ action:"update_profile", user_id: u.id, display_name: name.trim(), status: st });
    if(r.status === "ok") await load();
  }

  async function resetPassword(u){
    const pw = prompt("New password (min 10):", "");
    if(!pw || pw.length < 10) return toast("Password min 10", "error");
    const r = await act({ action:"reset_password", user_id: u.id, new_password: pw });
    if(r.status === "ok") toast("Password updated", "success");
  }

  async function setRoles(u){
    const cur = (u.roles||[]).join(",") || "staff";
    const input = prompt("Roles comma-separated (super_admin,admin,staff):", cur);
    if(input === null) return;
    const roles = input.split(",").map(s=>s.trim()).filter(Boolean);
    const r = await act({ action:"set_roles", user_id: u.id, roles });
    if(r.status === "ok") await load();
  }

  async function revokeSessions(u){
    const ok = confirm("Revoke all active sessions for this user?");
    if(!ok) return;
    const r = await act({ action:"revoke_sessions", user_id: u.id });
    if(r.status === "ok") toast("Sessions revoked", "success");
  }

  async function toggleStatus(u){
    const action = (u.status === "disabled") ? "enable" : "disable";
    const r = await act({ action, user_id: u.id });
    if(r.status === "ok") await load();
  }

  function row(u){
    const roleBadges = (u.roles||[]).map(r=>{
      const c = r==="super_admin" ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
              : r==="admin" ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
              : "bg-slate-500/10 text-slate-300 border-slate-500/20";
      return `<span class="text-[10px] px-2 py-0.5 rounded-full border ${c}">${esc(r)}</span>`;
    }).join(" ");

    const stBadge = u.status==="disabled"
      ? `<span class="text-[10px] px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-300">disabled</span>`
      : `<span class="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">active</span>`;

    return `
      <tr class="border-b border-slate-100 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5">
        <td class="px-4 py-3">
          <div class="text-xs font-bold text-slate-900 dark:text-white">${esc(u.display_name||"-")}</div>
          <div class="text-[11px] text-slate-500">${esc(u.email_norm||"-")}</div>
          <div class="text-[10px] text-slate-500">id: <code class="text-slate-400">${esc(u.id||"")}</code></div>
        </td>
        <td class="px-4 py-3">
          <div class="flex flex-wrap gap-1">${roleBadges || `<span class="text-[10px] text-slate-500">-</span>`}</div>
        </td>
        <td class="px-4 py-3">${stBadge}</td>
        <td class="px-4 py-3 text-[11px] text-slate-500">${esc(fmtTs(u.last_login_at))}</td>
        <td class="px-4 py-3 text-right">
          <div class="inline-flex flex-wrap gap-2 justify-end">
            <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-xs" data-act="edit" data-id="${esc(u.id)}"><i class="fa-solid fa-pen me-1"></i>Edit</button>
            <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-xs" data-act="roles" data-id="${esc(u.id)}"><i class="fa-solid fa-user-shield me-1"></i>Roles</button>
            <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-xs" data-act="reset" data-id="${esc(u.id)}"><i class="fa-solid fa-key me-1"></i>Reset PW</button>
            <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-xs" data-act="revoke" data-id="${esc(u.id)}"><i class="fa-solid fa-ban me-1"></i>Revoke</button>
            <button class="px-2 py-1 rounded-lg border border-slate-200 dark:border-darkBorder hover:bg-slate-50 dark:hover:bg-white/5 text-xs ${u.status==="disabled"?"text-emerald-300":"text-red-300"}" data-act="toggle" data-id="${esc(u.id)}">
              <i class="fa-solid ${u.status==="disabled"?"fa-unlock":"fa-lock"} me-1"></i>${u.status==="disabled"?"Enable":"Disable"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function bind(host){
    host.querySelector("#btnReload")?.addEventListener("click", load);

    host.querySelector("#q")?.addEventListener("keydown", (e)=>{
      if(e.key==="Enter"){
        state.q = String(host.querySelector("#q")?.value||"").trim();
        load();
      }
    });

    host.querySelector("#btnSearch")?.addEventListener("click", ()=>{
      state.q = String(host.querySelector("#q")?.value||"").trim();
      load();
    });

    host.querySelector("#limit")?.addEventListener("change", ()=>{
      state.limit = Number(host.querySelector("#limit").value||"50");
      load();
    });

    host.querySelector("#btnCreate")?.addEventListener("click", createUser);

    host.querySelector("#tableWrap")?.addEventListener("click", async (e)=>{
      const btn = e.target.closest("button[data-act]");
      if(!btn) return;
      const id = btn.getAttribute("data-id");
      const actName = btn.getAttribute("data-act");
      const u = state.users.find(x=>x.id===id);
      if(!u) return;

      if(actName==="edit") return editUser(u);
      if(actName==="roles") return setRoles(u);
      if(actName==="reset") return resetPassword(u);
      if(actName==="revoke") return revokeSessions(u);
      if(actName==="toggle") return toggleStatus(u);
    });
  }

  function render(){
    const host = state._host;
    if(!host) return;

    host.innerHTML = `
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div class="text-xl font-bold text-slate-900 dark:text-white">Admin Users</div>
          <div class="text-xs text-slate-500">CRUD user admin/staff/super_admin • source: <code>/api/users/admin</code></div>
        </div>
        <div class="flex gap-2">
          <button id="btnCreate" class="px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-110 transition">
            <i class="fa-solid fa-plus me-1"></i>Create
          </button>
          <button id="btnReload" class="px-3 py-2 rounded-xl border border-slate-200 dark:border-darkBorder text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition">
            <i class="fa-solid fa-rotate me-1"></i>Reload
          </button>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div class="lg:col-span-2 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-3">
          <div class="flex gap-2 items-center">
            <div class="relative flex-1">
              <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
              <input id="q" value="${esc(state.q)}" placeholder="Search email/name..." class="w-full pl-8 pr-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder outline-none">
            </div>
            <button id="btnSearch" class="px-3 py-2 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold">
              Search
            </button>

            <select id="limit" class="px-2 py-2 rounded-lg bg-slate-50 dark:bg-dark border border-slate-200 dark:border-darkBorder text-xs">
              ${[25,50,100,200].map(n=>`<option value="${n}" ${Number(state.limit)===n?"selected":""}>${n}</option>`).join("")}
            </select>
          </div>

          <div class="mt-3 text-xs text-slate-500">
            ${state.loading ? `<i class="fa-solid fa-circle-notch animate-spin me-1"></i>Loading...` : `Total: <b class="text-slate-900 dark:text-white">${state.users.length}</b>`}
            ${state.err ? `<span class="text-red-400 ms-2">Error: ${esc(state.err)}</span>` : ``}
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-3">
          <div class="text-sm font-bold mb-1">Quick Tips</div>
          <ul class="text-xs text-slate-500 space-y-1">
            <li>• Staff hanya akses limited.</li>
            <li>• Admin bisa CRUD admin/staff.</li>
            <li>• Super admin bisa assign super_admin.</li>
            <li>• Revoke sessions untuk force logout.</li>
          </ul>
        </div>
      </div>

      <div id="tableWrap" class="mt-4 rounded-xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs whitespace-nowrap">
            <thead class="bg-slate-50 dark:bg-dark text-slate-500 border-b border-slate-200 dark:border-darkBorder">
              <tr>
                <th class="px-4 py-3 font-semibold">User</th>
                <th class="px-4 py-3 font-semibold">Roles</th>
                <th class="px-4 py-3 font-semibold">Status</th>
                <th class="px-4 py-3 font-semibold">Last Login</th>
                <th class="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-darkBorder">
              ${state.users.map(row).join("") || `
                <tr><td class="px-4 py-6 text-slate-500" colspan="5">
                  ${state.loading ? "Loading..." : "No users."}
                </td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;

    bind(host);
  }

  return {
    title: "Admin Users",
    async mount(host){
      state._host = host;
      host.innerHTML = "";
      render();
      await load();
    }
  };
}
