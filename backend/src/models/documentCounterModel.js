import mongoose from "mongoose";

const documentCounterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0, min: 0 },
});

const DocumentCounter = mongoose.model(
  "DocumentCounter",
  documentCounterSchema,
);

export default DocumentCounter;
