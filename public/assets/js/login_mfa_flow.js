export async function submitLoginWithMfa(fetchJson, payload, handlers = {}){
  const r = await fetchJson("/api/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if(r.status === "ok" && r.data?.mfa_required){
    if(typeof handlers.onMfaRequired === "function"){
      await handlers.onMfaRequired(r.data);
    }
    return r;
  }

  if(r.status === "ok" && typeof handlers.onLoginSuccess === "function"){
    await handlers.onLoginSuccess(r.data);
  }

  if(r.status !== "ok" && typeof handlers.onLoginError === "function"){
    await handlers.onLoginError(r);
  }

  return r;
}

export async function submitMfaLoginVerify(fetchJson, payload, handlers = {}){
  const r = await fetchJson("/api/mfa/login-verify", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  if(r.status === "ok" && typeof handlers.onVerifySuccess === "function"){
    await handlers.onVerifySuccess(r.data);
  }

  if(r.status !== "ok" && typeof handlers.onVerifyError === "function"){
    await handlers.onVerifyError(r);
  }

  return r;
}

export function renderInlineMfaPrompt(root, opt = {}){
  const pendingToken = String(opt.pending_token || "");
  const user = opt.user || {};

  root.innerHTML = `
    <div class="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4">
      <div class="text-sm font-black text-amber-700">MFA verification required</div>
      <div class="mt-1 text-xs text-slate-600 dark:text-slate-300">
        ${user.display_name || user.email_norm || "User"} harus menyelesaikan verifikasi MFA.
      </div>

      <form id="loginMfaVerifyForm" class="mt-4 space-y-3">
        <input type="hidden" name="pending_token" value="${pendingToken.replace(/"/g, "&quot;")}">
        <div>
          <label class="block text-xs font-bold text-slate-500 mb-2">Authenticator Code / Recovery Code</label>
          <input
            name="code"
            class="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-darkBorder bg-white dark:bg-dark text-sm font-semibold"
            placeholder="6-digit code or recovery code"
          >
        </div>
        <div class="flex gap-2 flex-wrap">
          <button type="submit" class="px-4 py-2.5 rounded-2xl bg-primary text-white font-black text-sm">Verify MFA</button>
        </div>
      </form>
    </div>
  `;

  return root.querySelector("#loginMfaVerifyForm");
}
