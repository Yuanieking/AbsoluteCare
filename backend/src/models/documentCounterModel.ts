import mongoose from "mongoose";

export interface DocumentCounter {
  key: string;
  seq: number;
}

const documentCounterSchema = new mongoose.Schema<DocumentCounter>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0, min: 0 },
});

const DocumentCounter = mongoose.model<DocumentCounter>(
  "DocumentCounter",
  documentCounterSchema,
);

export default DocumentCounter;
