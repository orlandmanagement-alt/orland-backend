import { ADMIN_ROUTES, findAdminRouteByPath } from "./admin_routes.js";

function ensureNavRoot(){
  let root = document.getElementById("adminPortalNav");
  if(root) return root;

  root = document.createElement("nav");
  root.id = "adminPortalNav";
  root.style.margin = "16px 0";
  root.style.padding = "12px";
  root.style.border = "1px solid #ddd";
  root.style.background = "#fafafa";
  return root;
}

function createLink(item, active){
  const a = document.createElement("a");
  a.href = item.href;
  a.textContent = item.label;
  a.style.display = "inline-block";
  a.style.marginRight = "12px";
  a.style.marginBottom = "8px";
  a.style.textDecoration = "none";
  a.style.padding = "6px 10px";
  a.style.border = "1px solid #ccc";
  a.style.borderRadius = "8px";
  a.style.color = "#111";
  a.style.background = active ? "#e9eefc" : "#fff";
  a.style.fontWeight = active ? "700" : "500";
  return a;
}

export function renderAdminNav(){
  const root = ensureNavRoot();
  root.innerHTML = "";

  const title = document.createElement("div");
  title.textContent = "Admin Monitoring Navigation";
  title.style.fontWeight = "700";
  title.style.marginBottom = "10px";
  root.appendChild(title);

  const current = findAdminRouteByPath(location.pathname);

  ADMIN_ROUTES.forEach(item => {
    const active = current && current.key === item.key;
    root.appendChild(createLink(item, active));
  });

  return root;
}
