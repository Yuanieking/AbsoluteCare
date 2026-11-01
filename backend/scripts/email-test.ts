import { templates } from "../src/emails/preview.js";
import { sendEmail } from "../src/services/mailer.js";

// preview.js is still JavaScript; its keys are not indexable until Slice 7.
type EmailTemplate = () => Promise<{
  subject: string;
  text: string;
  html: string;
}>;
const templateMap = templates as unknown as Record<
  string,
  EmailTemplate | undefined
>;

const templateName =
  process.argv.find((arg) => arg.startsWith("--template="))?.split("=")[1] ||
  "reset";
const to = process.argv.find((arg) => arg.startsWith("--to="))?.split("=")[1];
if (!to || !templateMap[templateName]) {
  console.error(
    "Usage: npm run email:test -- --template=reset --to=you@example.com",
  );
  process.exit(1);
}
const email = await templateMap[templateName]!();
const result = await sendEmail({ ...email, to });
console.log(JSON.stringify({ template: templateName, to, ...result }));
