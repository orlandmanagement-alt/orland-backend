export default function(Orland){
  async function loadReviews(){
    return await Orland.api("/api/access/reviews");
  }
  async function submitReview(payload){
    return await Orland.api("/api/access/reviews", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }

  return {
    title:"Access Review Approval",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-2xl font-extrabold">Access Review Approval</div>
            <div class="text-sm text-slate-500 mt-1">Ajukan dan review perubahan akses sensitif dengan status pending/approved/rejected.</div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <form id="form" class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4 space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input name="title" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Title">
              <input name="target_user_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Target User ID">
            </div>
            <input name="target_role_id" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold" placeholder="Target Role ID">
            <textarea name="details_json" rows="5" class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-mono" placeholder='{"requested_change":"assign_role","note":"Need ops access"}'></textarea>
            <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Submit Review</button>
          </form>

          <div id="box" class="space-y-3"></div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      const form = q("form");

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function render(){
        const r = await loadReviews();
        if(r.status !== "ok"){
          setMsg("error", "Load failed.");
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        q("box").innerHTML = items.length ? items.map(x => `
          <div class="rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="font-black text-sm">${x.title || "Access Review"}</div>
                <div class="text-xs text-slate-500 mt-1">${x.id}</div>
              </div>
              <div class="px-2 py-1 rounded-full ${x.status === "approved" ? "bg-emerald-100 text-emerald-700" : (x.status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")} text-[11px] font-black">${x.status}</div>
            </div>
            <div class="mt-3 text-sm text-slate-500 space-y-1">
              <div>target_user_id: ${x.target_user_id || "-"}</div>
              <div>target_role_id: ${x.target_role_id || "-"}</div>
            </div>
            ${x.status === "pending" ? `
              <div class="mt-4 flex gap-2 flex-wrap">
                <button class="btnApprove px-3 py-2 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-black" data-id="${x.id}">Approve</button>
                <button class="btnReject px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-black" data-id="${x.id}">Reject</button>
              </div>
            ` : ``}
          </div>
        `).join("") : `<div class="text-sm text-slate-500">No reviews.</div>`;

        q("box").querySelectorAll(".btnApprove").forEach(btn => {
          btn.onclick = async ()=>{
            setMsg("muted", "Approving...");
            const rr = await submitReview({ action:"approve", id: btn.getAttribute("data-id") });
            if(rr.status !== "ok"){
              setMsg("error", "Approve failed.");
              return;
            }
            setMsg("success", "Approved.");
            await render();
          };
        });

        q("box").querySelectorAll(".btnReject").forEach(btn => {
          btn.onclick = async ()=>{
            setMsg("muted", "Rejecting...");
            const rr = await submitReview({ action:"reject", id: btn.getAttribute("data-id") });
            if(rr.status !== "ok"){
              setMsg("error", "Reject failed.");
              return;
            }
            setMsg("success", "Rejected.");
            await render();
          };
        });
      }

      form.onsubmit = async (ev)=>{
        ev.preventDefault();
        let details = {};
        try{
          details = form.details_json.value.trim() ? JSON.parse(form.details_json.value) : {};
        }catch{
          setMsg("error", "details_json invalid.");
          return;
        }

        setMsg("muted", "Submitting review...");
        const r = await submitReview({
          action: "submit",
          review_type: "access_change",
          title: form.title.value.trim(),
          target_user_id: form.target_user_id.value.trim(),
          target_role_id: form.target_role_id.value.trim(),
          details
        });

        if(r.status !== "ok"){
          setMsg("error", "Submit failed.");
          return;
        }

        form.reset();
        setMsg("success", "Review submitted.");
        await render();
      };

      await render();
    }
  };
}
