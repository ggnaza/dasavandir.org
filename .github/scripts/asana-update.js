#!/usr/bin/env node
/**
 * Updates an Asana task after the build agent processes it.
 * Usage:
 *   node asana-update.js <command> [args]
 *
 * Commands:
 *   mark-building <task_gid>           — swap ai-build tag → ai-building
 *   mark-done <task_gid>               — swap ai-building tag → ai-done
 *   comment <task_gid> <text>          — add a comment to the task
 *
 * Required env vars:
 *   ASANA_ACCESS_TOKEN
 *   ASANA_AI_BUILD_TAG_GID
 *   ASANA_AI_BUILDING_TAG_GID
 *   ASANA_AI_DONE_TAG_GID
 */

const https = require("https");

const TOKEN = process.env.ASANA_ACCESS_TOKEN;
const BUILD_TAG = process.env.ASANA_AI_BUILD_TAG_GID;
const BUILDING_TAG = process.env.ASANA_AI_BUILDING_TAG_GID;
const DONE_TAG = process.env.ASANA_AI_DONE_TAG_GID;

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
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ raw: data });
        }
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function addTag(taskGid, tagGid) {
  return asanaRequest("POST", `/tasks/${taskGid}/addTag`, { tag: tagGid });
}

async function removeTag(taskGid, tagGid) {
  return asanaRequest("POST", `/tasks/${taskGid}/removeTag`, { tag: tagGid });
}

async function addComment(taskGid, text) {
  return asanaRequest("POST", `/tasks/${taskGid}/stories`, { text });
}

async function main() {
  const [, , command, taskGid, ...rest] = process.argv;

  if (!TOKEN) {
    console.error("ASANA_ACCESS_TOKEN not set");
    process.exit(1);
  }

  switch (command) {
    case "mark-building":
      await removeTag(taskGid, BUILD_TAG);
      await addTag(taskGid, BUILDING_TAG);
      console.log(`Task ${taskGid}: marked as ai-building`);
      break;

    case "mark-done":
      await removeTag(taskGid, BUILDING_TAG);
      await addTag(taskGid, DONE_TAG);
      console.log(`Task ${taskGid}: marked as ai-done`);
      break;

    case "comment": {
      const text = rest.join(" ");
      await addComment(taskGid, text);
      console.log(`Task ${taskGid}: comment added`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
