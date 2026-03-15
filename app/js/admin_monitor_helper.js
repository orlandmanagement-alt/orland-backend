export function getAdminQueryState(formId, searchId, limitId){
  const form = document.getElementById(formId);
  const searchEl = document.getElementById(searchId);
  const limitEl = document.getElementById(limitId);

  return {
    form,
    getSearch(){
      return String(searchEl?.value || "").trim();
    },
    getLimit(){
      const n = Number(limitEl?.value || 20);
      return Math.max(1, Math.min(100, n));
    }
  };
}

export function renderAdminPaging(targetId, paging, onPrev, onNext){
  const el = document.getElementById(targetId);
  if(!el) return;

  const p = paging || {};
  el.innerHTML = "";

  const prev = document.createElement("button");
  prev.type = "button";
  prev.textContent = "Prev";
  prev.disabled = Number(p.offset || 0) <= 0;
  prev.addEventListener("click", onPrev);

  const next = document.createElement("button");
  next.type = "button";
  next.textContent = "Next";
  next.addEventListener("click", onNext);

  const info = document.createElement("span");
  info.textContent = ` offset=${Number(p.offset || 0)} limit=${Number(p.limit || 0)} `;
  info.style.margin = "0 8px";

  el.appendChild(prev);
  el.appendChild(info);
  el.appendChild(next);
}
