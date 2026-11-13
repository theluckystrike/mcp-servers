import { money } from './_shared.js';

export function monthlyPayment(P, annualRate, years) {
  const r = annualRate / 100 / 12, n = years * 12;
  if (r === 0) return P / n;
  return P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}

export function validateInputs(principal, annual_rate, years) {
  if (
    principal <= 0 ||
    annual_rate < 0 ||
    years <= 0 ||
    !isFinite(principal) ||
    !isFinite(annual_rate) ||
    !isFinite(years)
  ) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Error: principal, annual_rate, and years must be positive finite numbers.' }]
    };
  }
  return null;
}

export function calculateAmortization(principal, annual_rate, years) {
  const r = annual_rate / 100 / 12, totalMonths = Math.round(years * 12);
  let bal = principal;
  const lines = [];

  let currentMonth = 0;
  for (let y = 1; currentMonth < totalMonths; y++) {
    let pi = 0, ia = 0;
    const monthsInThisYear = Math.min(12, totalMonths - currentMonth);

    for (let m = 0; m < monthsInThisYear; m++) {
      const i = bal * r;
      const p = monthlyPayment(bal, annual_rate, (totalMonths - currentMonth) / 12);
      pi += p;
      ia += i;
      bal -= (p - i);
      currentMonth++;

      if (currentMonth === totalMonths) {
        bal = 0;
      }
    }

    if (Math.abs(bal) < 0.05) {
      bal = 0;
    }
    
    lines.push(`Year ${y}: principal $${money(pi)}, interest $${money(ia)}, balance $${money(Math.max(0, bal))}`);
  }
  return lines;
}