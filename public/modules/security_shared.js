export function fmtTs(ts){
  if(!ts) return "-";
  try{
    const d = new Date(Number(ts)*1000);
    return d.toISOString().replace("T"," ").slice(0,19);
  }catch{ return String(ts); }
}
export function esc(s){
  return String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}
