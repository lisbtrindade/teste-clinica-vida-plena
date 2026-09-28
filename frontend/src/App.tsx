import { useEffect, useState } from "react";

type Indicator = {
  geral: { total: number; faltas: number; taxaFalta: number };
  porMedico: Array<{ medicoId: string; medicoNome: string; total: number; faltas: number; taxaFalta: number }>;
  porTipo: Array<{ tipoAtendimento: string; total: number; faltas: number; taxaFalta: number }>;
};

type Appointment = {
  id: string;
  pacienteNome: string;
  pacienteTelefone?: string;
  medicoId: string;
  dataConsulta: string;
  status: string;
};

const api = async (url: string, options?: RequestInit) => {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message ?? "Erro na requisição");
  }

  return data;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function App() {
  const [from, setFrom] = useState("2025-09-01");
  const [to, setTo] = useState("2026-11-30");
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [indicatorData, appointmentData] = await Promise.all([
        api(`/api/indicadores?from=${from}&to=${to}`),
        api(`/api/agendamentos?from=${from}&to=${to}`),
      ]);
      setIndicator(indicatorData);
      setAppointments(appointmentData);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar dados");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function sendConfirmation(id: string) {
    try {
      const result = await api(`/api/agendamentos/${id}/confirmacao`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal: "whatsapp" }),
      });

      setMessage(`${result.mensagem} Risco: ${result.risco.level}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro");
    }
  }

  return (
    <main className="container">
      <header>
        <div>
          <span className="eyebrow">CLÍNICA VIDA PLENA</span>
          <h1>Indicadores de agendamento</h1>
          <p>Acompanhe faltas e execute confirmações reforçadas.</p>
        </div>
      </header>

      <section className="filters card">
        <div>
          <label>De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label>Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button onClick={load}>Aplicar período</button>
      </section>

      {message && <div className="message">{message}</div>}

      {indicator && (
        <>
          <section className="cards">
            <article className="metric card">
              <span>Taxa de falta</span>
              <strong>{(indicator.geral.taxaFalta * 100).toFixed(1)}%</strong>
              <small>{indicator.geral.faltas} faltas em {indicator.geral.total} consultas concluídas</small>
            </article>
            <article className="metric card">
              <span>Consultas analisadas</span>
              <strong>{indicator.geral.total}</strong>
              <small>Somente realizadas e faltas entram na taxa</small>
            </article>
          </section>

          <section className="card">
            <div className="section-title">
              <div>
                <h2>Taxa por médico</h2>
                <p>Recorte do período selecionado.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Médico</th>
                    <th>Consultas</th>
                    <th>Faltas</th>
                    <th>Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {indicator.porMedico.map((doctor) => (
                    <tr key={doctor.medicoId}>
                      <td>{doctor.medicoNome}</td>
                      <td>{doctor.total}</td>
                      <td>{doctor.faltas}</td>
                      <td>{(doctor.taxaFalta * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <div className="section-title">
              <div>
                <h2>Confirmação reforçada</h2>
                <p>Envio simulado para a recepção testar o fluxo.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>Consulta</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.slice(0, 30).map((appointment) => (
                    <tr key={appointment.id}>
                      <td>{appointment.pacienteNome}</td>
                      <td>{formatDate(appointment.dataConsulta)}</td>
                      <td><span className={`status ${appointment.status}`}>{appointment.status}</span></td>
                      <td>
                        {["agendada", "confirmada"].includes(appointment.status) && (
                          <button
                            className="secondary"
                            onClick={() => sendConfirmation(appointment.id)}
                          >
                            Simular confirmação
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
