#!/usr/bin/env node
/**
 * Updates an Asana task during the build/QA pipeline.
 * Usage:
 *   node asana-update.js comment <task_gid> <text>
 *   node asana-update.js clear-build <task_gid>      — clears the Build field so it won't re-trigger
 *   node asana-update.js complete <task_gid>          — marks the task complete
 *
 * Custom field GIDs (hardcoded):
 *   Build field: 1215469498161954
 *
 * Required env var: ASANA_ACCESS_TOKEN
 */

const https = require("https");

const TOKEN = process.env.ASANA_ACCESS_TOKEN;
const BUILD_FIELD_GID = "1215469498161954";

function asanaRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify({ data: body }) : null;
    const options = {
      hostname: "app.asana.com",
      path: `/api/1.0${path}`,
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data }); }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const [, , command, taskGid, ...rest] = process.argv;

  if (!TOKEN) { console.error("ASANA_ACCESS_TOKEN not set"); process.exit(1); }
  if (!taskGid) { console.error("task_gid required"); process.exit(1); }

  switch (command) {
    case "clear-build":
      // Clear the Build field so the agent won't pick it up again on next poll
      await asanaRequest("PUT", `/tasks/${taskGid}`, {
        custom_fields: { [BUILD_FIELD_GID]: null },
      });
      console.log(`Task ${taskGid}: Build field cleared`);
      break;

    case "comment": {
      const text = rest.join(" ");
      await asanaRequest("POST", `/tasks/${taskGid}/stories`, { text });
      console.log(`Task ${taskGid}: comment added`);
      break;
    }

    case "complete":
      await asanaRequest("PUT", `/tasks/${taskGid}`, { completed: true });
      console.log(`Task ${taskGid}: marked complete`);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
