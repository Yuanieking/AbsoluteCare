import { templates } from "../src/emails/preview.js";
import { sendEmail } from "../src/services/mailer.js";

const templateName =
  process.argv.find((arg) => arg.startsWith("--template="))?.split("=")[1] ||
  "reset";
const to = process.argv.find((arg) => arg.startsWith("--to="))?.split("=")[1];
if (!to || !templates[templateName]) {
  console.error(
    "Usage: npm run email:test -- --template=reset --to=you@example.com",
  );
  process.exit(1);
}
const email = await templates[templateName]();
const result = await sendEmail({ ...email, to });
console.log(JSON.stringify({ template: templateName, to, ...result }));
