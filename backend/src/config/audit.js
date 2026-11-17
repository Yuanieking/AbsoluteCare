import mongoose from "mongoose";
import { auditPlugin } from "../services/auditCapture.js";

mongoose.plugin(auditPlugin);
