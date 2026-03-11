export function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

export function fmtNum(n){
  try{ return new Intl.NumberFormat("id-ID").format(Number(n || 0)); }
  catch{ return String(n || 0); }
}

export function fmtTs(v){
  const n = Number(v || 0);
  if(!n) return "-";
  try{ return new Date(n * 1000).toLocaleString("id-ID"); }
  catch{ return String(v); }
}

export function emptyState(text = "No data."){
  return `<div class="text-sm text-slate-500">${esc(text)}</div>`;
}

export function setMsg(root, selector, kind, text){
  const el = typeof selector === "string" ? root.querySelector(selector) : selector;
  if(!el) return;

  el.className = "text-sm";
  if(kind === "error") el.classList.add("text-red-500");
  else if(kind === "success") el.classList.add("text-emerald-600");
  else if(kind === "warning") el.classList.add("text-amber-600");
  else el.classList.add("text-slate-500");

  el.textContent = text;
}

export function badgeState(value, map = {}, fallback = "slate"){
  const v = String(value || "").toLowerCase();
  const tone = map[v] || fallback;

  const toneMap = {
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    orange: "bg-orange-100 text-orange-700",
    emerald: "bg-emerald-100 text-emerald-700",
    sky: "bg-sky-100 text-sky-700",
    slate: "bg-slate-100 text-slate-700"
  };

  return `<span class="px-3 py-1 rounded-full ${toneMap[tone] || toneMap.slate} text-xs font-black">${esc(v || "-")}</span>`;
}

export function openModal(root, opts = {}){
  const backdrop = root.querySelector(opts.backdrop || "#modalBackdrop");
  const title = root.querySelector(opts.title || "#modalTitle");
  const body = root.querySelector(opts.body || "#modalBody");

  if(title && opts.modalTitle != null) title.textContent = opts.modalTitle;
  if(body && opts.modalBody != null) body.innerHTML = opts.modalBody;
  backdrop?.classList.remove("hidden");
}

export function closeModal(root, opts = {}){
  const backdrop = root.querySelector(opts.backdrop || "#modalBackdrop");
  const body = root.querySelector(opts.body || "#modalBody");
  backdrop?.classList.add("hidden");
  if(body) body.innerHTML = "";
}

export function openConfirm(root, opts = {}){
  const title = root.querySelector(opts.title || "#confirmTitle");
  const desc = root.querySelector(opts.desc || "#confirmDesc");
  const meta = root.querySelector(opts.meta || "#confirmMeta");
  const backdrop = root.querySelector(opts.backdrop || "#confirmBackdrop");

  if(title) title.textContent = opts.confirmTitle || "Confirm";
  if(desc) desc.textContent = opts.confirmDesc || "";
  if(meta) meta.innerHTML = opts.confirmMeta || "-";
  backdrop?.classList.remove("hidden");
}

export function closeConfirm(root, opts = {}){
  const meta = root.querySelector(opts.meta || "#confirmMeta");
  const backdrop = root.querySelector(opts.backdrop || "#confirmBackdrop");
  if(meta) meta.innerHTML = "";
  backdrop?.classList.add("hidden");
}
