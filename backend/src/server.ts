import express from "express";
import cors from "cors";
import { z } from "zod";
import { connectDatabase } from "./db";
import { Appointment, Doctor } from "./models";
import { canTransition, validateStatusDate } from "./services/rules";
import { isWithinDoctorSchedule } from "./services/schedule";
import { calculateRisk } from "./services/risk";

const app = express();
app.use(cors());
app.use(express.json());

const appointmentSchema = z.object({
  id: z.string().min(1),
  pacienteId: z.string().min(1),
  pacienteNome: z.string().min(1),
  pacienteTelefone: z.string().optional(),
  tipoAtendimento: z.enum(["convenio", "particular"]),
  medicoId: z.string().min(1),
  dataAgendamento: z.coerce.date(),
  dataConsulta: z.coerce.date(),
  status: z.enum(["agendada", "confirmada"]),
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/medicos", async (_req, res, next) => {
  try {
    res.json(await Doctor.find().sort({ nome: 1 }).lean());
  } catch (error) {
    next(error);
  }
});

app.get("/api/agendamentos", async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;

    const filter: Record<string, unknown> = {};
    if (from || to) {
      filter.dataConsulta = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }

    res.json(
      await Appointment.find(filter)
        .sort({ dataConsulta: 1 })
        .limit(200)
        .lean()
    );
  } catch (error) {
    next(error);
  }
});

app.post("/api/agendamentos", async (req, res, next) => {
  try {
    const input = appointmentSchema.parse(req.body);

    if (input.dataConsulta <= new Date()) {
      return res.status(400).json({
        message: "Novos agendamentos precisam estar no futuro.",
      });
    }

    if (!await isWithinDoctorSchedule(input.medicoId, input.dataConsulta)) {
      return res.status(400).json({
        message: "O horário não está dentro da grade do médico ou não é um slot de 30 minutos.",
      });
    }

    const doctorConflict = await Appointment.findOne({
      medicoId: input.medicoId,
      dataConsulta: input.dataConsulta,
      status: { $nin: ["cancelada_paciente", "cancelada_clinica"] },
    });

    if (doctorConflict) {
      return res.status(409).json({
        message: "O médico já possui uma consulta nesse horário.",
      });
    }

    const patientConflict = await Appointment.findOne({
      pacienteId: input.pacienteId,
      dataConsulta: input.dataConsulta,
      status: { $nin: ["cancelada_paciente", "cancelada_clinica"] },
    });

    if (patientConflict) {
      return res.status(409).json({
        message: "O paciente já possui uma consulta nesse horário.",
      });
    }

    const created = await Appointment.create(input);
    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/agendamentos/:id/status", async (req, res, next) => {
  try {
    const body = z.object({
      status: z.enum([
        "agendada",
        "confirmada",
        "realizada",
        "falta",
        "cancelada_paciente",
        "cancelada_clinica",
      ]),
    }).parse(req.body);

    const appointment = await Appointment.findOne({ id: req.params.id });

    if (!appointment) {
      return res.status(404).json({ message: "Agendamento não encontrado." });
    }

    if (!canTransition(appointment.status, body.status)) {
      return res.status(400).json({
        message: `Transição inválida: ${appointment.status} -> ${body.status}.`,
      });
    }

    const dateError = validateStatusDate(body.status, appointment.dataConsulta);
    if (dateError) {
      return res.status(400).json({ message: dateError });
    }

    appointment.status = body.status;
    await appointment.save();

    res.json(appointment);
  } catch (error) {
    next(error);
  }
});

app.get("/api/indicadores", async (req, res, next) => {
  try {
    const from = req.query.from
      ? new Date(String(req.query.from))
      : new Date("2000-01-01");
    const to = req.query.to
      ? new Date(String(req.query.to))
      : new Date("2100-01-01");

    const rows = await Appointment.find({
      dataConsulta: { $gte: from, $lte: to },
    }).lean();

    const concluded = rows.filter((row) =>
      ["realizada", "falta"].includes(row.status)
    );

    const calculateRate = (items: typeof rows) => {
      const valid = items.filter((row) =>
        ["realizada", "falta"].includes(row.status)
      );
      const misses = valid.filter((row) => row.status === "falta").length;
      return {
        total: valid.length,
        faltas: misses,
        taxaFalta: valid.length ? misses / valid.length : 0,
      };
    };

    const byDoctor = await Promise.all(
      [...new Set(rows.map((row) => row.medicoId))].map(async (medicoId) => {
        const doctor = await Doctor.findOne({ id: medicoId }).lean();
        return {
          medicoId,
          medicoNome: doctor?.nome ?? medicoId,
          ...calculateRate(rows.filter((row) => row.medicoId === medicoId)),
        };
      })
    );

    const byType = ["convenio", "particular"].map((tipo) => ({
      tipoAtendimento: tipo,
      ...calculateRate(rows.filter((row) => row.tipoAtendimento === tipo)),
    }));

    const byWeekday = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"]
      .map((_, weekday) => {
        const items = rows.filter((row) => row.dataConsulta.getDay() === weekday);
        return {
          weekday,
          ...calculateRate(items),
        };
      });

    res.json({
      periodo: { from, to },
      geral: calculateRate(concluded),
      porMedico: byDoctor,
      porTipo: byType,
      porDiaSemana: byWeekday,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/agendamentos/:id/risco", async (req, res, next) => {
  try {
    res.json(await calculateRisk(req.params.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/agendamentos/:id/confirmacao", async (req, res, next) => {
  try {
    const appointment = await Appointment.findOne({ id: req.params.id }).lean();

    if (!appointment) {
      return res.status(404).json({ message: "Agendamento não encontrado." });
    }

    const risk = await calculateRisk(req.params.id);

    res.json({
      sucesso: true,
      canal: req.body?.canal ?? "whatsapp",
      simulacao: true,
      mensagem: `SIMULAÇÃO: confirmação enviada para ${appointment.pacienteNome}.`,
      risco: risk,
    });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Dados inválidos.", details: error.issues });
  }
  res.status(500).json({ message: "Erro interno do servidor." });
});

connectDatabase()
  .then(() => {
    app.listen(Number(process.env.PORT ?? 3000), () => {
      console.log("API em http://localhost:3000");
    });
  })
  .catch((error) => {
    console.error("Falha ao conectar no MongoDB", error);
    process.exit(1);
  });
