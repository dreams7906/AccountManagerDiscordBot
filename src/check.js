// Checks every command is valid by Discord's rules without signing in:
// npm run check
import { commands } from "./commands/index.js";

const seen = new Set();
let problems = 0;
for (const command of commands) {
  const json = command.data.toJSON();
  if (seen.has(json.name)) {
    console.error(`✗ /${json.name} is listed twice`);
    problems++;
  }
  seen.add(json.name);
  if (!command.execute) {
    console.error(`✗ /${json.name} has nothing to run`);
    problems++;
  }
  const options = (json.options ?? []).map((o) => o.name).join(", ");
  console.log(`✓ /${json.name}${command.staff ? " (staff)" : ""}${options ? `  [${options}]` : ""}`);
}
console.log(problems ? `\n${problems} problem(s)` : `\nAll ${commands.length} commands are valid.`);
process.exit(problems ? 1 : 0);
