export function afvEsc(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#39;"
  }[m]));
}

export function afvDebounce(fn, wait = 450){
  let t = null;
  return (...args)=>{
    clearTimeout(t);
    t = setTimeout(()=>fn(...args), wait);
  };
}

export function afvGetFieldNodes(form, name){
  const input = form.querySelector(`[name="${CSS.escape(String(name))}"]`);
  const state = form.querySelector(`[data-fve-state-for="${CSS.escape(String(name))}"]`);
  const error = form.querySelector(`[data-fve-error-for="${CSS.escape(String(name))}"]`);
  return { input, state, error };
}

export function afvSetChecking(form, name, text = "Checking..."){
  const { input, state, error } = afvGetFieldNodes(form, name);
  input?.classList.remove("is-valid", "is-invalid");
  input?.classList.add("is-checking");

  if(error){
    error.textContent = "";
    error.classList.add("hidden");
  }

  if(state){
    state.textContent = String(text || "Checking...");
    state.className = "fve-state afv-state is-checking";
  }
}

export function afvSetAvailable(form, name, text = "Available"){
  const { input, state, error } = afvGetFieldNodes(form, name);
  input?.classList.remove("is-invalid", "is-checking", "is-warning");
  input?.classList.add("is-valid");

  if(error){
    error.textContent = "";
    error.classList.add("hidden");
  }

  if(state){
    state.textContent = String(text || "Available");
    state.className = "fve-state afv-state is-available";
  }
}

export function afvSetUsed(form, name, text = "Already used"){
  const { input, state, error } = afvGetFieldNodes(form, name);
  input?.classList.remove("is-valid", "is-checking", "is-warning");
  input?.classList.add("is-invalid");

  if(error){
    error.textContent = "";
    error.classList.add("hidden");
  }

  if(state){
    state.textContent = String(text || "Already used");
    state.className = "fve-state afv-state is-used";
  }
}

export function afvSetError(form, name, text = "Validation failed"){
  const { input, state, error } = afvGetFieldNodes(form, name);
  input?.classList.remove("is-valid", "is-checking");
  input?.classList.add("is-warning");

  if(error){
    error.textContent = "";
    error.classList.add("hidden");
  }

  if(state){
    state.textContent = String(text || "Validation failed");
    state.className = "fve-state afv-state is-error";
  }
}

export function afvClear(form, name){
  const { input, state } = afvGetFieldNodes(form, name);
  input?.classList.remove("is-checking");
  if(state){
    if(state.classList.contains("afv-state")){
      state.textContent = "";
      state.className = "fve-state hidden";
    }
  }
}

export function afvCreateEngine(form, config = {}){
  const fields = {};
  const lastToken = {};
  const lastValue = {};
  const busy = {};

  Object.keys(config || {}).forEach(name => {
    fields[name] = {
      name,
      debounce_ms: Number(config[name]?.debounce_ms || 500),
      min_length: Number(config[name]?.min_length || 2),
      skip_if_empty: config[name]?.skip_if_empty !== false,
      normalize: typeof config[name]?.normalize === "function"
        ? config[name].normalize
        : (v => String(v ?? "").trim()),
      validate: config[name]?.validate
    };
    lastToken[name] = 0;
    lastValue[name] = "";
    busy[name] = false;
  });

  async function runField(name){
    const cfg = fields[name];
    if(!cfg || typeof cfg.validate !== "function") return { ok: true, skipped: true };

    const input = form.querySelector(`[name="${CSS.escape(String(name))}"]`);
    if(!input) return { ok: false, skipped: true };

    const raw = input.type === "checkbox" ? !!input.checked : input.value;
    const value = cfg.normalize(raw);

    if(cfg.skip_if_empty && (!value || String(value).trim() === "")){
      afvClear(form, name);
      return { ok: true, skipped: true };
    }

    if(String(value).length < cfg.min_length){
      afvClear(form, name);
      return { ok: true, skipped: true };
    }

    lastValue[name] = value;
    const token = Date.now() + Math.random();
    lastToken[name] = token;
    busy[name] = true;

    afvSetChecking(form, name, "Checking...");

    try{
      const res = await cfg.validate(value, { form, name });

      if(lastToken[name] !== token){
        return { ok: true, stale: true };
      }

      busy[name] = false;

      if(res?.ok === true){
        afvSetAvailable(form, name, res.message || "Available");
        return { ok: true, available: true };
      }

      if(res?.ok === false && res?.used){
        afvSetUsed(form, name, res.message || "Already used");
        return { ok: false, used: true, message: res.message || "Already used" };
      }

      if(res?.ok === false){
        afvSetError(form, name, res.message || "Validation failed");
        return { ok: false, error: true, message: res.message || "Validation failed" };
      }

      afvClear(form, name);
      return { ok: true, skipped: true };
    }catch(e){
      if(lastToken[name] !== token){
        return { ok: true, stale: true };
      }
      busy[name] = false;
      afvSetError(form, name, String(e?.message || "Validation failed"));
      return { ok: false, error: true, message: String(e?.message || "Validation failed") };
    }
  }

  function bindField(name){
    const cfg = fields[name];
    const input = form.querySelector(`[name="${CSS.escape(String(name))}"]`);
    if(!cfg || !input) return;

    const debounced = afvDebounce(()=>runField(name), cfg.debounce_ms);

    input.addEventListener("input", debounced);
    input.addEventListener("change", debounced);
    input.addEventListener("blur", ()=>runField(name));
  }

  function bind(){
    Object.keys(fields).forEach(bindField);
  }

  async function validateAll(){
    const result = {};
    for(const name of Object.keys(fields)){
      result[name] = await runField(name);
    }
    return result;
  }

  function isBusy(name = ""){
    if(name) return !!busy[name];
    return Object.values(busy).some(Boolean);
  }

  return {
    bind,
    runField,
    validateAll,
    isBusy,
    clear(name){
      afvClear(form, name);
    }
  };
}

export function afvMockUniqueChecker(usedValues = [], {
  okMessage = "Available",
  usedMessage = "Already used",
  delay = 350,
  caseInsensitive = true
} = {}){
  const bank = (Array.isArray(usedValues) ? usedValues : []).map(x =>
    caseInsensitive ? String(x ?? "").trim().toLowerCase() : String(x ?? "").trim()
  );

  return async (value)=>{
    await new Promise(resolve => setTimeout(resolve, delay));
    const v = caseInsensitive ? String(value ?? "").trim().toLowerCase() : String(value ?? "").trim();
    const used = bank.includes(v);
    return used
      ? { ok:false, used:true, message: usedMessage }
      : { ok:true, message: okMessage };
  };
}
