import test from 'node:test';
import assert from 'node:assert';
import { monthlyPayment, validateInputs, calculateAmortization } from '../src/loan.js';

test('rejects zero or negative inputs', () => {
  assert.ok(validateInputs(-1000, 5, 2)?.isError);
  assert.ok(validateInputs(1000, -5, 2)?.isError);
  assert.ok(validateInputs(1000, 5, 0)?.isError);
  assert.ok(validateInputs(NaN, 5, 2)?.isError);
});

test('calculates 0% interest loan accurately', () => {
  const pmt = monthlyPayment(1200, 0, 1);
  assert.strictEqual(pmt, 100);
});

test('normal loan amortization ends with 0 balance', () => {
  const lines = calculateAmortization(10000, 6, 2);
  const lastLine = lines[lines.length - 1];
  assert.ok(lastLine.includes('balance $0') || lastLine.includes('balance $0.00'), `Expected zero balance in: ${lastLine}`);
});

test('handles 2.5 year term properly', () => {
  const lines = calculateAmortization(10000, 6, 2.5);
  const lastLine = lines[lines.length - 1];
  assert.strictEqual(lines.length, 3);
  assert.ok(lastLine.includes('balance $0') || lastLine.includes('balance $0.00'), `Expected zero balance in: ${lastLine}`);
});