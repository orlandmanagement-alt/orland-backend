export default function(Orland){
  const esc = (s)=>String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));

  async function loadLedger(params = {}){
    const q = new URLSearchParams();
    if(params.event_type) q.set("event_type", params.event_type);
    if(params.item_kind) q.set("item_kind", params.item_kind);
    if(params.item_id) q.set("item_id", params.item_id);
    q.set("limit", String(params.limit || 100));
    return await Orland.api("/api/blogspot/audit_ledger?" + q.toString());
  }

  async function verifyLedger(){
    return await Orland.api("/api/blogspot/audit_verify?limit=2000");
  }

  function fmtTs(v){
    const n = Number(v || 0);
    if(!n) return "-";
    try{ return new Date(n * 1000).toLocaleString("id-ID"); }
    catch{ return String(v); }
  }

  return {
    title:"Blogspot Audit Ledger",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-7xl">
          <div class="rounded-3xl border border-slate-200 p-5">
            <div class="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold">Blogspot Audit Ledger</div>
                <div class="text-sm text-slate-500 mt-1">Immutable audit chain with tamper-evident verification.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border font-black text-sm">Reload</button>
                <button id="btnVerify" class="px-4 py-3 rounded-2xl border border-emerald-200 text-emerald-700 font-black text-sm">Verify Chain</button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><input id="fEvent" class="w-full px-4 py-3 rounded-2xl border" placeholder="event_type"></div>
            <div><input id="fKind" class="w-full px-4 py-3 rounded-2xl border" placeholder="item_kind"></div>
            <div><input id="fItemId" class="w-full px-4 py-3 rounded-2xl border" placeholder="item_id"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 p-5">
            <div class="text-xl font-extrabold">Ledger Entries</div>
            <div id="listBox" class="mt-4 space-y-3"></div>
          </div>

          <div class="rounded-3xl border border-slate-200 p-5">
            <div class="text-xl font-extrabold">Verify Output</div>
            <pre id="rawBox" class="mt-4 text-xs whitespace-pre-wrap break-words bg-slate-50 rounded-2xl p-4">{}</pre>
          </div>
        </div>
      `;

      const q = id => host.querySelector("#" + id);

      function setMsg(kind, text){
        q("msg").className = "mt-4 text-sm";
        if(kind === "error") q("msg").classList.add("text-red-500");
        else if(kind === "success") q("msg").classList.add("text-emerald-600");
        else q("msg").classList.add("text-slate-500");
        q("msg").textContent = text;
      }

      async function render(){
        setMsg("muted", "Loading ledger...");
        const r = await loadLedger({
          event_type: q("fEvent").value.trim(),
          item_kind: q("fKind").value.trim(),
          item_id: q("fItemId").value.trim(),
          limit: 150
        });

        q("rawBox").textContent = JSON.stringify(r, null, 2);

        if(r.status !== "ok"){
          setMsg("error", "Load failed: " + r.status);
          return;
        }

        const items = Array.isArray(r.data?.items) ? r.data.items : [];
        q("listBox").innerHTML = !items.length
          ? `<div class="text-sm text-slate-500">No ledger entries.</div>`
          : items.map(x => `
            <div class="rounded-2xl border border-slate-200 p-4">
              <div class="text-sm font-extrabold">${esc(x.event_type || "-")}</div>
              <div class="text-xs text-slate-500 mt-1">${esc(x.item_kind || "-")} • ${esc(x.item_id || "-")} • ${esc(fmtTs(x.created_at))}</div>
              <div class="text-xs text-slate-400 mt-2">prev_hash</div>
              <pre class="mt-1 text-[11px] whitespace-pre-wrap break-words bg-slate-50 rounded-xl p-2">${esc(x.prev_hash || "")}</pre>
              <div class="text-xs text-slate-400 mt-2">entry_hash</div>
              <pre class="mt-1 text-[11px] whitespace-pre-wrap break-words bg-slate-50 rounded-xl p-2">${esc(x.entry_hash || "")}</pre>
            </div>
          `).join("");

        setMsg("success", "Loaded.");
      }

      q("btnReload").onclick = render;
      q("fEvent").oninput = render;
      q("fKind").oninput = render;
      q("fItemId").oninput = render;

      q("btnVerify").onclick = async ()=>{
        setMsg("muted", "Verifying chain...");
        const r = await verifyLedger();
        q("rawBox").textContent = JSON.stringify(r, null, 2);
        if(r.status !== "ok"){
          setMsg("error", "Verify failed: " + r.status);
          return;
        }
        setMsg(r.data?.ok ? "success" : "error", r.data?.ok ? "Ledger verified." : "Ledger broken.");
      };

      await render();
    }
  };
}
