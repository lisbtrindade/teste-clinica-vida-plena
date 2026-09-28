import { describe, expect, it } from "vitest";
import { canTransition, validateStatusDate } from "./rules";

describe("regras de status", () => {
  it("permite agendada -> confirmada", () => {
    expect(canTransition("agendada", "confirmada")).toBe(true);
  });

  it("bloqueia alteração de status final", () => {
    expect(canTransition("falta", "confirmada")).toBe(false);
  });

  it("bloqueia falta antes da consulta", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    expect(validateStatusDate("falta", future)).toBeTruthy();
  });

  it("bloqueia cancelamento depois da consulta", () => {
    const past = new Date(Date.now() - 60 * 60 * 1000);
    expect(validateStatusDate("cancelada_paciente", past)).toBeTruthy();
  });
});
