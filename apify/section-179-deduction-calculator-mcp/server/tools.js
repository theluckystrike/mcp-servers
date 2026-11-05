// One tool registry shared by the stdio and Cloudflare Worker entries.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AS_OF, ASSET_PAGES, ASSET_TYPES, DISCLAIMER, InputError, SOURCES, moreUrl, calculateSection179, calculateBonusDepreciation, getVehicleLimits, calculateAssetLoan, } from "./core.js";
export const SERVER_NAME = "section-179-deduction-calculator-mcp";
export const SERVER_VERSION = "1.0.0";
const money = (n) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const pct = (r) => `${Math.round(r * 1000) / 10}%`;
const usd = (d) => z.number().min(0).max(1e11).describe(d);
const date = (d) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe(d);
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
const S179_PAGE = "/section-179-deduction-calculator/";
export function registerTools(server) {
    server.registerTool("calculate_section_179", {
        title: "Section 179 deduction (2025-2026)",
        description: "Calculates the Section 179 expense deduction as Form 4562 Part I does, with the limits raised by the One Big Beautiful Bill Act: $2,500,000 for 2025 with a dollar-for-dollar phase-out above $4,000,000 of section 179 property (2025 Form 4562 instructions, Pub. 946), and $2,560,000 / $4,090,000 for 2026 (Rev. Proc. 2025-32 section 4.24). Applies the business income limit and reports the carryover. 2027 limits are not published yet (checked 2026-11-02) and the tool says so.",
        inputSchema: {
            tax_year: z.number().int().min(2025).max(2027).describe("Tax year the property is placed in service: 2025 or 2026."),
            total_section_179_property_cost: usd("Total cost of all section 179 property placed in service in the year (Form 4562 line 2)."),
            elected_cost: usd("Amount you elect to expense. Defaults to the most allowed.").optional(),
            business_taxable_income: z.number().min(-1e11).max(1e11).optional().describe("Taxable income from the active conduct of your trades or businesses, including wages (Form 4562 line 11). Leave out to skip the income limit."),
        },
        annotations: { ...RO, title: "Section 179 deduction (2025-2026)" },
    }, async (a) => run(() => {
        const r = calculateSection179(a);
        const s = `${r.tax_year} Section 179 limit ${money(r.maximum_deduction)}. ${r.reduction > 0 ? `Property cost ${money(r.total_section_179_property_cost)} is ${money(r.reduction)} over the ${money(r.phase_out_threshold)} threshold, so the limit drops to ${money(r.dollar_limit_after_phase_out)}.` : `Property cost ${money(r.total_section_179_property_cost)} is under the ${money(r.phase_out_threshold)} threshold, so the full limit applies.`} Elected ${money(r.elected_cost)}. Deduction this year ${money(r.deduction)}${r.carryover_to_next_year > 0 ? `, ${money(r.carryover_to_next_year)} carried forward because of the business income limit` : ""}.`;
        return reply(s, r, r.tax_year === 2026 ? SOURCES.revProc2026 : `${SOURCES.i4562} ; ${SOURCES.p946}`, S179_PAGE);
    }));
    server.registerTool("calculate_bonus_depreciation", {
        title: "Bonus depreciation rate and amount (168(k))",
        description: "Finds the special (bonus) depreciation rate under IRC 168(k) from the acquisition and placed-in-service dates and applies it after any Section 179 deduction. The One Big Beautiful Bill Act made it 100% permanently for property acquired after January 19, 2025 (written binding contract date), with an election to take 40% (60% for long production property and certain aircraft) in the first tax year ending after that date. Property acquired before January 20, 2025 keeps the TCJA phase-down: 40% if placed in service in 2025 (60% long production). Rules from IRS Notice 2026-11, the 2025 Form 4562 instructions and Pub. 946.",
        inputSchema: {
            acquired_date: date("Acquisition date, YYYY-MM-DD. Use the date a written binding contract was signed if earlier than delivery."),
            placed_in_service_date: date("Date the property was placed in service, YYYY-MM-DD."),
            depreciable_basis: usd("Depreciable basis (business share of cost) in USD."),
            section_179_deduction: usd("Section 179 amount already taken on this property; bonus applies to what is left.").optional(),
            long_production_or_aircraft: z.boolean().optional().describe("True for long production period property or certain noncommercial aircraft."),
            elect_reduced_rate: z.boolean().optional().describe("True to elect 40% (60%) instead of 100% for property acquired after Jan 19, 2025 and placed in service in the first tax year ending after that date."),
            elect_out: z.boolean().optional().describe("True if you elect out of bonus depreciation for this class of property."),
        },
        annotations: { ...RO, title: "Bonus depreciation rate and amount (168(k))" },
    }, async (a) => run(() => {
        const r = calculateBonusDepreciation(a);
        const s = `Acquired ${r.acquired_date}, placed in service ${r.placed_in_service_date}: bonus rate ${pct(r.bonus_rate)} (${r.regime}). On ${money(r.basis_after_section_179)} of basis after Section 179 the special depreciation allowance is ${money(r.special_depreciation_allowance)}, leaving ${money(r.remaining_basis_for_macrs)} for regular MACRS. First-year Section 179 plus bonus: ${money(r.first_year_section_179_plus_bonus)}.`;
        return reply(s, r, `${SOURCES.notice202611} ; ${SOURCES.i4562} ; ${SOURCES.p946}`, S179_PAGE);
    }));
    server.registerTool("get_vehicle_depreciation_limits", {
        title: "Vehicle limits: heavy SUV cap and luxury auto caps",
        description: "Returns the first-year write-off limits for a business vehicle by gross vehicle weight rating: passenger automobiles of 6,000 lb or less are held to the IRC 280F caps ($20,300 first year with bonus, $12,300 without, for 2026 per Rev. Proc. 2026-15; $20,200 / $12,200 for 2025 per Rev. Proc. 2025-16), heavy SUVs over 6,000 and up to 14,000 lb have a Section 179 cap of $31,300 (2025) or $32,000 (2026) with bonus depreciation for the rest, and vehicles over 14,000 lb or exempt designs have no vehicle cap. Applies the more-than-50% business use rule and scales by business use.",
        inputSchema: {
            tax_year: z.number().int().min(2025).max(2027).describe("Year placed in service: 2025 or 2026."),
            gvwr_lbs: z.number().min(0).max(200000).describe("Gross vehicle weight rating in pounds (driver door sticker)."),
            cost: usd("Vehicle cost in USD.").optional(),
            business_use_percent: z.number().min(0).max(100).optional().describe("Business use share, 0-100. Default 100."),
            bonus_eligible: z.boolean().optional().describe("False if bonus depreciation is not taken (elected out). Default true."),
            exempt_from_suv_cap: z.boolean().optional().describe("True for a 6,001-14,000 lb vehicle that seats more than nine behind the driver, has a cargo bed of at least 6 feet, or is an enclosed cargo van."),
        },
        annotations: { ...RO, title: "Vehicle limits: heavy SUV cap and luxury auto caps" },
    }, async (a) => run(() => {
        const r = getVehicleLimits(a);
        const s = `${r.gvwr_lbs} lb GVWR in ${r.tax_year}: ${r.category.replace(/_/g, " ")}. ${r.rules[0]}${r.first_year_maximum_deduction !== null ? ` Maximum first-year deduction${r.cost !== null ? ` on a ${money(r.cost)} vehicle` : ""} at ${r.business_use_percent}% business use: ${money(r.first_year_maximum_deduction)}.` : r.qualifies_for_179_and_bonus ? "" : " Business use is 50% or less, so no Section 179 or bonus depreciation."}`;
        return reply(s, r, `${r.tax_year === 2026 ? `${SOURCES.revProc202615} ; ${SOURCES.revProc2026}` : `${SOURCES.revProc202515} ; ${SOURCES.p946}`}`, a.gvwr_lbs > 6000 ? "/commercial-vehicle-loan-calculator/" : S179_PAGE);
    }));
    server.registerTool("calculate_asset_loan_payment", {
        title: "Asset loan payment and after-tax cost",
        description: "Calculates the exact monthly payment, total interest and first-year interest for an equipment, truck, tractor, RV, land, manufactured home, ATV, pontoon or other asset loan, and, for business assets, the after-tax cost: first-year tax saving from the Section 179 or bonus deduction plus deductible interest at your marginal rate, first-year net cash, and lifetime after-tax cost. Pair it with calculate_section_179 for the deduction amount.",
        inputSchema: {
            price: usd("Purchase price in USD."),
            down_payment: usd("Down payment in USD. Default 0.").optional(),
            apr_percent: z.number().min(0).max(60).describe("Annual percentage rate, e.g. 7.5."),
            term_months: z.number().int().min(1).max(480).describe("Loan term in months."),
            asset_type: z.enum(ASSET_TYPES).optional().describe("Type of asset, used to link the matching calculator page."),
            business_use_percent: z.number().min(0).max(100).optional().describe("Business use share 0-100. Give this or marginal_tax_rate to get the after-tax cost."),
            marginal_tax_rate: z.number().min(0).max(0.6).optional().describe("Combined marginal tax rate as a decimal, e.g. 0.30."),
            first_year_deduction: usd("Section 179 plus bonus deduction taken in year 1. Defaults to the full business share of the price.").optional(),
        },
        annotations: { ...RO, title: "Asset loan payment and after-tax cost" },
    }, async (a) => run(() => {
        const r = calculateAssetLoan(a);
        const at = r.after_tax;
        const s = `Financing ${money(r.amount_financed)} at ${r.apr_percent}% APR for ${r.term_months} months: ${money(r.monthly_payment)} a month, ${money(r.total_interest)} total interest, ${money(r.first_12_months.interest)} interest in the first 12 months.${at ? ` With a ${money(at.first_year_deduction)} first-year deduction at a ${pct(at.marginal_tax_rate)} rate, year-1 tax saving is ${money(at.first_year_tax_saving)}, so year-1 net cash is ${money(at.first_year_net_cash)}. After-tax total cost over the loan: ${money(at.after_tax_total_cost)}.` : ""}`;
        const page = ASSET_PAGES[(a.asset_type ?? "other")];
        return reply(s, r, `${SOURCES.p946} ; ${SOURCES.revProc2026}`, page);
    }));
}
export function createServer() {
    const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
    registerTools(server);
    return server;
}
