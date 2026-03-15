import { renderAdminNav } from "./admin_nav.js";

function ensureRoot(){
  let root = document.getElementById("adminAppShell");
  if(root) return root;

  document.body.innerHTML = `
    <div id="adminAppShell">
      <header id="adminShellHeader" style="padding:16px;border-bottom:1px solid #ddd;background:#fff;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
          <div>
            <div style="font-size:20px;font-weight:700;" id="adminShellTitle">Orland Admin Monitor</div>
            <div style="margin-top:6px;font-size:14px;">
              Monitoring workspace for project workflow
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <a
              href="/"
              style="text-decoration:none;padding:8px 10px;border:1px solid #ccc;border-radius:8px;background:#fff;color:#111;"
            >Dashboard Home</a>

            <a
              href="/app/pages/admin/projects-monitor.html"
              style="text-decoration:none;padding:8px 10px;border:1px solid #ccc;border-radius:8px;background:#fff;color:#111;"
            >Monitoring</a>
          </div>
        </div>

        <div id="adminShellNotice" style="display:none;margin-top:12px;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:13px;"></div>
      </header>

      <div id="adminShellNavWrap" style="padding:0 16px;"></div>
      <main id="adminShellMain" style="padding:16px;"></main>
    </div>
  `;

  return document.getElementById("adminAppShell");
}

export function mountAdminShell(pageTitle, contentHtml){
  ensureRoot();

  const titleEl = document.getElementById("adminShellTitle");
  if(titleEl){
    titleEl.textContent = pageTitle
      ? `Orland Admin Monitor • ${pageTitle}`
      : "Orland Admin Monitor";
  }

  const navWrap = document.getElementById("adminShellNavWrap");
  if(navWrap){
    navWrap.innerHTML = "";
    navWrap.appendChild(renderAdminNav());
  }

  const main = document.getElementById("adminShellMain");
  if(main){
    main.innerHTML = `
      <section>
        <h1 style="margin-top:0;">${pageTitle || "Admin Monitor"}</h1>
        ${contentHtml || ""}
      </section>
    `;
  }
}
