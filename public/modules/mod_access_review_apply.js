export default function(Orland){
  async function loadReviews(){
    return await Orland.api("/api/access/reviews");
  }
  async function applyReview(id){
    return await Orland.api("/api/access/reviews-apply", {
      method: "POST",
      body: JSON.stringify({ id })
    });
  }

  return {
    title:"Access Review Apply",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">Access Review Apply</div>
            <div class="text-sm text-slate-500 mt-1">Apply workflow untuk review access yang sudah approved.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>
          <div id="box" class="space-y-3"></div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function render(){
        setMsg("muted", "Loading approved reviews...");
        const r = await loadReviews();
        if(r.status !== "ok"){
          setMsg("error", "Load failed.");
          return;
        }

        const items = (Array.isArray(r.data?.items) ? r.data.items : [])
          .filter(x => String(x.status) === "approved");

        q("box").innerHTML = items.length ? items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="font-black text-sm">${x.title || "Approved Review"}</div>
                <div class="text-xs text-slate-500 mt-1">${x.id}</div>
              </div>
              <div class="px-2 py-1 rounded-full ${x.applied_at ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"} text-[11px] font-black">${x.applied_at ? "applied" : "ready to apply"}</div>
            </div>
            <div class="mt-3 text-sm text-slate-500 space-y-1">
              <div>target_user_id: ${x.target_user_id || "-"}</div>
              <div>target_role_id: ${x.target_role_id || "-"}</div>
              <div>requested_change: ${x.details?.requested_change || "-"}</div>
            </div>
            ${x.applied_at ? `
              <div class="mt-3 text-xs text-emerald-600 font-semibold">Applied by ${x.applied_by || "-"} at ${x.applied_at}</div>
            ` : `
              <div class="mt-4 flex gap-2 flex-wrap">
                <button class="btnApply px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-black" data-id="${x.id}">Apply Review</button>
              </div>
            `}
          </div>
        `).join("") : `<div class="text-sm text-slate-500">No approved reviews.</div>`;

        q("box").querySelectorAll(".btnApply").forEach(btn => {
          btn.onclick = async ()=>{
            setMsg("muted", "Applying review...");
            const rr = await applyReview(btn.getAttribute("data-id"));
            if(rr.status !== "ok"){
              setMsg("error", "Apply failed: " + (rr.data?.message || rr.status));
              return;
            }
            setMsg("success", "Review applied.");
            await render();
          };
        });

        if(items.length) setMsg("success", "Loaded.");
      }

      await render();
    }
  };
}
