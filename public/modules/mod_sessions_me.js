export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
  const fmt = (v)=>!v ? "-" : new Date(Number(v) * 1000).toLocaleString("id-ID");

  async function loadSessions(){
    return await Orland.api("/api/sessions/me");
  }
  async function revokeOne(sid){
    return await Orland.api("/api/sessions/revoke", {
      method:"POST",
      body: JSON.stringify({ sid })
    });
  }
  async function revokeAll(include_current = false){
    return await Orland.api("/api/sessions/revoke-all", {
      method:"POST",
      body: JSON.stringify({ include_current })
    });
  }

  return {
    title:"My Sessions",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-6xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">Current User Session Inspector</div>
                <div class="text-sm text-slate-500 mt-1">Lihat dan kelola session akun sendiri.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">Reload</button>
                <button id="btnRevokeOthers" class="px-4 py-3 rounded-2xl border border-amber-200 text-amber-700 font-black text-sm">Logout Other Sessions</button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div id="sessionBox" class="space-y-3"></div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else if(kind === "warning") q("msg").classList.add("text-amber-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function render(){
        setMsg("muted", "Loading sessions...");
        const r = await loadSessions();
        if(r.status !== "ok"){
          q("sessionBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        if(!items.length){
          q("sessionBox").innerHTML = `<div class="text-sm text-slate-500">No sessions.</div>`;
          setMsg("success", "Loaded.");
          return;
        }

        q("sessionBox").innerHTML = items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <div class="font-black text-sm">${x.current_session ? "Current Session" : "Session"}</div>
                  ${x.current_session ? `<span class="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-black">current</span>` : ``}
                  ${x.revoked_at ? `<span class="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-[11px] font-black">revoked</span>` : `<span class="px-2 py-1 rounded-full bg-sky-100 text-sky-700 text-[11px] font-black">active</span>`}
                </div>
                <div class="mt-2 text-xs text-slate-500 space-y-1">
                  <div>sid: ${esc(x.id)}</div>
                  <div>created: ${esc(fmt(x.created_at))}</div>
                  <div>expires: ${esc(fmt(x.expires_at))}</div>
                  <div>last seen: ${esc(fmt(x.last_seen_at))}</div>
                  <div>session version: ${esc(x.session_version)}</div>
                </div>
              </div>
              <div class="shrink-0">
                ${!x.revoked_at ? `<button class="btnRevokeOne px-3 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs font-black" data-sid="${esc(x.id)}" ${x.current_session ? "disabled" : ""}>Logout</button>` : ``}
              </div>
            </div>
          </div>
        `).join("");

        q("sessionBox").querySelectorAll(".btnRevokeOne").forEach(btn => {
          btn.onclick = async ()=>{
            const sid = String(btn.getAttribute("data-sid") || "");
            setMsg("muted", "Revoking session...");
            const rr = await revokeOne(sid);
            if(rr.status !== "ok"){
              setMsg("error", "Revoke failed: " + (rr.data?.message || rr.status));
              return;
            }
            setMsg("success", "Session revoked.");
            await render();
          };
        });

        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("btnRevokeOthers").onclick = async ()=>{
        setMsg("muted", "Logging out other sessions...");
        const r = await revokeAll(false);
        if(r.status !== "ok"){
          setMsg("error", "Failed: " + (r.data?.message || r.status));
          return;
        }
        setMsg("success", "Other sessions revoked.");
        await render();
      };

      await render();
    }
  };
}
