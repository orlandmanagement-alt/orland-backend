export function cmeEsc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

export function cmeModalShell({
  title = "Form",
  subtitle = "Create / edit data",
  bodyHtml = "",
  footerHtml = "",
  size = "xl"
} = {}){
  const maxw =
    size === "sm" ? "max-w-lg" :
    size === "md" ? "max-w-2xl" :
    size === "lg" ? "max-w-4xl" :
    "max-w-6xl";

  return `
    <div id="cmeBackdrop" class="fixed inset-0 z-[160] bg-slate-950/60 backdrop-blur-[2px] p-3 lg:p-6 overflow-auto">
      <div class="min-h-full flex items-start lg:items-center justify-center">
        <div class="cme-shell ${maxw} w-full rounded-3xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter shadow-2xl">
          <div class="cme-head px-4 lg:px-6 py-4 border-b border-slate-200 dark:border-darkBorder flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xl lg:text-2xl font-extrabold ui-title-gradient">${cmeEsc(title)}</div>
              <div class="text-sm text-slate-500 mt-1">${cmeEsc(subtitle)}</div>
            </div>
            <button id="cmeBtnClose" type="button" class="cme-icon-btn w-11 h-11 rounded-2xl border border-slate-200 dark:border-darkBorder">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div id="cmeBody" class="cme-body p-4 lg:p-6">
            ${bodyHtml}
          </div>

          <div id="cmeFooter" class="cme-footer px-4 lg:px-6 py-4 border-t border-slate-200 dark:border-darkBorder">
            ${footerHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function cmeFormLayout(innerHtml = ""){
  return `
    <form id="cmeForm" class="space-y-5">
      ${innerHtml}
    </form>
  `;
}

export function cmeGrid(innerHtml = "", cols = "2"){
  const cls =
    cols === "1" ? "grid grid-cols-1 gap-4 ui-gap-grid" :
    cols === "3" ? "grid grid-cols-1 xl:grid-cols-3 gap-4 ui-gap-grid" :
    "grid grid-cols-1 xl:grid-cols-2 gap-4 ui-gap-grid";

  return `<div class="${cls}">${innerHtml}</div>`;
}

export function cmeSection({
  title = "",
  desc = "",
  bodyHtml = ""
} = {}){
  return `
    <div class="ui-card ui-pad-card rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-darkLighter p-4">
      ${title ? `<div class="text-base font-extrabold">${cmeEsc(title)}</div>` : ``}
      ${desc ? `<div class="text-sm text-slate-500 mt-1">${cmeEsc(desc)}</div>` : ``}
      <div class="${title || desc ? "mt-4" : ""} space-y-4">
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function cmeField({
  label = "",
  name = "",
  type = "text",
  value = "",
  placeholder = "",
  hint = "",
  readonly = false,
  required = false,
  textarea = false,
  rows = 5
} = {}){
  return `
    <div class="cme-field">
      ${label ? `<label class="block text-sm font-bold text-slate-500 mb-2">${cmeEsc(label)}${required ? ` <span class="text-red-500">*</span>` : ``}</label>` : ``}
      ${
        textarea
          ? `<textarea
               name="${cmeEsc(name)}"
               rows="${Number(rows || 5)}"
               placeholder="${cmeEsc(placeholder)}"
               ${readonly ? "readonly" : ""}
               class="cme-input w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold"
             >${cmeEsc(value)}</textarea>`
          : `<input
               type="${cmeEsc(type)}"
               name="${cmeEsc(name)}"
               value="${cmeEsc(value)}"
               placeholder="${cmeEsc(placeholder)}"
               ${readonly ? "readonly" : ""}
               ${required ? "required" : ""}
               class="cme-input w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold"
             >`
      }
      ${hint ? `<div class="text-xs text-slate-500 mt-2">${cmeEsc(hint)}</div>` : ``}
      <div class="cme-error text-xs text-red-500 mt-2 hidden" data-error-for="${cmeEsc(name)}"></div>
    </div>
  `;
}

export function cmeSelect({
  label = "",
  name = "",
  value = "",
  options = [],
  hint = ""
} = {}){
  return `
    <div class="cme-field">
      ${label ? `<label class="block text-sm font-bold text-slate-500 mb-2">${cmeEsc(label)}</label>` : ``}
      <select
        name="${cmeEsc(name)}"
        class="cme-input w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold"
      >
        ${options.map(opt => `
          <option value="${cmeEsc(opt.value)}" ${String(opt.value) === String(value) ? "selected" : ""}>
            ${cmeEsc(opt.label)}
          </option>
        `).join("")}
      </select>
      ${hint ? `<div class="text-xs text-slate-500 mt-2">${cmeEsc(hint)}</div>` : ``}
      <div class="cme-error text-xs text-red-500 mt-2 hidden" data-error-for="${cmeEsc(name)}"></div>
    </div>
  `;
}

export function cmeCheckbox({
  label = "",
  name = "",
  checked = false,
  desc = ""
} = {}){
  return `
    <label class="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-darkBorder p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5">
      <input type="checkbox" name="${cmeEsc(name)}" ${checked ? "checked" : ""} class="mt-1 rounded">
      <div class="min-w-0">
        <div class="text-sm font-black">${cmeEsc(label)}</div>
        ${desc ? `<div class="text-xs text-slate-500 mt-1">${cmeEsc(desc)}</div>` : ``}
      </div>
    </label>
  `;
}

export function cmeFooterActions({
  saveLabel = "Save",
  cancelLabel = "Cancel",
  extraHtml = "",
  destructiveHtml = ""
} = {}){
  return `
    <div class="cme-footer-actions flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 flex-wrap">
        ${destructiveHtml || ``}
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        ${extraHtml || ``}
        <button id="cmeBtnCancel" type="button" class="px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder font-black text-sm">
          ${cmeEsc(cancelLabel)}
        </button>
        <button id="cmeBtnSave" type="submit" form="cmeForm" class="px-4 py-3 rounded-2xl bg-primary text-white font-black text-sm">
          <i class="fa-solid fa-floppy-disk mr-2"></i>${cmeEsc(saveLabel)}
        </button>
      </div>
    </div>
  `;
}

export function cmeOpen(host, html){
  host.insertAdjacentHTML("beforeend", html);
  const modal = host.querySelector("#cmeBackdrop");
  const closeBtn = host.querySelector("#cmeBtnClose");
  const cancelBtn = host.querySelector("#cmeBtnCancel");

  function close(){
    modal?.remove();
  }

  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  modal?.addEventListener("click", (e)=>{
    if(e.target === modal) close();
  });

  return { close, modal };
}

export function cmeSetErrors(host, errors = {}){
  host.querySelectorAll(".cme-error").forEach(el => {
    el.classList.add("hidden");
    el.textContent = "";
  });

  for(const [name, message] of Object.entries(errors || {})){
    const el = host.querySelector(`[data-error-for="${CSS.escape(String(name))}"]`);
    if(el){
      el.textContent = String(message || "");
      el.classList.remove("hidden");
    }
  }
}

export function cmeReadForm(form){
  const fd = new FormData(form);
  const out = {};

  for(const [k, v] of fd.entries()){
    if(Object.prototype.hasOwnProperty.call(out, k)){
      if(Array.isArray(out[k])) out[k].push(v);
      else out[k] = [out[k], v];
    }else{
      out[k] = v;
    }
  }

  form.querySelectorAll('input[type="checkbox"]').forEach(ch => {
    out[ch.name] = !!ch.checked;
  });

  return out;
}
