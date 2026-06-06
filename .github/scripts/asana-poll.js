#!/usr/bin/env node
/**
 * Polls Asana for tasks tagged "ai-build" that haven't been picked up yet.
 * Outputs a JSON array of tasks to stdout, and sets GHA output "tasks".
 *
 * A task is considered "already picked up" if it also has the "ai-building" tag.
 *
 * Required env vars:
 *   ASANA_ACCESS_TOKEN
 *   ASANA_AI_BUILD_TAG_GID   — GID of the "ai-build" tag
 *   ASANA_AI_BUILDING_TAG_GID — GID of the "ai-building" tag (in-progress marker)
 */

const https = require("https");
const fs = require("fs");

const TOKEN = process.env.ASANA_ACCESS_TOKEN;
const BUILD_TAG = process.env.ASANA_AI_BUILD_TAG_GID;
const BUILDING_TAG = process.env.ASANA_AI_BUILDING_TAG_GID;

if (!TOKEN || !BUILD_TAG || !BUILDING_TAG) {
  console.error("Missing required env vars: ASANA_ACCESS_TOKEN, ASANA_AI_BUILD_TAG_GID, ASANA_AI_BUILDING_TAG_GID");
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
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse Asana response: ${data}`));
        }
      });
    }).on("error", reject);
  });
}

async function main() {
  // Get all tasks with the "ai-build" tag
  const result = await asanaGet(
    `/tasks?tag=${BUILD_TAG}&opt_fields=gid,name,notes,tags`
  );

  if (!result.data) {
    console.error("Unexpected Asana response:", JSON.stringify(result));
    process.exit(1);
  }

  // Filter out tasks already being processed (have "ai-building" tag)
  const newTasks = result.data.filter((task) => {
    const tagGids = (task.tags || []).map((t) => t.gid);
    return !tagGids.includes(BUILDING_TAG);
  });

  console.log(`Found ${result.data.length} ai-build tasks, ${newTasks.length} new`);

  const output = JSON.stringify(newTasks);

  // Write to GitHub Actions output
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `tasks=${output}\n`);
    fs.appendFileSync(outputFile, `task_count=${newTasks.length}\n`);
  }

  // Also print for debugging
  if (newTasks.length > 0) {
    newTasks.forEach((t) => console.log(`  - [${t.gid}] ${t.name}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
