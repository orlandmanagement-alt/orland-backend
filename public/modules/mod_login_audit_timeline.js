export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
  const fmt = (v)=>!v ? "-" : new Date(Number(v) * 1000).toLocaleString("id-ID");

  async function loadTimeline(qs, limit){
    const params = new URLSearchParams();
    if(qs) params.set("q", qs);
    if(limit) params.set("limit", String(limit));
    return await Orland.api("/api/security/login-timeline" + (params.toString() ? "?" + params.toString() : ""));
  }

  function tone(action){
    const s = String(action || "");
    if(s.includes("success")) return "emerald";
    if(s.includes("fail") || s.includes("lock") || s.includes("blocked")) return "rose";
    if(s.includes("revoke") || s.includes("logout")) return "amber";
    return "slate";
  }

  return {
    title: "Login Audit Timeline",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-6xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">Login Audit Timeline</div>
                <div class="text-sm text-slate-500 mt-1">Timeline audit untuk login, logout, revoke session, lockout, dan rotate session version.</div>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-1 md:grid-cols-[1fr_160px_auto] gap-3">
              <input id="qSearch" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Cari action / user / meta">
              <input id="qLimit" type="number" min="1" max="200" value="50" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold">
              <button id="btnLoad" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">Load</button>
            </div>

            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div id="timelineBox" class="space-y-3"></div>
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
        const term = String(q("qSearch").value || "").trim();
        const limit = Number(q("qLimit").value || 50);

        setMsg("muted", "Loading timeline...");
        const r = await loadTimeline(term, limit);

        if(r.status !== "ok"){
          q("timelineBox").innerHTML = `<div class="text-sm text-red-500">Load failed: ${esc(r.data?.message || r.status)}</div>`;
          setMsg("error", "Load failed.");
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        if(!items.length){
          q("timelineBox").innerHTML = `<div class="text-sm text-slate-500">No timeline data.</div>`;
          setMsg("success", "Loaded.");
          return;
        }

        q("timelineBox").innerHTML = items.map(x => {
          const t = tone(x.action);
          return `
            <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
              <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-1 rounded-full bg-${t}-100 text-${t}-700 text-[11px] font-black">${esc(x.action)}</span>
                    <span class="text-xs text-slate-400">${esc(fmt(x.created_at))}</span>
                  </div>
                  <div class="mt-3 text-xs text-slate-500 space-y-1">
                    <div><span class="font-bold">actor_user_id:</span> ${esc(x.actor_user_id || "-")}</div>
                    <div><span class="font-bold">route:</span> ${esc(x.route || "-")}</div>
                    <div><span class="font-bold">http_status:</span> ${esc(x.http_status || "-")}</div>
                    <div><span class="font-bold">duration_ms:</span> ${esc(x.duration_ms || "-")}</div>
                    <div><span class="font-bold">target_type:</span> ${esc(x.target_type || "-")}</div>
                    <div><span class="font-bold">target_id:</span> ${esc(x.target_id || "-")}</div>
                  </div>
                </div>
              </div>
              <div class="mt-4">
                <div class="text-xs font-black text-slate-500 mb-2">META</div>
                <pre class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-slate-50 dark:bg-black/20 p-3 text-[11px] overflow-auto">${esc(JSON.stringify(x.meta || {}, null, 2))}</pre>
              </div>
            </div>
          `;
        }).join("");

        setMsg("success", "Loaded.");
      }

      q("btnLoad").onclick = render;
      q("qSearch").addEventListener("keydown", (e)=>{ if(e.key === "Enter") render(); });
      q("qLimit").addEventListener("keydown", (e)=>{ if(e.key === "Enter") render(); });

      await render();
    }
  };
}
