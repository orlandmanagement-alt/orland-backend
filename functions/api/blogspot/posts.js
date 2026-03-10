import { blogspotGet } from "./_service.js";
export async function onRequestGet({ request, env }){
  const url = new URL(request.url);
  const maxResults = Math.max(1, Math.min(50, Number(url.searchParams.get("maxResults") || "20")));
  return await blogspotGet(env, "/posts", { maxResults });
}
