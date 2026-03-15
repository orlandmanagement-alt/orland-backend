import { onRequestPost as authLogoutPost, onRequestGet as authLogoutGet } from "../auth/logout.js";

export async function onRequestPost(ctx){
  return authLogoutPost(ctx);
}

export async function onRequestGet(ctx){
  return authLogoutGet(ctx);
}
