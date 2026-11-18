import mongoose from "mongoose";
import { auditPlugin } from "../services/auditCapture.js";

import { recordConcurrencyPlugin } from "../services/recordConcurrency.js";

mongoose.plugin(auditPlugin);
mongoose.plugin(recordConcurrencyPlugin);
