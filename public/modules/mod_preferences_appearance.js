import { prefLoad, prefSave, prefThemeApply } from "../assets/js/user_preferences.js";

export default function(Orland){
  function optionCard({ id, name, desc, icon, checked }){
    return `
      <label class="block cursor-pointer">
        <input class="sr-only prefRadio" type="radio" name="appearanceOption" value="${id}" ${checked ? "checked" : ""}>
        <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5 hover:bg-slate-50 dark:hover:bg-white/5 transition">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <i class="${icon} text-lg"></i>
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-base font-extrabold text-slate-900 dark:text-white">${name}</div>
              <div class="text-sm text-slate-500 mt-1">${desc}</div>
            </div>
          </div>
        </div>
      </label>
    `;
  }

  return {
    title:"Appearance Preferences",
    async mount(host){
      host.innerHTML = `
        <div class="space-y-5 max-w-6xl ui-animated-surface">
          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div class="text-2xl font-extrabold ui-title-gradient">Appearance Preferences</div>
                <div class="text-slate-500 mt-1">Atur theme dan density tampilan per user.</div>
              </div>
              <div class="flex gap-2 flex-wrap">
                <button id="btnReload" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
                  <i class="fa-solid fa-rotate mr-2"></i>Reload
                </button>
                <button id="btnSave" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
                  <i class="fa-solid fa-floppy-disk mr-2"></i>Save
                </button>
              </div>
            </div>
            <div id="msg" class="mt-4 text-sm text-slate-500"></div>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 ui-gap-grid">
            <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold ui-title-gradient">Theme Mode</div>
              <div class="text-sm text-slate-500 mt-1">Pilih tampilan light, dark, atau mengikuti system.</div>
              <div id="themeBox" class="mt-5 grid grid-cols-1 gap-3"></div>
            </div>

            <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
              <div class="text-xl font-extrabold ui-title-gradient">Density</div>
              <div class="text-sm text-slate-500 mt-1">Atur kepadatan tampilan interface.</div>
              <div id="densityBox" class="mt-5 grid grid-cols-1 gap-3"></div>
            </div>
          </div>

          <div class="ui-panel ui-pad-panel rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-5">
            <div class="text-xl font-extrabold ui-title-gradient">Preview State</div>
            <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-xs font-black text-slate-500">Applied Theme</div>
                <div id="previewTheme" class="text-lg font-extrabold mt-2">-</div>
              </div>
              <div class="rounded-2xl border border-slate-200 dark:border-darkBorder p-4">
                <div class="text-xs font-black text-slate-500">Applied Density</div>
                <div id="previewDensity" class="text-lg font-extrabold mt-2">-</div>
              </div>
            </div>
          </div>
        </div>
      `;

      const q = (id)=>host.querySelector("#" + id);
      let current = {
        mode: "system",
        density: "comfortable"
      };

      function fill(v = {}){
        current = {
          mode: ["light","dark","system"].includes(String(v.mode || "")) ? String(v.mode) : "system",
          density: ["compact","comfortable"].includes(String(v.density || "")) ? String(v.density) : "comfortable"
        };

        q("themeBox").innerHTML = [
          optionCard({
            id: "system",
            name: "System",
            desc: "Mengikuti theme sistem atau browser user.",
            icon: "fa-solid fa-desktop",
            checked: current.mode === "system"
          }),
          optionCard({
            id: "light",
            name: "Light",
            desc: "Mode terang untuk tampilan standar.",
            icon: "fa-solid fa-sun",
            checked: current.mode === "light"
          }),
          optionCard({
            id: "dark",
            name: "Dark",
            desc: "Mode gelap untuk kenyamanan visual.",
            icon: "fa-solid fa-moon",
            checked: current.mode === "dark"
          })
        ].join("");

        q("densityBox").innerHTML = [
          optionCard({
            id: "comfortable",
            name: "Comfortable",
            desc: "Jarak antar elemen lebih lega dan nyaman.",
            icon: "fa-solid fa-table-cells-large",
            checked: current.density === "comfortable"
          }),
          optionCard({
            id: "compact",
            name: "Compact",
            desc: "Tampilan lebih rapat untuk informasi lebih padat.",
            icon: "fa-solid fa-table-cells",
            checked: current.density === "compact"
          })
        ].join("");

        bindPreview();
        applyPreview();
      }

      function read(){
        const mode = host.querySelector('input[name="appearanceOption"][value="light"]:checked')
          ? "light"
          : host.querySelector('input[name="appearanceOption"][value="dark"]:checked')
          ? "dark"
          : "system";

        const density = host.querySelector('input[name="appearanceOption"][value="compact"]:checked')
          ? "compact"
          : "comfortable";

        return { mode, density };
      }

      function bindPreview(){
        q("themeBox").querySelectorAll(".prefRadio").forEach(x=>{
          x.addEventListener("change", applyPreview);
        });
        q("densityBox").querySelectorAll(".prefRadio").forEach(x=>{
          x.addEventListener("change", applyPreview);
        });
      }

      function applyPreview(){
        const v = read();
        prefThemeApply(v);
        q("previewTheme").textContent = v.mode;
        q("previewDensity").textContent = v.density;
      }

      async function load(){
        q("msg").className = "mt-4 text-sm text-slate-500";
        q("msg").textContent = "Loading...";

        const r = await prefLoad(Orland, "theme");
        if(r.status !== "ok"){
          q("msg").className = "mt-4 text-sm text-red-500";
          q("msg").textContent = "Load failed: " + r.status;
          fill({});
          return;
        }

        fill(r.data?.value || {});
        q("msg").className = "mt-4 text-sm text-emerald-600";
        q("msg").textContent = "Loaded.";
      }

      q("btnReload").onclick = load;

      q("btnSave").onclick = async ()=>{
        const value = read();

        q("msg").className = "mt-4 text-sm text-slate-500";
        q("msg").textContent = "Saving...";

        const r = await prefSave(Orland, "theme", value);
        if(r.status !== "ok"){
          q("msg").className = "mt-4 text-sm text-red-500";
          q("msg").textContent = "Save failed: " + (r.data?.message || r.status);
          return;
        }

        try{ localStorage.setItem("orland_user_pref_theme_boot_v1", JSON.stringify(r.data?.value || value)); }catch(_){}
        prefThemeApply(r.data?.value || value);
        q("msg").className = "mt-4 text-sm text-emerald-600";
        q("msg").textContent = "Saved.";
      };

      await load();
    }
  };
}
