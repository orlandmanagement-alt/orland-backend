(function(){
  try{
    var PREF_KEY = "orland_user_pref_theme_boot_v1";
    var LEGACY_THEME_NS = "orland_theme_pref_v1";

    function readJson(key, fallback){
      try{
        var raw = localStorage.getItem(key);
        if(!raw) return fallback;
        var val = JSON.parse(raw);
        return val == null ? fallback : val;
      }catch(_e){
        return fallback;
      }
    }

    function getThemePref(){
      var v = readJson(PREF_KEY, null);

      if(v && typeof v === "object"){
        return {
          mode: ["light","dark","system"].indexOf(String(v.mode || "")) >= 0 ? String(v.mode) : "system",
          density: ["compact","comfortable"].indexOf(String(v.density || "")) >= 0 ? String(v.density) : "comfortable"
        };
      }

      var legacy = readJson(LEGACY_THEME_NS, null);
      if(legacy && typeof legacy === "object"){
        return {
          mode: ["light","dark","system"].indexOf(String(legacy.mode || "")) >= 0 ? String(legacy.mode) : "system",
          density: ["compact","comfortable"].indexOf(String(legacy.density || "")) >= 0 ? String(legacy.density) : "comfortable"
        };
      }

      return {
        mode: "system",
        density: "comfortable"
      };
    }

    function resolveMode(mode){
      if(mode === "dark") return "dark";
      if(mode === "light") return "light";

      try{
        if(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches){
          return "dark";
        }
      }catch(_e){}

      return "light";
    }

    var pref = getThemePref();
    var root = document.documentElement;
    var resolved = resolveMode(pref.mode);

    root.setAttribute("data-theme-mode", pref.mode);
    root.setAttribute("data-theme-resolved", resolved);
    root.setAttribute("data-density", pref.density);

    if(resolved === "dark"){
      root.classList.add("dark");
    }else{
      root.classList.remove("dark");
    }
  }catch(_err){}
})();
