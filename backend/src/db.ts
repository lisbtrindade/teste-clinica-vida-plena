import mongoose from "mongoose";

export async function connectDatabase() {
  const uri = process.env.MONGO_URI ?? "mongodb://localhost:27017/clinica_vida_plena";
  await mongoose.connect(uri);
  console.log("MongoDB conectado");
}
