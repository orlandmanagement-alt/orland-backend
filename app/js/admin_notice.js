function getShellNotice(){
  return document.getElementById("adminShellNotice");
}

export function clearAdminNotice(){
  const el = getShellNotice();
  if(!el) return;
  el.style.display = "none";
  el.textContent = "";
}

export function showAdminNotice(message, kind = "info"){
  const el = getShellNotice();
  if(!el) return;

  el.style.display = "block";
  el.textContent = message || "";

  if(kind === "error"){
    el.style.borderColor = "#e0b4b4";
    el.style.background = "#fff6f6";
    el.style.color = "#9f3a38";
    return;
  }

  if(kind === "success"){
    el.style.borderColor = "#a3d9a5";
    el.style.background = "#f6fff6";
    el.style.color = "#256029";
    return;
  }

  if(kind === "warning"){
    el.style.borderColor = "#ffe69c";
    el.style.background = "#fffdf2";
    el.style.color = "#8a6d3b";
    return;
  }

  el.style.borderColor = "#ddd";
  el.style.background = "#fafafa";
  el.style.color = "#333";
}
