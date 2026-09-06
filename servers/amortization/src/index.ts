#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createLicenseGate, withFileLock } from "@theluckystrike/mcp-license";
import { currencyDecimals, formatMoney } from "@theluckystrike/mcp-asset-register/lib";
import { isIsoDate, today } from "@theluckystrike/mcp-quotes/lib";
import { z } from "zod";
import { VERSION } from "./version.js";
import { CASH, INTEREST_EXPENSE, LOAN_LIABILITY, accountName } from "./accounts.js";
import { dataDir, findLoan, getLoans, lockPath, nextLoanId, setLoans, type Loan } from "./store.js";
import {
  FREQUENCIES, MAX_MINOR, MAX_PERIODS, MAX_RATE_BPS, METHODS, PERIODS_PER_YEAR,
  buildSchedule, effectiveAnnualRate, periodicRate, repayEarly, scheduleIsExact, toBps,
  type Frequency, type LoanTerms, type Method, type Row, type Schedule,
} from "./schedule.js";

/**
 * Free tier: THREE loans in the register, and their schedules with no limit at all.
 *
 * The schedule is the answer, so it is never metered: a borrower who cannot see what the
 * payment is has been sold a demo. The meter is on the number of AGREEMENTS held, which
 * is the unit of work, and rebuilding the schedule of a loan already in the register is
 * free forever, on every tier.
 */
const FREE_LOANS = 3;
const MAX_ROWS = 600;
const MAX_NAME = 200;

const gate = createLicenseGate({ product: "amortization" });

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });
const fail = (text: string) => ({ content: [{ type: "text" as const, text: `Error: ${text}` }], isError: true as const });
const json = (v: unknown) => ok(JSON.stringify(v, null, 2));

const str = (field: string, max: number) => z.string().max(max, `${field} must be ${max} characters or fewer`);

/** Only this server's own register is written, so there is one lock and it is this one. */
function locked<T>(fn: () => T | Promise<T>): Promise<T> {
  return withFileLock(lockPath(), fn, { timeoutMs: 20000 });
}

function checkDate(value: string, field: string): string {
  if (!isIsoDate(value)) throw new Error(`cannot read a date: ${field} "${value}" is not a real date in YYYY-MM-DD form. Nothing was written.`);
  return value;
}

function checkMonth(value: string): string {
  const m = String(value).trim();
  if (!/^\d{4}-\d{2}$/.test(m) || Number(m.slice(5)) < 1 || Number(m.slice(5)) > 12) {
    throw new Error(`month "${value}" is not a month in YYYY-MM form. Nothing was written.`);
  }
  return m;
}

function requirePro(feature: string, toolName: string): void {
  if (!gate.isPro()) throw new Error(`${feature} is Pro. Nothing was written. ${gate.upgradeText(feature, toolName)}`);
}

/**
 * The identity of an agreement, for the duplicate guard: every stored term, normalised.
 *
 * Name and lender are trimmed and case-folded, the currency is uppercased, and the note is
 * left out, because a note is a remark ABOUT an agreement and never a second one. Two
 * records with the same fingerprint are the same paper recorded twice, and the second one
 * costs a free-tier slot while telling the reader nothing the first does not.
 */
function fingerprint(l: {
  name: string; lender?: string; kind: string; principal_minor: number; currency: string;
  rate_bps: number; compounding: Frequency; payment_frequency: Frequency; term_periods: number;
  method: Method; start_date: string; fees_minor: number; balloon_minor: number;
}): string {
  const fold = (v: string | undefined) => String(v ?? "").trim().toLowerCase();
  return JSON.stringify([
    fold(l.name), l.principal_minor, l.currency.toUpperCase(), l.rate_bps, l.compounding,
    l.payment_frequency, l.term_periods, l.method, l.start_date, l.fees_minor, l.balloon_minor,
    l.kind, fold(l.lender),
  ]);
}

function terms(l: Loan): LoanTerms {
  return {
    principal_minor: l.principal_minor, currency: l.currency, rate_bps: l.rate_bps,
    compounding: l.compounding, payment_frequency: l.payment_frequency,
    term_periods: l.term_periods, method: l.method, start_date: l.start_date,
    fees_minor: l.fees_minor, balloon_minor: l.balloon_minor,
  };
}

