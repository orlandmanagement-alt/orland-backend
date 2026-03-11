let __orlandThemeMedia = null;
let __orlandThemeListener = null;

export async function prefLoad(Orland, namespace = ""){
  const qs = namespace ? ("?namespace=" + encodeURIComponent(namespace)) : "";
  return await Orland.api("/api/profile/preferences" + qs);
}

export async function prefSave(Orland, namespace, value){
  return await Orland.api("/api/profile/preferences", {
    method: "POST",
    body: JSON.stringify({
      namespace,
      value
    })
  });
}

function getThemeMedia(){
  try{
    if(typeof window !== "undefined" && typeof window.matchMedia === "function"){
      return window.matchMedia("(prefers-color-scheme: dark)");
    }
  }catch{}
  return null;
}

function cleanupThemeListener(){
  if(__orlandThemeMedia && __orlandThemeListener){
    try{
      if(typeof __orlandThemeMedia.removeEventListener === "function"){
        __orlandThemeMedia.removeEventListener("change", __orlandThemeListener);
      }else if(typeof __orlandThemeMedia.removeListener === "function"){
        __orlandThemeMedia.removeListener(__orlandThemeListener);
      }
    }catch{}
  }
  __orlandThemeMedia = null;
  __orlandThemeListener = null;
}

function applyResolvedTheme(root, resolvedMode){
  if(!root) return;
  if(resolvedMode === "dark"){
    root.classList.add("dark");
  }else{
    root.classList.remove("dark");
  }
  root.setAttribute("data-theme-resolved", resolvedMode);
}

export function prefThemeApply(value = {}){
  const mode = ["light","dark","system"].includes(String(value?.mode || ""))
    ? String(value.mode)
    : "system";

  const density = ["compact","comfortable"].includes(String(value?.density || ""))
    ? String(value.density)
    : "comfortable";

  const root = document.documentElement;
  if(!root) return;

  root.setAttribute("data-theme-mode", mode);
  root.setAttribute("data-density", density);

  cleanupThemeListener();

  if(mode === "dark"){
    applyResolvedTheme(root, "dark");
    return;
  }

  if(mode === "light"){
    applyResolvedTheme(root, "light");
    return;
  }

  const media = getThemeMedia();
  const syncFromSystem = ()=>{
    const isDark = !!media?.matches;
    applyResolvedTheme(root, isDark ? "dark" : "light");
  };

  syncFromSystem();

  if(media){
    __orlandThemeMedia = media;
    __orlandThemeListener = ()=>syncFromSystem();

    try{
      if(typeof media.addEventListener === "function"){
        media.addEventListener("change", __orlandThemeListener);
      }else if(typeof media.addListener === "function"){
        media.addListener(__orlandThemeListener);
      }
    }catch{}
  }
}

export function prefTableGetColumnState(prefValue = {}, tableKey = ""){
  const tables = prefValue?.tables || {};
  const t = tables?.[tableKey] || {};
  return {
    hidden_columns: Array.isArray(t.hidden_columns) ? t.hidden_columns : [],
    sort_by: String(t.sort_by || ""),
    sort_dir: ["asc","desc"].includes(String(t.sort_dir || "")) ? String(t.sort_dir) : "asc"
  };
}

export function prefTableSetColumnState(prefValue = {}, tableKey = "", nextState = {}){
  const tables = { ...(prefValue?.tables || {}) };
  tables[tableKey] = {
    hidden_columns: Array.isArray(nextState.hidden_columns) ? nextState.hidden_columns : [],
    sort_by: String(nextState.sort_by || ""),
    sort_dir: ["asc","desc"].includes(String(nextState.sort_dir || "")) ? String(nextState.sort_dir) : "asc"
  };
  return { tables };
}
