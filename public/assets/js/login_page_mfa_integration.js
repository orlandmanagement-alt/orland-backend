import {
  submitLoginWithMfa,
  submitMfaLoginVerify,
  renderInlineMfaPrompt
} from "./login_mfa_flow.js";

function byId(id){
  return document.getElementById(id);
}

async function fetchJson(path, opt = {}){
  const headers = Object.assign({}, opt.headers || {});
  if(opt.body != null && !headers["content-type"]){
    headers["content-type"] = "application/json";
  }

  try{
    const res = await fetch(path, {
      method: opt.method || "GET",
      headers,
      body: opt.body || undefined,
      credentials: "include"
    });

    const ct = res.headers.get("content-type") || "";
    if(!ct.includes("application/json")){
      const t = await res.text().catch(() => "");
      return {
        status: "server_error",
        data: { http: res.status, body: t.slice(0, 500) }
      };
    }

    return await res.json();
  }catch(err){
    return {
      status: "network_error",
      data: { message: String(err?.message || err) }
    };
  }
}

function setMsg(text, kind = "muted"){
  const el = byId("loginMsg");
  if(!el) return;
  el.className = "text-sm";
  if(kind === "error") el.classList.add("text-red-500");
  else if(kind === "success") el.classList.add("text-emerald-600");
  else if(kind === "warning") el.classList.add("text-amber-600");
  else el.classList.add("text-slate-500");
  el.textContent = text || "";
}

export function mountLoginMfaIntegration(){
  const form = byId("loginForm");
  const mfaBox = byId("loginMfaBox");

  if(!form || !mfaBox) return;

  form.addEventListener("submit", async (ev)=>{
    ev.preventDefault();

    const email = String(form.email?.value || "").trim();
    const password = String(form.password?.value || "");

    setMsg("Signing in...");

    await submitLoginWithMfa(fetchJson, { email, password }, {
      onMfaRequired: async (data)=>{
        setMsg("MFA verification required.", "warning");

        const verifyForm = renderInlineMfaPrompt(mfaBox, {
          pending_token: data.pending_token,
          user: data.user || {}
        });

        verifyForm?.addEventListener("submit", async (e)=>{
          e.preventDefault();
          const pending_token = String(verifyForm.pending_token?.value || "");
          const code = String(verifyForm.code?.value || "").trim();

          if(!pending_token || !code){
            setMsg("MFA code wajib diisi.", "error");
            return;
          }

          setMsg("Verifying MFA...");

          await submitMfaLoginVerify(fetchJson, { pending_token, code }, {
            onVerifySuccess: async ()=>{
              setMsg("Login successful.", "success");
              location.href = "/dashboard";
            },
            onVerifyError: async (r)=>{
              setMsg("MFA verify failed: " + (r.data?.message || r.status), "error");
            }
          });
        }, { once:false });
      },
      onLoginSuccess: async ()=>{
        setMsg("Login successful.", "success");
        location.href = "/dashboard";
      },
      onLoginError: async (r)=>{
        setMsg("Login failed: " + (r.data?.message || r.status), "error");
      }
    });
  });
}
