#!/usr/bin/env node
/**
 * Polls Asana for tasks where the "Build" custom field = "ai-build".
 * Outputs a JSON array to GitHub Actions output "tasks".
 *
 * Custom field GIDs (hardcoded — these don't change):
 *   Build field:        1215469498161954
 *   "ai-build" option:  1215469498161955
 *   Workspace:          823554432495933
 *
 * Required env var: ASANA_ACCESS_TOKEN
 */

const https = require("https");
const fs = require("fs");

const TOKEN = process.env.ASANA_ACCESS_TOKEN;
const WORKSPACE_GID = "823554432495933";
const BUILD_FIELD_GID = "1215469498161954";
const AI_BUILD_OPTION_GID = "1215469498161955";

if (!TOKEN) {
  console.error("Missing required env var: ASANA_ACCESS_TOKEN");
  process.exit(1);
}

function asanaGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "app.asana.com",
      path: `/api/1.0${path}`,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: "application/json",
      },
    };
    https.get(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`Failed to parse Asana response: ${data}`)); }
      });
    }).on("error", reject);
  });
}

async function main() {
  // Search for incomplete tasks where Build = ai-build
  const params = new URLSearchParams({
    [`custom_fields.${BUILD_FIELD_GID}.value`]: AI_BUILD_OPTION_GID,
    completed: "false",
    "opt_fields": "gid,name,notes,custom_fields",
  });

  const result = await asanaGet(
    `/workspaces/${WORKSPACE_GID}/tasks/search?${params}`
  );

  if (!result.data) {
    console.error("Unexpected Asana response:", JSON.stringify(result));
    process.exit(1);
  }

  const tasks = result.data;
  console.log(`Found ${tasks.length} task(s) with Build = ai-build`);
  tasks.forEach((t) => console.log(`  - [${t.gid}] ${t.name}`));

  const output = JSON.stringify(tasks);
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `tasks=${output}\n`);
    fs.appendFileSync(outputFile, `task_count=${tasks.length}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
