import mongoose, { Schema } from "mongoose";

const appointmentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    pacienteId: { type: String, required: true, index: true },
    pacienteNome: { type: String, required: true },
    pacienteTelefone: { type: String },
    tipoAtendimento: {
      type: String,
      enum: ["convenio", "particular"],
      required: true,
    },
    medicoId: { type: String, required: true, index: true },
    dataAgendamento: { type: Date, required: true },
    dataConsulta: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: [
        "agendada",
        "confirmada",
        "realizada",
        "falta",
        "cancelada_paciente",
        "cancelada_clinica",
      ],
      required: true,
    },
    primeiraConsulta: { type: Boolean, default: false },
  },
  { timestamps: true }
);

appointmentSchema.index({ medicoId: 1, dataConsulta: 1 });
appointmentSchema.index({ pacienteId: 1, dataConsulta: 1 });

const doctorSchema = new Schema({
  id: { type: String, unique: true, required: true },
  nome: { type: String, required: true },
  especialidade: { type: String, required: true },
  grade: [
    {
      dia: String,
      inicio: String,
      fim: String,
    },
  ],
});

export const Appointment = mongoose.model("Appointment", appointmentSchema);
export const Doctor = mongoose.model("Doctor", doctorSchema);
