import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { connectDatabase } from "./db";
import { Appointment, Doctor } from "./models";

const dataDirectory = path.resolve(process.env.DATA_DIR ?? "/app/data");

function parseDate(value: string): Date | null {
  const text = value?.trim();
  if (!text) return null;

  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (br) {
    const [, day, month, year, hour = "00", minute = "00"] = br;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );
  }

  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function normalizeStatus(value: string | undefined): string | null {
  if (!value) return null;

  const status = value.trim().toLowerCase().replace(/\s+/g, "_");

  const map: Record<string, string> = {
    realizada: "realizada",
    atendido: "realizada",
    falta: "falta",
    faltou: "falta",
    no_show: "falta",
    ausente: "falta",
    agendada: "agendada",
    confirmada: "confirmada",
    confirmado: "confirmada",
    cancelado: "cancelada_paciente",
    cancelada_paciente: "cancelada_paciente",
    cancelado_pelo_paciente: "cancelada_paciente",
    desmarcou: "cancelada_paciente",
    cancelado_clinica: "cancelada_clinica",
    cancelada_clinica: "cancelada_clinica",
  };

  return map[status] ?? null;
}

function normalizeType(value: string): "convenio" | "particular" | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "convenio" || normalized === "convênio") return "convenio";
  if (normalized === "particular") return "particular";
  return null;
}

async function run() {
  await connectDatabase();

  const doctors = JSON.parse(
    fs.readFileSync(path.join(dataDirectory, "medicos.json"), "utf8")
  );

  await Doctor.deleteMany({});
  await Doctor.insertMany(doctors);

  const csv = fs.readFileSync(
    path.join(dataDirectory, "agendamentos.csv"),
    "utf8"
  );

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_column_count: true,
  });

  const report = {
    total: rows.length,
    imported: 0,
    corrected: 0,
    discarded: 0,
    reasons: [] as string[],
  };

  const seen = new Map<string, string>();

  await Appointment.deleteMany({});

  for (const row of rows) {
    const dataAgendamento = parseDate(row.data_agendamento);
    const dataConsulta = parseDate(row.data_consulta);
    const status = normalizeStatus(row.status);
    const tipo = normalizeType(row.tipo_atendimento);

    if (!dataAgendamento || !dataConsulta) {
      report.discarded++;
      report.reasons.push(`${row.id}: data inválida`);
      continue;
    }

    if (!status) {
      report.discarded++;
      report.reasons.push(`${row.id}: status ausente ou desconhecido`);
      continue;
    }

    if (!tipo) {
      report.discarded++;
      report.reasons.push(`${row.id}: tipo_atendimento inválido`);
      continue;
    }

    if (!row.id || !row.paciente_id || !row.medico_id || !row.paciente_nome) {
      report.discarded++;
      report.reasons.push(`${row.id ?? "sem id"}: campos obrigatórios ausentes`);
      continue;
    }

    const normalizedFingerprint = JSON.stringify({
      pacienteId: row.paciente_id,
      medicoId: row.medico_id,
      dataConsulta: dataConsulta.toISOString(),
      status,
    });

    const previous = seen.get(row.id);

    if (previous && previous !== normalizedFingerprint) {
      report.discarded++;
      report.reasons.push(`${row.id}: conflito entre registros duplicados`);
      continue;
    }

    if (previous) {
      report.discarded++;
      report.reasons.push(`${row.id}: duplicata exata descartada`);
      continue;
    }

    seen.set(row.id, normalizedFingerprint);

    const changed =
      status !== row.status ||
      tipo !== row.tipo_atendimento ||
      dataConsulta.toString() !== parseDate(row.data_consulta)?.toString();

    if (changed) report.corrected++;

    await Appointment.create({
      id: row.id,
      pacienteId: row.paciente_id,
      pacienteNome: row.paciente_nome.trim(),
      pacienteTelefone: row.paciente_telefone?.trim() || undefined,
      tipoAtendimento: tipo,
      medicoId: row.medico_id.trim(),
      dataAgendamento,
      dataConsulta,
      status,
    });

    report.imported++;
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
