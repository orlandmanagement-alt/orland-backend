export async function fetchNavTree(){
  const r = await fetch("/api/nav", { credentials: "include" });
  let j = null;
  try { j = await r.json(); } catch {}
  if(!r.ok){
    throw new Error(j?.data?.message || j?.status || (r.status + " " + r.statusText));
  }
  return j?.data?.items || [];
}

function esc(v){
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isActivePath(menuPath, currentPath){
  const a = String(menuPath || "").trim();
  const b = String(currentPath || "").trim();
  if(!a || !b) return false;
  if(a === b) return true;
  if(a !== "/" && b.startsWith(a + "/")) return true;
  return false;
}

function hasActiveChild(node, currentPath){
  if(isActivePath(node.path, currentPath)) return true;
  const kids = Array.isArray(node.children) ? node.children : [];
  return kids.some(x => hasActiveChild(x, currentPath));
}

function renderNode(node, currentPath, level = 0){
  const kids = Array.isArray(node.children) ? node.children : [];
  const active = isActivePath(node.path, currentPath);
  const open = hasActiveChild(node, currentPath);
  const hasKids = kids.length > 0;

  const iconHtml = node.icon
    ? `<i class="${esc(node.icon)}" style="width:18px;text-align:center"></i>`
    : `<span style="width:18px;display:inline-block"></span>`;

  const linkCls = [
    "sb-link",
    active ? "is-active" : "",
    hasKids ? "has-kids" : "",
    open ? "is-open" : ""
  ].filter(Boolean).join(" ");

  return `
    <div class="sb-node level-${level}">
      <a href="${esc(node.path || "#")}" class="${linkCls}" data-path="${esc(node.path || "")}">
        <span class="sb-left">
          ${iconHtml}
          <span class="sb-text">${esc(node.label || "-")}</span>
        </span>
        ${hasKids ? `<span class="sb-caret">${open ? "▾" : "▸"}</span>` : ""}
      </a>
      ${hasKids ? `
        <div class="sb-children" style="${open ? "" : "display:none;"}">
          ${kids.map(x => renderNode(x, currentPath, level + 1)).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

export function installSidebarStyles(){
  if(document.getElementById("oa-sidebar-nav-style")) return;
  const s = document.createElement("style");
  s.id = "oa-sidebar-nav-style";
  s.textContent = `
    .sb-wrap{display:grid;gap:8px}
    .sb-node{display:grid;gap:6px}
    .sb-link{
      display:flex;justify-content:space-between;align-items:center;gap:10px;
      text-decoration:none;padding:10px 12px;border-radius:12px;
      color:#111827;background:transparent;border:1px solid transparent;
      font-size:14px;font-weight:700;
    }
    .sb-link:hover{background:#f8fafc;border-color:#e5e7eb}
    .sb-link.is-active{background:#eef2ff;border-color:#c7d2fe;color:#312e81}
    .sb-left{display:flex;align-items:center;gap:10px;min-width:0}
    .sb-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .sb-caret{font-size:12px;color:#6b7280}
    .sb-children{
      display:grid;gap:6px;padding-left:14px;
      border-left:2px solid #e5e7eb;margin-left:10px
    }
    .sb-node.level-1 .sb-link{font-size:13px;font-weight:600}
    .sb-node.level-2 .sb-link{font-size:13px;font-weight:500}
    .sb-loading,.sb-error{
      padding:14px;border:1px dashed #d1d5db;border-radius:12px;
      background:#fafafa;color:#6b7280;font-size:13px
    }
  `;
  document.head.appendChild(s);
}

export async function renderSidebarInto(container){
  installSidebarStyles();
  const el = typeof container === "string" ? document.querySelector(container) : container;
  if(!el) throw new Error("sidebar container not found");

  el.innerHTML = `<div class="sb-loading">Loading menu...</div>`;

  try{
    const items = await fetchNavTree();
    const currentPath = location.pathname;
    el.innerHTML = `<div class="sb-wrap">${items.map(x => renderNode(x, currentPath)).join("")}</div>`;

    el.querySelectorAll(".sb-link.has-kids").forEach(a => {
      a.addEventListener("click", (ev) => {
        const node = a.closest(".sb-node");
        const child = node?.querySelector(":scope > .sb-children");
        if(!child) return;
        if(a.getAttribute("data-path") === location.pathname) return;
        if(a.getAttribute("href") === "#" || a.dataset.toggle === "1"){
          ev.preventDefault();
        }
      });
    });
  }catch(err){
    el.innerHTML = `<div class="sb-error">Failed load menu: ${esc(err.message)}</div>`;
  }
}
