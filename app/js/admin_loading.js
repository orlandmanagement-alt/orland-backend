const ADMIN_LOADING_CLASS = "is-loading";

export function setAdminLoading(target, loading = true){
  const el = typeof target === "string"
    ? document.getElementById(target)
    : target;

  if(!el) return;

  if(loading){
    el.dataset.loading = "1";
    el.classList.add(ADMIN_LOADING_CLASS);
    if("disabled" in el) el.disabled = true;
    return;
  }

  delete el.dataset.loading;
  el.classList.remove(ADMIN_LOADING_CLASS);
  if("disabled" in el) el.disabled = false;
}

export async function withAdminLoading(target, fn){
  setAdminLoading(target, true);
  try{
    return await fn();
  } finally {
    setAdminLoading(target, false);
  }
}
