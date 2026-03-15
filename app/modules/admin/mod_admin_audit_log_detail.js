import { getJson } from "../../js/admin_security_helper.js";

function getQuery(name){
  return new URL(location.href).searchParams.get(name) || "";
}

export default async function(){
  const info = document.getElementById("auditLogDetailInfo");
  const box = document.getElementById("auditLogDetailBox");
  const id = String(getQuery("id") || "").trim();

  if(!id){
    if(info) info.textContent = "Audit log id is missing.";
    return;
  }

  const res = await getJson(`/functions/api/admin/audit_log_detail_get?id=${encodeURIComponent(id)}`);
  if(res.status !== "ok"){
    if(info) info.textContent = "Failed to load audit log detail.";
    return;
  }

  if(box){
    box.textContent = JSON.stringify(res.data || {}, null, 2);
  }

  if(info) info.textContent = "Audit log detail loaded.";
}
