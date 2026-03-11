export function fveEsc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

export function fveRules(){
  return {
    required(label = "Field"){
      return (value)=>{
        const ok = !(value == null || String(value).trim() === "");
        return ok ? "" : (label + " wajib diisi.");
      };
    },

    minLen(label = "Field", min = 1){
      return (value)=>{
        const n = String(value ?? "").trim().length;
        return n >= min ? "" : (label + " minimal " + min + " karakter.");
      };
    },

    maxLen(label = "Field", max = 255){
      return (value)=>{
        const n = String(value ?? "").trim().length;
        return n <= max ? "" : (label + " maksimal " + max + " karakter.");
      };
    },

    email(label = "Email"){
      return (value)=>{
        const v = String(value ?? "").trim();
        if(!v) return "";
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        return ok ? "" : (label + " tidak valid.");
      };
    },

    number(label = "Field"){
      return (value)=>{
        if(value == null || String(value).trim() === "") return "";
        return Number.isFinite(Number(value)) ? "" : (label + " harus angka.");
      };
    },

    minNum(label = "Field", min = 0){
      return (value)=>{
        if(value == null || String(value).trim() === "") return "";
        const n = Number(value);
        return Number.isFinite(n) && n >= min ? "" : (label + " minimal " + min + ".");
      };
    },

    maxNum(label = "Field", max = 999999999){
      return (value)=>{
        if(value == null || String(value).trim() === "") return "";
        const n = Number(value);
        return Number.isFinite(n) && n <= max ? "" : (label + " maksimal " + max + ".");
      };
    },

    pattern(label = "Field", re = /.*/, msg = "Format tidak valid."){
      return (value)=>{
        const v = String(value ?? "").trim();
        if(!v) return "";
        return re.test(v) ? "" : (label + " " + msg);
      };
    },

    oneOf(label = "Field", allowed = []){
      return (value)=>{
        const v = String(value ?? "");
        return allowed.includes(v) ? "" : (label + " tidak valid.");
      };
    },

    custom(fn){
      return (value, allValues, fieldName)=>{
        try{
          return String(fn(value, allValues, fieldName) || "");
        }catch{
          return "Validasi gagal.";
        }
      };
    }
  };
}

