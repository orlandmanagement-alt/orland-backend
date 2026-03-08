import { run as install } from "./install.js";

export async function run(ctx){
  // reconcile = install idempotent
  return await install(ctx);
}
