import {
  requireBlogspotAccess,
  getKV,
  setKV,
  exchangeAuthCodeForToken
} from "./_service.js";

function htmlPage(title, body){
  return new Response(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{font-family:Inter,Arial,sans-serif;background:#0f172a;color:#e2e8f0;padding:24px}
.box{max-width:720px;margin:48px auto;background:#111827;border:1px solid #334155;border-radius:18px;padding:24px}
h1{margin:0 0 12px;font-size:24px}
p{color:#94a3b8;line-height:1.6}
a{color:#60a5fa}
code{background:#0b1220;padding:2px 6px;border-radius:8px}
</style>
</head>
<body>
<div class="box">${body}</div>
</body>
</html>`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

export async function onRequestGet({ request, env }){
  const a = await requireBlogspotAccess(env, request, false);
  if(!a.ok) return a.res;

  const url = new URL(request.url);
  const code = String(url.searchParams.get("code") || "");
  const state = String(url.searchParams.get("state") || "");
  const error = String(url.searchParams.get("error") || "");

  if(error){
    return htmlPage("OAuth Error", `
      <h1>Google OAuth error</h1>
      <p>${error}</p>
      <p>Return to Blogspot Settings and try again.</p>
    `);
  }

  if(!code || !state){
    return htmlPage("OAuth Invalid", `
      <h1>Invalid OAuth callback</h1>
      <p>Missing <code>code</code> or <code>state</code>.</p>
    `);
  }

  const savedState = await getKV(env, "blogspot_oauth_state");
  if(!savedState || savedState !== state){
    return htmlPage("OAuth Invalid State", `
      <h1>Invalid OAuth state</h1>
      <p>The callback state does not match the saved session.</p>
    `);
  }

  const ex = await exchangeAuthCodeForToken(request, env, code);
  if(!ex.ok || !ex.data?.access_token){
    return htmlPage("OAuth Exchange Failed", `
      <h1>Token exchange failed</h1>
      <p>Google did not return a valid token payload.</p>
      <pre>${JSON.stringify(ex.data || {}, null, 2)}</pre>
    `);
  }

  const now = Math.floor(Date.now() / 1000);
  const refreshToken = String(ex.data.refresh_token || "");
  const accessToken = String(ex.data.access_token || "");
  const tokenExpAt = now + Number(ex.data.expires_in || 3600);

  if(refreshToken){
    await setKV(env, "blogspot_refresh_token", refreshToken, 1);
  }
  await setKV(env, "blogspot_access_token", accessToken, 1);
  await setKV(env, "blogspot_token_exp_at", String(tokenExpAt), 1);
  await setKV(env, "blogspot_oauth_state", "", 1);

  return htmlPage("OAuth Connected", `
    <h1>Blogspot OAuth connected</h1>
    <p>Refresh token has been saved successfully.</p>
    <p>Return to Blogspot Settings, then reload the page.</p>
  `);
}