export function fveReadForm(form){
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

export function fveFieldElements(form, name){
  const input = form.querySelector(`[name="${CSS.escape(String(name))}"]`);
  const hint = form.querySelector(`[data-fve-hint-for="${CSS.escape(String(name))}"]`);
  const error = form.querySelector(`[data-fve-error-for="${CSS.escape(String(name))}"]`);
  const state = form.querySelector(`[data-fve-state-for="${CSS.escape(String(name))}"]`);
  return { input, hint, error, state };
}

export function fveClearField(form, name){
  const { input, error, state } = fveFieldElements(form, name);
  input?.classList.remove("is-invalid", "is-valid", "is-warning");
  if(error){
    error.textContent = "";
    error.classList.add("hidden");
  }
  if(state){
    state.textContent = "";
    state.className = "fve-state hidden";
  }
}

export function fveSetFieldError(form, name, message){
  const { input, error, state } = fveFieldElements(form, name);
  input?.classList.remove("is-valid", "is-warning");
  input?.classList.add("is-invalid");
  if(error){
    error.textContent = String(message || "");
    error.classList.remove("hidden");
  }
  if(state){
    state.textContent = "Invalid";
    state.className = "fve-state is-invalid";
  }
}

export function fveSetFieldValid(form, name, message = ""){
  const { input, error, state } = fveFieldElements(form, name);
  input?.classList.remove("is-invalid", "is-warning");
  input?.classList.add("is-valid");
  if(error){
    error.textContent = "";
    error.classList.add("hidden");
  }
  if(state){
    state.textContent = message || "Valid";
    state.className = "fve-state is-valid";
  }
}

export function fveSetFieldWarning(form, name, message = ""){
  const { input, error, state } = fveFieldElements(form, name);
  input?.classList.remove("is-invalid", "is-valid");
  input?.classList.add("is-warning");
  if(error){
    error.textContent = "";
    error.classList.add("hidden");
  }
  if(state){
    state.textContent = message || "Check";
    state.className = "fve-state is-warning";
  }
}

export function fveSetFormMessage(form, kind = "info", message = ""){
  const box = form.querySelector("#fveFormMsg");
  if(!box) return;
  box.textContent = String(message || "");
  box.className = "fve-form-msg " + (
    kind === "error" ? "is-error" :
    kind === "success" ? "is-success" :
    kind === "warning" ? "is-warning" : "is-info"
  );
}

export function fveClearFormMessage(form){
  const box = form.querySelector("#fveFormMsg");
  if(!box) return;
  box.textContent = "";
  box.className = "fve-form-msg hidden";
}

export function fveSubmitting(form, busy = true, label = "Saving..."){
  const saveBtn = form.querySelector("#cmeBtnSave, #btnSave, [data-fve-submit]");
  const cancelBtn = form.querySelector("#cmeBtnCancel, #btnCancel");
  const spinner = form.querySelector("#fveSubmitSpinner");

  form.querySelectorAll("input, select, textarea, button").forEach(el => {
    if(busy){
      if(el === cancelBtn) return;
      el.setAttribute("data-old-disabled", el.disabled ? "1" : "0");
      el.disabled = true;
    }else{
      if(el.getAttribute("data-old-disabled") !== "1"){
        el.disabled = false;
      }
      el.removeAttribute("data-old-disabled");
    }
  });

  if(saveBtn){
    if(busy){
      saveBtn.setAttribute("data-old-html", saveBtn.innerHTML);
      saveBtn.innerHTML = `<span id="fveSubmitSpinner" class="fve-btn-spinner"></span>${fveEsc(label)}`;
    }else{
      saveBtn.innerHTML = saveBtn.getAttribute("data-old-html") || saveBtn.innerHTML;
      saveBtn.removeAttribute("data-old-html");
    }
  }

  if(spinner && !busy){
    spinner.remove();
  }
}

export function fveCreateEngine(form, schema = {}, options = {}){
  const touched = new Set();
  const rulesMap = schema || {};
  const read = options.read || (()=>fveReadForm(form));

  function validateField(name, force = false){
    const values = read();
    const value = values[name];
    const rules = Array.isArray(rulesMap[name]) ? rulesMap[name] : [];

    if(!force && !touched.has(name)) return "";

    fveClearField(form, name);

    for(const rule of rules){
      const msg = String(rule(value, values, name) || "");
      if(msg){
        fveSetFieldError(form, name, msg);
        return msg;
      }
    }

    if(force || touched.has(name)){
      fveSetFieldValid(form, name);
    }
    return "";
  }

  function validateAll(){
    const errors = {};
    for(const name of Object.keys(rulesMap)){
      const msg = validateField(name, true);
      if(msg) errors[name] = msg;
    }
    return errors;
  }

  function markTouched(name){
    if(name) touched.add(String(name));
  }

  function bind(){
    Object.keys(rulesMap).forEach(name => {
      const { input } = fveFieldElements(form, name);
      if(!input) return;

      const onTouch = ()=>{
        markTouched(name);
        validateField(name, false);
      };

      input.addEventListener("blur", onTouch);
      input.addEventListener("change", onTouch);
      input.addEventListener("input", ()=>{
        if(touched.has(name)) validateField(name, false);
      });
    });
  }

  return {
    bind,
    read,
    validateField,
    validateAll,
    markTouched,
    clearField(name){
      fveClearField(form, name);
    },
    setFieldError(name, message){
      fveSetFieldError(form, name, message);
    },
    setFieldValid(name, message){
      fveSetFieldValid(form, name, message);
    },
    setFieldWarning(name, message){
      fveSetFieldWarning(form, name, message);
    },
    setFormMessage(kind, message){
      fveSetFormMessage(form, kind, message);
    },
    clearFormMessage(){
      fveClearFormMessage(form);
    },
    setSubmitting(busy, label){
      fveSubmitting(form, busy, label);
    }
  };
}

export function fveInlineHint({
  name = "",
  hint = "",
  tone = "muted"
} = {}){
  return `
    <div class="fve-hint ${tone === "info" ? "is-info" : tone === "warning" ? "is-warning" : ""}" data-fve-hint-for="${fveEsc(name)}">
      ${fveEsc(hint)}
    </div>
    <div class="fve-error hidden" data-fve-error-for="${fveEsc(name)}"></div>
    <div class="fve-state hidden" data-fve-state-for="${fveEsc(name)}"></div>
  `;
}

export function fveFormMessageBox(){
  return `<div id="fveFormMsg" class="fve-form-msg hidden"></div>`;
}
