import { json } from "../../_lib.js";
export async function onRequestGet(){
  return json(200, "ok", {
    enabled:true,
    items: [],
    note:"Widgets endpoint not available in Blogger v3 public API. Keep UI as placeholder."
  });
}
