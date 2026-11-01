import type { AuthUser } from "./api.js";
import type { UserDoc } from "../models/userModel.js";

declare global {
  namespace Express {
    interface Request {
      user: AuthUser;
      patient?: UserDoc;
    }
  }
}

export {};
