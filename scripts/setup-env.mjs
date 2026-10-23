import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

const TARGET = ".env.local";
const GENERATED = ["BETTER_AUTH_SECRET", "ENCRYPTION_KEY"];

if (existsSync(TARGET)) {
  console.log(`${TARGET} already exists, leaving it untouched.`);
  process.exit(0);
}

copyFileSync(".env.example", TARGET);

let content = readFileSync(TARGET, "utf8");
for (const name of GENERATED) {
  content = content.replace(new RegExp(`^${name}=.*$`, "m"), `${name}=${randomBytes(32).toString("base64")}`);
}
writeFileSync(TARGET, content);

console.log(`Created ${TARGET} with generated ${GENERATED.join(" and ")}.`);
console.log("Still to fill in: AI provider, GitHub App, Jira OAuth (see docs/engineering/integrations-setup.md).");
