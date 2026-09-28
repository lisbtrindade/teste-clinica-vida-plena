import { describe, expect, it } from "vitest";

describe("perfil de risco", () => {
  it("define a regra de elegibilidade usada no produto", () => {
    const faltas = 2;
    const concluidas = 3;
    const elegivel = faltas >= 2 || (concluidas >= 2 && faltas / concluidas >= 0.5);
    expect(elegivel).toBe(true);
  });
});
