import { Router } from "express";
import { templates } from "../emails/preview.js";

const router = Router();

router.get("/emails/:template", async (req, res, next) => {
  try {
    const render = templates[req.params.template];
    if (!render) {
      res.status(404).send("Unknown email template.");
      return;
    }
    const email = await render();
    res.type("html").send(email.html);
  } catch (error) {
    next(error);
  }
});

export default router;
