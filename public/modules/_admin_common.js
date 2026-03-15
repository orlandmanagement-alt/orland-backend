export function esc(v){
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ensureBaseStyles(){
  if(document.getElementById("oa-admin-common-style")) return;
  const s = document.createElement("style");
  s.id = "oa-admin-common-style";
  s.textContent = `
    .oa-wrap{padding:16px;font-family:Inter,Arial,sans-serif}
    .oa-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}
    .oa-title{font-size:22px;font-weight:700;margin:0}
    .oa-tools{display:flex;gap:8px;flex-wrap:wrap}
    .oa-btn{border:1px solid #d0d7de;background:#111827;color:#fff;padding:8px 12px;border-radius:10px;cursor:pointer}
    .oa-btn.alt{background:#fff;color:#111827}
    .oa-btn.warn{background:#b91c1c}
    .oa-input,.oa-select,.oa-textarea{border:1px solid #d0d7de;padding:10px 12px;border-radius:12px;min-width:180px;width:100%;box-sizing:border-box;background:#fff;color:#111827}
    .oa-textarea{min-height:96px;resize:vertical}
    .oa-card{border:1px solid #e5e7eb;border-radius:16px;padding:14px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.04)}
    .oa-grid{display:grid;gap:12px}
    .oa-grid.cols-2{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
    .oa-grid.cols-3{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
    .oa-stat{font-size:13px;color:#6b7280}
    .oa-stat b{display:block;color:#111827;font-size:20px;margin-top:4px}
    .oa-table{width:100%;border-collapse:collapse}
    .oa-table th,.oa-table td{padding:10px 8px;border-bottom:1px solid #eef2f7;text-align:left;font-size:14px;vertical-align:top}
    .oa-badge{display:inline-block;padding:4px 8px;border-radius:999px;font-size:12px;border:1px solid #d1d5db;background:#f9fafb}
    .oa-muted{color:#6b7280}
    .oa-actions{display:flex;gap:6px;flex-wrap:wrap}
    .oa-col{background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;padding:12px}
    .oa-col h3{margin:0 0 10px 0;font-size:16px}
    .oa-item{border:1px solid #e5e7eb;background:#fff;border-radius:12px;padding:10px;margin-bottom:8px}
    .oa-empty{padding:18px;text-align:center;color:#6b7280;border:1px dashed #d1d5db;border-radius:14px;background:#fafafa}
    .oa-form-group{display:flex;flex-direction:column;gap:6px}
    .oa-form-label{font-size:12px;font-weight:700;color:#6b7280}
    .oa-modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:flex-end;justify-content:center;z-index:9999;padding:0}
    .oa-modal{width:100%;max-width:720px;background:#fff;border-radius:18px 18px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.18);max-height:92vh;overflow:auto}
    .oa-modal-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #eef2f7;position:sticky;top:0;background:#fff;z-index:2}
    .oa-modal-title{font-size:18px;font-weight:700;margin:0}
    .oa-modal-body{padding:16px}
    .oa-modal-foot{display:flex;gap:8px;justify-content:flex-end;padding:14px 16px;border-top:1px solid #eef2f7;position:sticky;bottom:0;background:#fff}
    .oa-close{border:1px solid #d0d7de;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer}
    @media (min-width: 768px){
      .oa-modal-backdrop{align-items:center;padding:20px}
      .oa-modal{border-radius:18px;max-height:90vh}
    }
  `;
  document.head.appendChild(s);
}

export async function api(url, opt = {}){
  const init = { credentials: "include", ...opt };
  const headers = { ...(opt.headers || {}) };
  if(init.body && typeof init.body !== "string" && !headers["content-type"]){
    headers["content-type"] = "application/json";
  }
  if(init.body && typeof init.body !== "string"){
    init.body = JSON.stringify(init.body);
  }
  init.headers = headers;

  const r = await fetch(url, init);
  let j = null;
  try { j = await r.json(); } catch {}

  if(!r.ok){
    throw new Error(j?.data?.message || j?.status || (r.status + " " + r.statusText));
  }

  return j?.data ?? {};
}

export function mountNode(root){
  if(root && root.nodeType === 1) return root;
  if(typeof root === "string"){
    const el = document.querySelector(root);
    if(el) return el;
  }
  return document.getElementById("module-host") || document.getElementById("app") || document.body;
}

export function statusBadge(v){
  const s = String(v || "").trim().toLowerCase();
  return '<span class="oa-badge">' + esc(s || "-") + '</span>';
}

export function fmtDate(sec){
  const n = Number(sec || 0);
  if(!n) return "-";
  try{
    return new Date(n * 1000).toLocaleString();
  }catch{
    return String(n);
  }
}

export function promptRequired(label, defv = ""){
  const v = prompt(label, defv);
  if(v == null) return null;
  return String(v).trim();
}

export function openModal(opts = {}){
  ensureBaseStyles();

  const backdrop = document.createElement("div");
  backdrop.className = "oa-modal-backdrop";
  backdrop.innerHTML = `
    <div class="oa-modal" role="dialog" aria-modal="true">
      <div class="oa-modal-head">
        <h3 class="oa-modal-title">${esc(opts.title || "Modal")}</h3>
        <button class="oa-close" type="button">Tutup</button>
      </div>
      <div class="oa-modal-body"></div>
      <div class="oa-modal-foot"></div>
    </div>
  `;

  const body = backdrop.querySelector(".oa-modal-body");
  const foot = backdrop.querySelector(".oa-modal-foot");
  body.innerHTML = opts.bodyHtml || "";
  foot.innerHTML = opts.footerHtml || "";

  function close(){
    backdrop.remove();
    if(typeof opts.onClose === "function") opts.onClose();
  }

  backdrop.addEventListener("click", (e)=>{
    if(e.target === backdrop) close();
  });

  backdrop.querySelector(".oa-close").onclick = close;
  document.body.appendChild(backdrop);

  return {
    el: backdrop,
    body,
    foot,
    close
  };
}
