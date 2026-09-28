import { Doctor } from "../models";

const weekdayNames = [
  "domingo",
  "segunda",
  "terca",
  "quarta",
  "quinta",
  "sexta",
  "sabado",
];

function minutesFromTime(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function isWithinDoctorSchedule(
  medicoId: string,
  date: Date
): Promise<boolean> {
  const doctor = await Doctor.findOne({ id: medicoId }).lean();

  if (!doctor) {
    return false;
  }

  const day = weekdayNames[date.getDay()];
  const currentMinutes = date.getHours() * 60 + date.getMinutes();

  return doctor.grade.some((slot) => {
    if (slot.dia !== day) return false;

    const start = minutesFromTime(slot.inicio);
    const end = minutesFromTime(slot.fim);

    return (
      currentMinutes >= start &&
      currentMinutes < end &&
      currentMinutes % 30 === 0
    );
  });
}
