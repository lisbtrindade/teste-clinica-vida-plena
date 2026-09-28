import { Appointment } from "../models";

export async function calculateRisk(appointmentId: string) {
  const appointment = await Appointment.findOne({ id: appointmentId }).lean();

  if (!appointment) {
    throw new Error("Agendamento não encontrado");
  }

  const sixMonthsAgo = new Date(appointment.dataConsulta);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const history = await Appointment.find({
    pacienteId: appointment.pacienteId,
    dataConsulta: { $lt: appointment.dataConsulta, $gte: sixMonthsAgo },
    status: { $in: ["realizada", "falta"] },
  }).lean();

  const faltas = history.filter((item) => item.status === "falta").length;
  const concluidas = history.length;

  const reasons: string[] = [];
  let score = 0;

  if (faltas >= 2) {
    score += 2;
    reasons.push("pelo menos 2 faltas nos últimos 6 meses");
  }

  if (concluidas >= 2 && faltas / concluidas >= 0.5) {
    score += 2;
    reasons.push("taxa de falta histórica de pelo menos 50%");
  }

  if (appointment.primeiraConsulta) {
    score += 1;
    reasons.push("primeira consulta na clínica");
  }

  if (appointment.dataConsulta.getDay() === 1) {
    score += 1;
    reasons.push("consulta na segunda-feira");
  }

  const leadDays =
    (appointment.dataConsulta.getTime() -
      appointment.dataAgendamento.getTime()) /
    86400000;

  if (leadDays > 21) {
    score += 1;
    reasons.push("consulta marcada com mais de 21 dias de antecedência");
  }

  return {
    level: score >= 4 ? "alto" : score >= 2 ? "medio" : "baixo",
    score,
    reasons,
    historico: {
      consultasConcluidas: concluidas,
      faltas,
      taxaFalta: concluidas ? faltas / concluidas : 0,
    },
  };
}