function scheduleOf(l: Loan): Schedule {
  const t = terms(l);
  const s = buildSchedule(t);
  if (!scheduleIsExact(t, s)) {
    // Unreachable by construction; asserted here rather than trusted, because a schedule
    // that does not close is the one defect a reader cannot see by looking at a row.
    throw new Error(`the schedule for ${l.id} does not close on the balloon. Refusing to answer with it.`);
  }
  return s;
}

const money = (minor: number, currency: string) => formatMoney(minor, currency);

function rowJson(r: Row, currency: string) {
  return {
    period: r.period, date: r.date,
    opening: money(r.opening_minor, currency), opening_minor: r.opening_minor,
    payment: money(r.payment_minor, currency), payment_minor: r.payment_minor,
    interest: money(r.interest_minor, currency), interest_minor: r.interest_minor,
    principal: money(r.principal_minor, currency), principal_minor: r.principal_minor,
    closing: money(r.closing_minor, currency), closing_minor: r.closing_minor,
  };
}

function loanSummary(l: Loan) {
  return {
    id: l.id, name: l.name, lender: l.lender, kind: l.kind,
    principal: money(l.principal_minor, l.currency), principal_minor: l.principal_minor,
    currency: l.currency,
    nominal_annual_rate_bps: l.rate_bps, nominal_annual_rate_pct: (l.rate_bps / 100).toFixed(2),
    effective_annual_rate_bps: l.effective_annual_rate_bps,
    effective_annual_rate_pct: (l.effective_annual_rate_bps / 100).toFixed(2),
    compounding: l.compounding, payment_frequency: l.payment_frequency,
    term_periods: l.term_periods, method: l.method, start_date: l.start_date,
    payment: money(l.payment_minor, l.currency), payment_minor: l.payment_minor,
    fees_minor: l.fees_minor, balloon_minor: l.balloon_minor,
  };
}

const BASIS =
  "Every figure is derived from the stored terms on the call: no schedule is kept, because a stored schedule is a second copy of what the rate and the term already decide. " +
  "The payment never varies and the last period absorbs the rounding residual in its interest and principal split, so the closing balance reaches the balloon, or zero, exactly.";

/* ------------------------------------------------------------------- server */

