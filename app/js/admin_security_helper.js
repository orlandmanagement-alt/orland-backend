export function buildAdminUrl(path, params = {}){
  const url = new URL(path, location.origin);
  Object.entries(params || {}).forEach(([k, v]) => {
    if(v == null) return;
    const s = String(v).trim();
    if(!s) return;
    url.searchParams.set(k, s);
  });
  return url.toString();
}

export async function getJson(url){
  const res = await fetch(url, { credentials: "include" });
  const text = await res.text();
  try{
    return JSON.parse(text);
  }catch{
    return { status: "error", data: null };
  }
}

export async function postJson(url, body){
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const text = await res.text();
  try{
    return JSON.parse(text);
  }catch{
    return { status: "error", data: null };
  }
}
