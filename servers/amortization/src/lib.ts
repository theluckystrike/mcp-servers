/**
 * The amortization engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, storage). Everything below it --
 * the rate arithmetic, the schedule, the early settlement and the loan store -- is
 * generic and is re-exported here so a sibling server can amortise a loan without a
 * second copy of the rules, and so a ledger can use the same three account ids.
 *
 * Nothing in this module touches the network.
 *
 * Stability: the names below are the contract. `dist/*.js` deep imports are not.
 */
export {
  FREQUENCIES, MAX_MINOR, MAX_PERIODS, MAX_RATE_BPS, METHODS, PERIODS_PER_YEAR,
  annuityPayment, buildSchedule, effectiveAnnualRate, nominalRate, paymentDate,
  periodicRate, repayEarly, scheduleIsExact, toBps, validateTerms,
} from "./schedule.js";
export type { EarlyResult, Frequency, LoanTerms, Method, Row, Schedule } from "./schedule.js";
export { ACCOUNT_NAMES, CASH, INTEREST_EXPENSE, LOAN_LIABILITY, accountName } from "./accounts.js";
export { dataDir, findLoan, getLoans, lockPath, nextLoanId, setLoans } from "./store.js";
export type { Loan } from "./store.js";
export { VERSION } from "./version.js";
