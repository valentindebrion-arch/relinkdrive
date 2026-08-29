/** Validation d'un numéro SIREN français (9 chiffres, clé de Luhn). */
export function isValidSiren(value: string | null | undefined): boolean {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 9) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let n = Number(digits[8 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}
