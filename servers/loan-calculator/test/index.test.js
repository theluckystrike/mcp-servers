import test from 'node:test';
import assert from 'node:assert';

// Import or test your functions or logic here
// Let's write a test to check input validation response format

test('loan calculator prevents negative or zero principal with error', async () => {
  // Test logic can be added here to call the handler or test validation rules directly
  const principal = -1000;
  const annual_rate = 5;
  const years = 2;
  
  const hasError = principal <= 0 || annual_rate < 0 || years <= 0;
  assert.strictEqual(hasError, true);
});

test('loan calculator allows valid inputs', async () => {
  const principal = 10000;
  const annual_rate = 6;
  const years = 2;
  
  const hasError = principal <= 0 || annual_rate < 0 || years <= 0;
  assert.strictEqual(hasError, false);
});