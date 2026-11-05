// One tool registry shared by the stdio and Cloudflare Worker entries.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AS_OF, DISCLAIMER, FILING_STATUSES, InputError, SOURCES, VEHICLE_TYPES, moreUrl, calculateCarLoanInterestDeduction, calculateSaltDeduction, calculateChildTaxCredit, getBracketsAndStandardDeduction, } from "./core.js";
export const SERVER_NAME = "car-loan-interest-deduction-calculator-mcp";
export const SERVER_VERSION = "1.0.0";
const money = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const pct = (r) => `${Math.round(r * 1000) / 10}%`;
const filingStatus = z.enum(FILING_STATUSES).describe("Federal filing status.");
const magi = z.number().min(0).max(1e10).describe("Modified adjusted gross income in USD (Form 1040 line 11b plus excluded foreign and Puerto Rico income).");
const usd = (d) => z.number().min(0).max(1e10).describe(d);
function reply(summary, data, source, morePath) {
    const body = { ...data, summary, as_of: AS_OF, source, more: moreUrl(morePath), disclaimer: DISCLAIMER };
    return {
        content: [
            { type: "text", text: `${summary}\n\n${DISCLAIMER}` },
            { type: "text", text: JSON.stringify(body, null, 2) },
        ],
        structuredContent: body,
    };
}
function run(fn) {
    try {
        return fn();
    }
    catch (e) {
        const msg = e instanceof InputError ? e.message : `Unexpected error: ${e.message}`;
        return { isError: true, content: [{ type: "text", text: msg }] };
    }
}
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export function registerTools(server) {
    server.registerTool("calculate_car_loan_interest_deduction", {
        title: "Car loan interest deduction (2025-2028)",
        description: "Calculates the 2025-2028 federal deduction for car loan interest created by the One Big Beautiful Bill Act (P.L. 119-21, IRC 163(h)(4)) the way IRS Schedule 1-A Part IV does: up to $10,000 of qualified passenger vehicle loan interest, then $200 off for each $1,000 or part of $1,000 of MAGI over $100,000 ($200,000 married filing jointly), so it reaches $0 at $149,001 ($249,001 joint). Checks the eligibility tests: loan originated after Dec 31 2024, new vehicle, final assembly in the US, personal use, car/minivan/van/SUV/pickup/motorcycle under 14,000 lb GVWR, first lien, not a lease. Available whether or not you itemize. Rules copied from the 2025 Schedule 1-A, Form 1040 instructions and IRS Notice 2025-57.",
        inputSchema: {
            filing_status: filingStatus,
            magi,
            tax_year: z.number().int().min(2025).max(2028).describe("Tax year, 2025 to 2028. The deduction ends after 2028."),
            interest_paid: usd("Interest paid or accrued on the vehicle loan in the year, in USD (the lender's year-end statement)."),
            interest_deducted_elsewhere: usd("Part of that interest already deducted on Schedule C, E or F. It cannot be deducted twice.").optional(),
            loan_origination_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Date the loan was originated, YYYY-MM-DD. Must be after 2024-12-31."),
            new_vehicle: z.boolean().optional().describe("True if the original use starts with you (new). Used vehicles do not qualify."),
            us_final_assembly: z.boolean().optional().describe("True if final assembly was in the United States (vehicle label or NHTSA VIN decoder)."),
            personal_use: z.boolean().optional().describe("True if you expect personal use more than 50% of the time."),
            vehicle_type: z.enum(VEHICLE_TYPES).optional().describe("car, minivan, van, suv, pickup, motorcycle or other."),
            gvwr_under_14000_lbs: z.boolean().optional().describe("True if the gross vehicle weight rating is under 14,000 pounds."),
            secured_by_first_lien: z.boolean().optional().describe("True if the loan is secured by a first lien on the vehicle."),
            is_lease: z.boolean().optional().describe("True if this is a lease. Lease payments never qualify."),
            marginal_tax_rate: z.number().min(0).max(0.37).optional().describe("Your federal marginal rate as a decimal (e.g. 0.22) to estimate the tax saved."),
        },
        annotations: { ...RO, title: "Car loan interest deduction (2025-2028)" },
    }, async (a) => run(() => {
        const r = calculateCarLoanInterestDeduction(a);
        const p = r.phaseout;
        const phase = p.steps > 0
            ? `MAGI ${money(r.magi)} is ${money(p.excess_magi)} over the ${money(p.threshold)} threshold: ${p.steps} step(s) of $200 remove ${money(p.reduction)}.`
            : `MAGI ${money(r.magi)} is not over the ${money(p.threshold)} threshold, so nothing is phased out.`;
        const s = r.eligible
            ? `Interest counted ${money(r.interest_counted)}, ${money(r.amount_after_cap)} after the $10,000 cap. ${phase} Car loan interest deduction for ${r.tax_year}: ${money(r.deduction)}.${r.estimated_tax_saving !== undefined ? ` At a ${pct(a.marginal_tax_rate)} rate that saves about ${money(r.estimated_tax_saving)} of federal income tax.` : ""}${r.assumed_requirements.length ? ` Assumed: ${r.assumed_requirements.join("; ")}.` : ""}`
            : `This loan does not qualify for the ${r.tax_year} car loan interest deduction: ${r.failed_requirements.join(" ")} The deduction is $0.`;
        return reply(s, r, `${SOURCES.schedule1a} ; ${SOURCES.instructions1040} ; ${SOURCES.notice202557}`, "/car-loan-interest-calculator/");
    }));
    server.registerTool("calculate_salt_deduction", {
        title: "SALT deduction cap (2025-2030)",
        description: "Calculates the deductible state and local tax (SALT) on Schedule A under the One Big Beautiful Bill Act cap (IRC 164(b)(6)-(7)): $40,000 for 2025 and $40,400 for 2026 ($20,000 / $20,200 married filing separately), rising 1% a year through 2029, reduced by 30% of MAGI over $500,000 (2025) or $505,000 (2026) but never below $10,000, then back to a flat $10,000 in 2030. Uses the IRS State and Local Tax Deduction Worksheet. Optionally compares itemizing with the standard deduction. Amounts copied from the 2025 Schedule A instructions, the 2026 draft Schedule A and the statute.",
        inputSchema: {
            filing_status: filingStatus,
            magi,
            tax_year: z.number().int().min(2025).max(2035).describe("Tax year, 2025 or later. 2027-2029 amounts are the statutory 101% steps; 2030 on is $10,000."),
            state_and_local_taxes: usd("State and local income (or sales) tax plus real estate and personal property tax paid in the year (Schedule A line 5d)."),
            other_itemized_deductions: usd("Other itemized deductions (mortgage interest, gifts to charity, medical over the floor). Give it to compare itemizing with the standard deduction.").optional(),
        },
        annotations: { ...RO, title: "SALT deduction cap (2025-2030)" },
    }, async (a) => run(() => {
        const r = calculateSaltDeduction(a);
        const pd = r.phase_down;
        const phase = pd.applies
            ? `MAGI is ${money(pd.excess_magi)} over the ${money(pd.threshold)} threshold, so the cap drops by 30% of that (${money(pd.reduction_30_percent)}) to ${money(r.cap_after_phase_down)}.`
            : `The cap for ${r.tax_year} is ${money(r.cap_after_phase_down)}.`;
        const cmp = r.comparison;
        const s = `State and local taxes paid ${money(r.state_and_local_taxes)}. ${phase} Deductible SALT: ${money(r.deduction)}${r.amount_lost_to_cap > 0 ? ` (${money(r.amount_lost_to_cap)} is over the cap)` : ""}.${cmp ? ` Itemized total ${money(cmp.total_itemized)} vs standard deduction ${money(cmp.standard_deduction)}: ${cmp.better_choice === "itemize" ? "itemizing is larger" : "the standard deduction is larger"}.` : ""}${r.irs_published_amounts ? "" : " The cap for this year is computed from the statute, not yet printed by the IRS."}`;
        return reply(s, r, `${SOURCES.scheduleAInstr} ; ${SOURCES.scheduleA2026Draft} ; ${SOURCES.irc164}`, "/salt-deduction-calculator/");
    }));
    server.registerTool("get_tax_brackets_and_standard_deduction", {
        title: "2025 and 2026 federal brackets and standard deduction",
        description: "Returns the official 2025 and 2026 federal income tax brackets and standard deductions after the One Big Beautiful Bill Act: 2026 standard deduction $16,100 single, $32,200 joint, $24,150 head of household (Rev. Proc. 2025-32), 2025 $15,750 / $31,500 / $23,625, plus the additional amount for age 65 or blind. Optionally computes the tax and marginal rate on a taxable income. Says plainly that 2027 amounts are not yet published (checked against the Internal Revenue Bulletin and irs-drop on 2026-11-02).",
        inputSchema: {
            tax_year: z.number().int().min(2025).max(2027).describe("2025 or 2026. 2027 returns a not-yet-published error."),
            filing_status: filingStatus.optional().describe("Leave out to get all filing statuses."),
            taxable_income: usd("Taxable income to compute tax on (needs filing_status).").optional(),
        },
        annotations: { ...RO, title: "2025 and 2026 federal brackets and standard deduction" },
    }, async (a) => run(() => {
        const r = getBracketsAndStandardDeduction(a);
        const sds = r.tables.map((t) => `${t.filing_status.replace(/_/g, " ")} ${money(t.standard_deduction)}`).join(", ");
        const top = r.tables[0];
        const s = `Standard deduction for ${r.tax_year}: ${sds}. ${top.filing_status.replace(/_/g, " ")} brackets: ${top.brackets.map((b) => `${pct(b.rate)} over ${money(b.over)}`).join(", ")}.${r.computed ? ` Tax on ${money(r.computed.taxable_income)} of taxable income: ${money(r.computed.tax)}, marginal rate ${pct(r.computed.marginal_rate)}.` : ""}`;
        return reply(s, r, r.tax_year === 2026 ? SOURCES.revProc2026 : `${SOURCES.revProc2025} ; ${SOURCES.instructions1040}`, "/standard-deduction-calculator/");
    }));
    server.registerTool("calculate_child_tax_credit", {
        title: "Child tax credit (2025-2026)",
        description: "Calculates the child tax credit as Schedule 8812 does after the One Big Beautiful Bill Act: $2,200 per qualifying child under 17 for 2025 and 2026, $500 per other dependent, reduced by 5% of MAGI over $400,000 joint / $200,000 others (excess rounded up to the next $1,000), limited by tax liability, with the refundable additional child tax credit of up to $1,700 per child at 15% of earned income over $2,500. Amounts from the 2025 Schedule 8812 and Rev. Proc. 2025-32.",
        inputSchema: {
            filing_status: filingStatus,
            magi,
            tax_year: z.number().int().min(2025).max(2027).describe("2025 or 2026. 2027 is not yet published."),
            qualifying_children: z.number().int().min(0).max(20).describe("Children under 17 at year end with a valid SSN."),
            other_dependents: z.number().int().min(0).max(20).optional().describe("Other dependents (credit for other dependents, $500 each)."),
            earned_income: usd("Earned income for the refundable part. Defaults to MAGI.").optional(),
            tax_liability_before_credits: usd("Income tax before credits (Form 1040 line 18). Estimated from MAGI if left out.").optional(),
        },
        annotations: { ...RO, title: "Child tax credit (2025-2026)" },
    }, async (a) => run(() => {
        const r = calculateChildTaxCredit(a);
        const s = `Credit before phase-out ${money(r.credit_before_phaseout)} (${r.qualifying_children} child(ren) x $2,200${r.other_dependents ? ` + ${r.other_dependents} other dependent(s) x $500` : ""}).${r.phaseout.reduction > 0 ? ` MAGI over ${money(r.phaseout.threshold)} cuts it by ${money(r.phaseout.reduction)}.` : ""} Nonrefundable credit ${money(r.nonrefundable_credit)}${r.tax_liability_is_estimate ? " (tax liability estimated)" : ""}, refundable additional child tax credit ${money(r.additional_child_tax_credit)}, total ${money(r.total_benefit)} for ${r.tax_year}.`;
        return reply(s, r, `${r.tax_year === 2026 ? SOURCES.revProc2026 : SOURCES.schedule8812} ; ${SOURCES.schedule8812Instr}`, "/how-much-is-the-child-tax-credit-worth/");
    }));
}
export function createServer() {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    registerTools(server);
    return server;
}
