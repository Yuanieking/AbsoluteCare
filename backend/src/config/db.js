import mongoose from "mongoose";
import { MONGO_URI } from "./env.js";

const connectDB = async () => {
  await mongoose.connect(MONGO_URI);
  console.log("Database connected successfully");
};

export default connectDB;
