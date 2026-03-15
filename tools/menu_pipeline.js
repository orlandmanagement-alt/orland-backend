const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const validateScript = path.join(process.cwd(), "tools", "validate_menu_config.js");
const genScript = path.join(process.cwd(), "tools", "gen_menu_sync.js");
const validationReport = path.join(process.cwd(), "tools", "menu_sync_validation_report.json");
const generatedSql = path.join(process.cwd(), "menu_sync_generated.sql");

function run(cmd, args){
  const r = cp.spawnSync(cmd, args, {
    stdio: "inherit",
    shell: false
  });
  return r.status ?? 0;
}

function readJsonSafe(file){
  try{
    if(!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }catch{
    return null;
  }
}

function main(){
  const args = process.argv.slice(2);
  const doExecute = args.includes("--execute");
  const dbNameIndex = args.indexOf("--db");
  const dbName = dbNameIndex >= 0 ? String(args[dbNameIndex + 1] || "").trim() : "";

  console.log("[1/3] Validate menu config...");
  const v = run("node", [validateScript]);

  const report = readJsonSafe(validationReport);
  if(report){
    console.log("");
    console.log("[SUMMARY]");
    console.log("parents :", report.counts?.parents ?? 0);
    console.log("children:", report.counts?.children ?? 0);
    console.log("total   :", report.counts?.total ?? 0);
    console.log("errors  :", report.counts?.errors ?? 0);
    console.log("warnings:", report.counts?.warnings ?? 0);
  }

  if(v !== 0){
    console.log("");
    console.log("[STOP] Validation failed. SQL not generated.");
    process.exit(2);
  }

  console.log("");
  console.log("[2/3] Generate SQL...");
  const g = run("node", [genScript]);
  if(g !== 0){
    console.log("");
    console.log("[STOP] Failed generating SQL.");
    process.exit(3);
  }

  if(fs.existsSync(generatedSql)){
    const content = fs.readFileSync(generatedSql, "utf8");
    const lines = content.split(/\r?\n/).length;
    console.log("");
    console.log("[OK] SQL generated:", generatedSql);
    console.log("[INFO] line count:", lines);
  } else {
    console.log("");
    console.log("[STOP] SQL file not found after generation.");
    process.exit(4);
  }

  if(!doExecute){
    console.log("");
    console.log("[3/3] Execute skipped.");
    console.log("To execute manually:");
    console.log("npx wrangler d1 execute DB --remote --file=menu_sync_generated.sql");
    console.log("");
    console.log("Or run pipeline with:");
    console.log("node tools/menu_pipeline.js --execute --db DB");
    return;
  }

  if(!dbName){
    console.log("");
    console.log("[STOP] Missing --db DB_NAME");
    process.exit(5);
  }

  console.log("");
  console.log("[3/3] Execute to D1...");
  const ex = run("npx", ["wrangler", "d1", "execute", dbName, "--remote", "--file=menu_sync_generated.sql"]);
  if(ex !== 0){
    console.log("");
    console.log("[STOP] D1 execute failed.");
    process.exit(6);
  }

  console.log("");
  console.log("[DONE] Menu pipeline completed successfully.");
}

main();
