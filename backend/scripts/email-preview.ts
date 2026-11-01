import fs from "node:fs/promises";
import path from "node:path";
import { templates } from "../src/emails/preview.js";

const output = path.resolve("tmp/emails");
await fs.mkdir(output, { recursive: true });
for (const [name, render] of Object.entries(templates)) {
  const email = await render();
  await fs.writeFile(path.join(output, `${name}.html`), email.html, "utf8");
  await fs.writeFile(path.join(output, `${name}.txt`), email.text, "utf8");
}
console.log(
  `Rendered ${Object.keys(templates).length} email previews to ${output}`,
);
