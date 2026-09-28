import { AppointmentStatus } from "../types";

const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  agendada: [
    "confirmada",
    "realizada",
    "falta",
    "cancelada_paciente",
    "cancelada_clinica",
  ],
  confirmada: [
    "realizada",
    "falta",
    "cancelada_paciente",
    "cancelada_clinica",
  ],
  realizada: [],
  falta: [],
  cancelada_paciente: [],
  cancelada_clinica: [],
};

export function canTransition(
  current: AppointmentStatus,
  next: AppointmentStatus
): boolean {
  return transitions[current]?.includes(next) ?? false;
}

export function validateStatusDate(
  next: AppointmentStatus,
  consultationDate: Date,
  now = new Date()
): string | null {
  const consultationHasPassed = consultationDate.getTime() <= now.getTime();

  if (["realizada", "falta"].includes(next) && !consultationHasPassed) {
    return "realizada e falta só podem ser registradas depois do horário da consulta";
  }

  if (
    ["cancelada_paciente", "cancelada_clinica"].includes(next) &&
    consultationHasPassed
  ) {
    return "cancelamentos só podem ser registrados antes do horário da consulta";
  }

  return null;
}
