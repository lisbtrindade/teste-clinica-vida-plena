export const FINAL_STATUSES = [
  "realizada",
  "falta",
  "cancelada_paciente",
  "cancelada_clinica",
] as const;

export const APPOINTMENT_STATUSES = [
  "agendada",
  "confirmada",
  ...FINAL_STATUSES,
] as const;

export type AppointmentStatus = typeof APPOINTMENT_STATUSES[number];

export type AppointmentInput = {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  pacienteTelefone?: string;
  tipoAtendimento: "convenio" | "particular";
  medicoId: string;
  dataAgendamento: Date;
  dataConsulta: Date;
  status: AppointmentStatus;
  primeiraConsulta?: boolean;
};