const server = new McpServer(
  { name: "mcp-amortization", version: VERSION },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

const freqArg = z.enum(FREQUENCIES as [Frequency, ...Frequency[]]);
const loanArg = str("loan", MAX_NAME).describe("The loan id, e.g. LOAN-2026-0001, or its exact name");

server.registerTool("loan_create", {
  title: "Record a loan or lease",
  description: "Record a loan or a lease from its terms and return its id, its level payment and its effective annual rate. Principal, fees and balloon are whole minor units; the rate is nominal annual basis points.",
  inputSchema: {
    name: str("name", MAX_NAME).describe("What this agreement is, e.g. Van finance or Office lease"),
    principal_minor: z.number().int().min(1).max(MAX_MINOR).describe("Amount borrowed, in whole minor units (integer cents). 1,000,000 is EUR 10,000.00"),
    currency: z.string().regex(/^[A-Za-z]{3}$/, "currency must be a 3-letter ISO code such as EUR").describe("ISO code the agreement is denominated in"),
    rate_bps: z.number().int().min(0).max(MAX_RATE_BPS).describe("Nominal annual interest rate in basis points. 1200 is 12 percent. Zero is allowed"),
    compounding: freqArg.describe("How often interest compounds"),
    payment_frequency: freqArg.describe("How often a payment falls due"),
    term_periods: z.number().int().min(1).max(MAX_PERIODS).describe("Number of payment periods, not years"),
    method: z.enum(METHODS as [Method, ...Method[]]).describe("annuity for a level payment, straight-principal for equal principal and a falling payment"),
    start_date: str("start_date", 10).describe("Drawdown date, YYYY-MM-DD. The first payment falls one period after it"),
    fees_minor: z.number().int().min(0).optional().describe("Arrangement fees in whole minor units, paid at drawdown. Default 0"),
    balloon_minor: z.number().int().min(0).optional().describe("Final balloon or residual value in whole minor units, due with the last payment and not inside it. Default 0"),
    kind: z.enum(["loan", "lease"]).optional().describe('Default "loan"'),
    lender: str("lender", MAX_NAME).optional().describe("Who the money is owed to"),
    note: str("note", 2000).optional(),
  },
}, async (a) => {
  try {
    checkDate(a.start_date, "start_date");
    const currency = a.currency.toUpperCase();
    const t: LoanTerms = {
      principal_minor: a.principal_minor, currency, rate_bps: a.rate_bps,
      compounding: a.compounding, payment_frequency: a.payment_frequency,
      term_periods: a.term_periods, method: a.method, start_date: a.start_date,
      fees_minor: a.fees_minor ?? 0, balloon_minor: a.balloon_minor ?? 0,
    };
    const s = buildSchedule(t);
    const ear = effectiveAnnualRate(a.rate_bps, a.compounding);
    const i = periodicRate(a.rate_bps, a.compounding, a.payment_frequency);
    const notes = [...s.notes];
    if (t.fees_minor > 0) {
      notes.push(`Fees of ${money(t.fees_minor, currency)} are paid at drawdown and are NOT interest: they are outside the ${money(s.total_interest_minor, currency)} of interest and outside every payment row. The cost of credit is the two added together, ${money(s.total_interest_minor + t.fees_minor, currency)}.`);
    }
    if (a.compounding !== a.payment_frequency) {
      notes.push(`Interest compounds ${a.compounding} while payments fall ${a.payment_frequency}, so the rate for one payment period is the equivalent rate ${(i * 100).toFixed(6)} percent, not the nominal rate divided by ${PERIODS_PER_YEAR[a.payment_frequency]}.`);
    }
    const rec = await locked(() => {
      const list = getLoans();
      // Before the cap, and before anything is written: the duplicate is what the cap is
      // spent on, so the guard has to fire while there is still room to spend.
      const mine = fingerprint({ name: a.name, lender: a.lender, kind: a.kind ?? "loan", ...t });
      const twin = list.find((x) => fingerprint(x) === mine);
      if (twin) {
        throw new Error(
          `this agreement is already in the register as ${twin.id} "${twin.name}", term for term: ` +
          `name, principal, currency, rate, compounding, payment frequency, term, method, start date, fees, balloon, kind and lender all match. ` +
          `Nothing was written and no slot was used. Call loan_schedule with ${twin.id} to rebuild its schedule, free and unlimited. ` +
          `If this really is a second agreement on identical terms, give it a different name. ` +
          `If ${twin.id} was recorded in error, remove it with loan_delete and the slot comes back.`,
        );
      }
      if (!gate.isPro() && list.length >= FREE_LOANS) {
        throw new Error(
          `the free tier holds ${FREE_LOANS} loans and ${list.length} are already in the register. ` +
          `Every schedule stays free and unlimited. Nothing was written. ` + gate.upgradeText("an unlimited loan register", "loan_create"),
        );
      }
      const id = nextLoanId(a.start_date.slice(0, 4), list.map((x) => x.id));
      const now = new Date().toISOString();
      const loan: Loan = {
        id, name: a.name.trim(), lender: a.lender, kind: a.kind ?? "loan",
        ...t, payment_minor: s.payment_minor, effective_annual_rate_bps: toBps(ear),
        note: a.note, created: now, updated: now,
      };
      list.push(loan);
      setLoans(list);
      return loan;
    });
    if (!gate.isPro()) notes.push(`Free tier: ${getLoans().length} of ${FREE_LOANS} loans. loan_delete gives a slot back and is free. loan_repay_early, loan_journal and loans_report are Pro.`);
    return json({
      created: loanSummary(rec),
      periodic_rate_pct: (i * 100).toFixed(6),
      first_payment_date: s.rows[0].date,
      final_payment_date: s.rows[s.rows.length - 1].date,
      final_payment: money(s.final_payment_minor, currency), final_payment_minor: s.final_payment_minor,
      total_payments: money(s.total_payments_minor, currency), total_payments_minor: s.total_payments_minor,
      total_interest: money(s.total_interest_minor, currency), total_interest_minor: s.total_interest_minor,
      cost_of_credit_minor: s.total_interest_minor + t.fees_minor,
      notes, basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("loan_schedule", {
  title: "Build the amortization schedule",
  description: "Build the schedule for one loan: opening balance, payment, interest, principal and closing balance for every period, with the total interest. The closing balance reaches the balloon, or zero, exactly. Free.",
  inputSchema: {
    loan: loanArg,
    from_period: z.number().int().min(1).max(MAX_PERIODS).optional().describe("First period to return. Default 1"),
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe(`Maximum rows, default and ceiling ${MAX_ROWS}`),
    year: str("year", 4).optional().describe("Only the periods falling in this calendar year, YYYY"),
  },
}, async (a) => {
  try {
    const l = findLoan(getLoans(), a.loan);
    if (!l) throw new Error(`no loan matches "${a.loan}". Call loan_list to see the register.`);
    const s = scheduleOf(l);
    let rows = s.rows;
    if (a.year) {
      if (!/^\d{4}$/.test(a.year)) throw new Error(`year "${a.year}" is not a year in YYYY form.`);
      rows = rows.filter((r) => r.date.slice(0, 4) === a.year);
    }
    if (a.from_period) rows = rows.filter((r) => r.period >= a.from_period!);
    const shown = rows.slice(0, a.limit ?? MAX_ROWS);
    const interestShown = shown.reduce((x, r) => x + r.interest_minor, 0);
    return json({
      loan: loanSummary(l),
      periods: s.rows.length, matched: rows.length, returned: shown.length,
      payment: money(s.payment_minor, l.currency), payment_minor: s.payment_minor,
      final_payment: money(s.final_payment_minor, l.currency), final_payment_minor: s.final_payment_minor,
      total_payments: money(s.total_payments_minor, l.currency), total_payments_minor: s.total_payments_minor,
      total_interest: money(s.total_interest_minor, l.currency), total_interest_minor: s.total_interest_minor,
      interest_in_rows_shown_minor: interestShown,
      closing_balance: money(s.rows[s.rows.length - 1].closing_minor, l.currency),
      closing_balance_minor: s.rows[s.rows.length - 1].closing_minor,
      rows: shown.map((r) => rowJson(r, l.currency)),
      notes: s.notes,
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("loan_repay_early", {
  title: "Settle or overpay a loan early",
  description: "Work out what settling or overpaying costs as of a period: the outstanding balance, the penalty if one is given, the recalculated remaining schedule and the interest saved, stated gross and net of the penalty. Pro.",
  inputSchema: {
    loan: loanArg,
    as_of_period: z.number().int().min(1).max(MAX_PERIODS).describe("The period the extra money is paid at the end of. Period 1 is the first payment"),
    extra_minor: z.number().int().min(1).optional().describe("A partial overpayment in whole minor units. Omit to settle the loan in full"),
    penalty_minor: z.number().int().min(0).optional().describe("Early repayment charge in whole minor units. Default 0"),
    keep_payment: z.boolean().optional().describe("On a partial overpayment, keep the same payment and shorten the term. Default false, which keeps the term and lowers the payment"),
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe(`Maximum remaining rows to return, ceiling ${MAX_ROWS}`),
  },
}, async (a) => {
  try {
    requirePro("loan_repay_early", "loan_repay_early");
    const l = findLoan(getLoans(), a.loan);
    if (!l) throw new Error(`no loan matches "${a.loan}". Call loan_list to see the register.`);
    const t = terms(l);
    const s = scheduleOf(l);
    const r = repayEarly(t, s, a.as_of_period, { extra_minor: a.extra_minor, penalty_minor: a.penalty_minor, keep_payment: a.keep_payment });
    const full = r.remaining.length === 0;
    return json({
      loan: loanSummary(l),
      as_of_period: r.as_of_period, as_of_date: s.rows[r.as_of_period - 1].date,
      settlement: full ? "in full" : "partial overpayment",
      outstanding_after_that_payment: money(r.outstanding_minor, l.currency), outstanding_minor: r.outstanding_minor,
      penalty: money(r.penalty_minor, l.currency), penalty_minor: r.penalty_minor,
      pay_now: money(r.settle_now_minor, l.currency), pay_now_minor: r.settle_now_minor,
      interest_paid_to_date: money(r.interest_paid_minor, l.currency), interest_paid_minor: r.interest_paid_minor,
      interest_saved: money(r.interest_saved_minor, l.currency), interest_saved_minor: r.interest_saved_minor,
      interest_saved_net_of_penalty: money(r.interest_saved_net_minor, l.currency),
      interest_saved_net_minor: r.interest_saved_net_minor,
      worth_doing: r.interest_saved_net_minor > 0,
      new_payment: r.new_payment_minor === undefined ? undefined : money(r.new_payment_minor, l.currency),
      new_payment_minor: r.new_payment_minor,
      new_term_periods: r.new_term_periods,
      remaining_schedule: r.remaining.slice(0, a.limit ?? MAX_ROWS).map((x) => rowJson(x, l.currency)),
      periods_cancelled: r.cancelled.length,
      verdict: r.interest_saved_net_minor > 0
        ? `Repaying at period ${r.as_of_period} saves ${money(r.interest_saved_net_minor, l.currency)} after the penalty.`
        : `Repaying at period ${r.as_of_period} COSTS ${money(-r.interest_saved_net_minor, l.currency)}: the penalty of ${money(r.penalty_minor, l.currency)} is larger than the ${money(r.interest_saved_minor, l.currency)} of interest it saves.`,
      note: "Nothing was written: the stored loan still carries its original terms. This answers what would happen, and the agreement is amended by whoever signs it.",
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("loan_journal", {
  title: "Journal a loan payment",
  description: "Return the double entry for one payment period or one month: debit interest expense and loan liability, credit cash, in the cash book's account names, with an expense_add-ready payload. Pro.",
  inputSchema: {
    loan: loanArg,
    period: z.number().int().min(1).max(MAX_PERIODS).optional().describe("The payment period to journal. Give this or month"),
    month: str("month", 7).optional().describe("Journal every payment falling in this month, YYYY-MM. Give this or period"),
    interest_account: str("interest_account", MAX_NAME).optional().describe(`Debit account for the interest. Default "${INTEREST_EXPENSE}"`),
    liability_account: str("liability_account", MAX_NAME).optional().describe(`Debit account for the principal. Default "${LOAN_LIABILITY}"`),
    cash_account: str("cash_account", MAX_NAME).optional().describe(`Credit account for the payment. Default "${CASH}"`),
    category: str("category", MAX_NAME).optional().describe('Expense category for the expense_add payload. Default "interest"'),
  },
}, async (a) => {
  try {
    requirePro("loan_journal", "loan_journal");
    const l = findLoan(getLoans(), a.loan);
    if (!l) throw new Error(`no loan matches "${a.loan}". Call loan_list to see the register.`);
    if ((a.period === undefined) === (a.month === undefined)) {
      throw new Error("give exactly one of period or month. A journal over both would post the same payment twice.");
    }
    const s = scheduleOf(l);
    let rows: Row[];
    let label: string;
    if (a.period !== undefined) {
      const row = s.rows.find((r) => r.period === a.period);
      if (!row) throw new Error(`period ${a.period} is past the end of a ${s.rows.length} period loan. Nothing was written.`);
      rows = [row];
      label = `period ${row.period}`;
    } else {
      const m = checkMonth(a.month!);
      rows = s.rows.filter((r) => r.date.slice(0, 7) === m);
      if (rows.length === 0) throw new Error(`no payment on ${l.id} falls in ${m}. The schedule runs ${s.rows[0].date} to ${s.rows[s.rows.length - 1].date}. Nothing was written.`);
      label = m;
    }
    const interestAcc = a.interest_account ?? INTEREST_EXPENSE;
    const liabilityAcc = a.liability_account ?? LOAN_LIABILITY;
    const cashAcc = a.cash_account ?? CASH;
    const interest = rows.reduce((x, r) => x + r.interest_minor, 0);
    const principal = rows.reduce((x, r) => x + r.principal_minor, 0);
    const payment = rows.reduce((x, r) => x + r.payment_minor, 0);
    const date = rows[rows.length - 1].date;
    const lines = [
      { account: interestAcc, account_name: accountName(interestAcc), debit_minor: interest, credit_minor: 0, debit: money(interest, l.currency), credit: money(0, l.currency), description: `Interest on ${l.id} ${l.name}, ${label}` },
      { account: liabilityAcc, account_name: accountName(liabilityAcc), debit_minor: principal, credit_minor: 0, debit: money(principal, l.currency), credit: money(0, l.currency), description: `Principal repaid on ${l.id} ${l.name}, ${label}` },
      { account: cashAcc, account_name: accountName(cashAcc), debit_minor: 0, credit_minor: payment, debit: money(0, l.currency), credit: money(payment, l.currency), description: `Payment on ${l.id} ${l.name}, ${label}` },
    ].filter((x) => x.debit_minor !== 0 || x.credit_minor !== 0);
    // The one dependency this server can see. A journal is an entry in somebody else's
    // ledger, and the terms behind it are here, so the agreement is pinned against
    // loan_delete from the moment the entry is handed out.
    await locked(() => {
      const list = getLoans();
      const rec = list.find((x) => x.id === l.id);
      if (!rec) return;
      const marks = new Set(rec.journalled ?? []);
      marks.add(label);
      rec.journalled = [...marks].sort();
      rec.updated = new Date().toISOString();
      setLoans(list);
    });
    const d = currencyDecimals(l.currency);
    return json({
      loan: { id: l.id, name: l.name, currency: l.currency },
      journal_for: label, date,
      periods: rows.map((r) => r.period),
      lines,
      totals: {
        debits_minor: interest + principal, credits_minor: payment,
        balanced: interest + principal === payment,
      },
      expense_add: interest === 0 ? null : {
        tool: "expense_add",
        server: "expense-tracker",
        arguments: {
          amount: Number((interest / 10 ** d).toFixed(d)),
          currency: l.currency,
          category: a.category ?? "interest",
          merchant: l.lender ?? l.name,
          date,
          note: `Interest on ${l.id} ${l.name}, ${label}. Principal of ${money(principal, l.currency)} is NOT an expense and is not in this payload.`,
          billable: false,
        },
      },
      note: "Only the interest is an expense. The principal repays a liability and belongs on the balance sheet, so the expense_add payload carries the interest alone: booking the whole payment would overstate the cost of the business by the principal, every period, and would still reconcile against the bank.",
      journalled: label,
      basis: "Nothing was posted. This is the entry for whoever owns the ledger to post; this server writes only its own loan register. " +
        `The label "${label}" is recorded against ${l.id} there, so loan_delete will refuse to remove an agreement an entry has already been taken from.`,
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("loan_list", {
  title: "List the loan register",
  description: "List the loans and leases in the register with their terms, the level payment, the effective annual rate and the balance outstanding at a date. Free and unlimited.",
  inputSchema: {
    currency: z.string().regex(/^[A-Za-z]{3}$/).optional().describe("Only agreements in this currency"),
    kind: z.enum(["loan", "lease"]).optional().describe("Only loans, or only leases"),
    as_of: str("as_of", 10).optional().describe("Value the register at this date, YYYY-MM-DD. Default today"),
    limit: z.number().int().min(1).max(MAX_ROWS).optional().describe(`Maximum rows, default and ceiling ${MAX_ROWS}`),
  },
}, async (a) => {
  try {
    const asOf = a.as_of ? checkDate(a.as_of, "as_of") : today();
    let rows = getLoans();
    if (a.currency) rows = rows.filter((x) => x.currency === a.currency!.toUpperCase());
    if (a.kind) rows = rows.filter((x) => x.kind === a.kind);
    const out = rows.slice(0, a.limit ?? MAX_ROWS).map((l) => {
      const s = scheduleOf(l);
      const paid = s.rows.filter((r) => r.date <= asOf);
      const outstanding = paid.length ? paid[paid.length - 1].closing_minor : l.principal_minor;
      const next = s.rows.find((r) => r.date > asOf);
      return {
        ...loanSummary(l),
        periods_paid: paid.length,
        outstanding: money(outstanding, l.currency), outstanding_minor: outstanding,
        interest_paid_to_date_minor: paid.reduce((x, r) => x + r.interest_minor, 0),
        next_payment_date: next?.date, next_payment_minor: next?.payment_minor,
        total_interest_minor: s.total_interest_minor,
      };
    });
    const totals = new Map<string, { currency: string; outstanding_minor: number; loans: number }>();
    for (const r of out) {
      const t = totals.get(r.currency) ?? { currency: r.currency, outstanding_minor: 0, loans: 0 };
      t.outstanding_minor += r.outstanding_minor; t.loans += 1;
      totals.set(r.currency, t);
    }
    return json({
      as_of: asOf, count: rows.length, returned: out.length, loans: out,
      outstanding_by_currency: [...totals.values()].map((t) => ({ ...t, outstanding: money(t.outstanding_minor, t.currency) })),
      tier: gate.isPro() ? "pro" : `free: ${rows.length} of ${FREE_LOANS} loans`,
      note: "Currencies are never added together. This server holds no exchange rate, so one number over a EUR loan and a USD one would be an invented one.",
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("loan_delete", {
  title: "Delete a loan from the register",
  description: "Remove one loan or lease from the register and give its free-tier slot back. Refused, with the entry named, if a journal has already been taken from it. Free.",
  inputSchema: {
    loan: loanArg,
  },
}, async (a) => {
  try {
    const removed = await locked(() => {
      const list = getLoans();
      const l = findLoan(list, a.loan);
      if (!l) throw new Error(`no loan matches "${a.loan}". Call loan_list to see the register. Nothing was deleted.`);
      const marks = l.journalled ?? [];
      if (marks.length > 0) {
        throw new Error(
          `${l.id} "${l.name}" has a journal taken from it and cannot be deleted: ${marks.length} entr${marks.length === 1 ? "y" : "ies"}, ${marks.join(", ")}. ` +
          `Those lines are in somebody's ledger and the terms behind them are here, so removing the agreement would leave them with nothing to check against. ` +
          `Nothing was deleted. Reverse the entries where they were posted first.`,
        );
      }
      setLoans(list.filter((x) => x.id !== l.id));
      return l;
    });
    const left = getLoans().length;
    const notes = [
      `${removed.id} is gone from the register. Its schedule was never stored, so nothing derived from it survives anywhere.`,
      `The number is not reissued: the ${removed.id.slice(0, 9)} series only ever counts up, so a later agreement cannot take an id that has been on a signed one.`,
    ];
    if (!gate.isPro()) notes.push(`Free tier: ${left} of ${FREE_LOANS} loans. The slot is back and loan_create will take another agreement.`);
    return json({
      deleted: loanSummary(removed),
      loans_left: left,
      tier: gate.isPro() ? "pro" : `free: ${left} of ${FREE_LOANS} loans`,
      notes,
      basis: "Only this server's own register was written. No journal, no expense and no ledger entry is touched by a delete: this server has never posted one, and a loan that HAS had one taken from it is refused rather than removed.",
    });
  } catch (e) { return fail((e as Error).message); }
});

server.registerTool("loans_report", {
  title: "Report what is owed and what it costs",
  description: "Report the debt: what is outstanding per currency, when each next payment falls due, and the interest charged in a calendar year, per loan and in total. Pro.",
  inputSchema: {
    as_of: str("as_of", 10).optional().describe("Value the debt at this date, YYYY-MM-DD. Default today"),
    year: str("year", 4).optional().describe("The calendar year to total the interest for, YYYY. Default the year of as_of"),
    currency: z.string().regex(/^[A-Za-z]{3}$/).optional().describe("Only agreements in this currency"),
  },
}, async (a) => {
  try {
    requirePro("loans_report", "loans_report");
    const asOf = a.as_of ? checkDate(a.as_of, "as_of") : today();
    const year = a.year ?? asOf.slice(0, 4);
    if (!/^\d{4}$/.test(year)) throw new Error(`year "${year}" is not a year in YYYY form.`);
    let list = getLoans();
    if (a.currency) list = list.filter((x) => x.currency === a.currency!.toUpperCase());
    const per = list.map((l) => {
      const s = scheduleOf(l);
      const paid = s.rows.filter((r) => r.date <= asOf);
      const outstanding = paid.length ? paid[paid.length - 1].closing_minor : l.principal_minor;
      const next = s.rows.find((r) => r.date > asOf);
      const inYear = s.rows.filter((r) => r.date.slice(0, 4) === year);
      return {
        id: l.id, name: l.name, kind: l.kind, currency: l.currency, lender: l.lender,
        outstanding: money(outstanding, l.currency), outstanding_minor: outstanding,
        settled: outstanding === l.balloon_minor && !next,
        next_payment_date: next?.date ?? null,
        next_payment: next ? money(next.payment_minor, l.currency) : null,
        next_payment_minor: next?.payment_minor ?? null,
        interest_this_year: money(inYear.reduce((x, r) => x + r.interest_minor, 0), l.currency),
        interest_this_year_minor: inYear.reduce((x, r) => x + r.interest_minor, 0),
        principal_this_year_minor: inYear.reduce((x, r) => x + r.principal_minor, 0),
        payments_this_year: inYear.length,
        balloon_minor: l.balloon_minor,
      };
    });
    const byCurrency = new Map<string, { currency: string; loans: number; outstanding_minor: number; interest_this_year_minor: number; payments_this_year: number }>();
    for (const r of per) {
      const t = byCurrency.get(r.currency) ?? { currency: r.currency, loans: 0, outstanding_minor: 0, interest_this_year_minor: 0, payments_this_year: 0 };
      t.loans += 1; t.outstanding_minor += r.outstanding_minor;
      t.interest_this_year_minor += r.interest_this_year_minor; t.payments_this_year += r.payments_this_year;
      byCurrency.set(r.currency, t);
    }
    const upcoming = per.filter((r) => r.next_payment_date).sort((x, y) => (x.next_payment_date! < y.next_payment_date! ? -1 : 1));
    return json({
      as_of: asOf, year, loans: per.length,
      outstanding_by_currency: [...byCurrency.values()].map((t) => ({
        ...t,
        outstanding: money(t.outstanding_minor, t.currency),
        interest_this_year: money(t.interest_this_year_minor, t.currency),
      })),
      next_payments: upcoming.map((r) => ({ id: r.id, name: r.name, date: r.next_payment_date, amount: r.next_payment, amount_minor: r.next_payment_minor, currency: r.currency })),
      per_loan: per,
      note: "The interest for the year is what the SCHEDULE charges, on the terms as stored. It is not what was actually paid: a missed or an early payment changes it, and neither is recorded here.",
      basis: BASIS,
    });
  } catch (e) { return fail((e as Error).message); }
});

gate.registerTools(server);

/* ------------------------------------------------------- resource and prompt */

server.registerResource("accounts", "loan://accounts", {
  title: "The accounts a loan payment touches, and where they are written",
  description: "The three account ids this server journals to, matching the cash book, and the one directory it writes.",
  mimeType: "application/json",
}, async () => ({
  contents: [{
    uri: "loan://accounts", mimeType: "application/json",
    text: JSON.stringify({
      accounts: [
        { account: CASH, name: accountName(CASH), side: "credit", note: "The cash book's own account id, character for character. A payment leaves cash in full, interest and principal together" },
        { account: INTEREST_EXPENSE, name: accountName(INTEREST_EXPENSE), side: "debit", note: "The only part of a payment that is a cost. This is what the expense_add payload carries" },
        { account: LOAN_LIABILITY, name: accountName(LOAN_LIABILITY), side: "debit", note: "The principal repaid. A balance sheet movement, never an expense" },
      ],
      frequencies: PERIODS_PER_YEAR,
      methods: METHODS,
      writes: [{ store: "amortization", dir: dataDir(), files: ["loans.json", "counter.json"] }],
      posts_to_any_other_store: false,
      today: today(),
    }, null, 2),
  }],
}));

server.registerPrompt("check_a_quote", {
  title: "Check a finance quote",
  description: "Check what a lender's quote actually costs: record the terms, read the effective rate, and see what settling early would save.",
  argsSchema: { name: z.string().describe("What the finance is for, e.g. Van finance") },
}, ({ name }) => ({
  messages: [{
    role: "user" as const,
    content: {
      type: "text" as const,
      text: `Check the finance quote for ${name}.\n\n` +
        `1. Call loan_create with the principal, the nominal annual rate in basis points, the compounding and payment frequency, the term in periods, the method, the start date, and any arrangement fee and balloon.\n` +
        `2. Compare the effective annual rate with the nominal one. The gap is what the compounding costs, and it is the number the quote usually leaves out.\n` +
        `3. Call loan_schedule and read the FIRST period: on an annuity most of the payment is interest, and that ratio is what makes an early settlement worth doing.\n` +
        `4. Call loan_repay_early at the period you might settle, with the lender's penalty. Read interest_saved_net_of_penalty, not interest_saved.`,
    },
  }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`mcp-amortization ${VERSION} ready; register at ${dataDir()}\n`);
