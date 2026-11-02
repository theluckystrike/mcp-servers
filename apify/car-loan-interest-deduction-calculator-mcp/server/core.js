// Pure calculation core for the 2025-2028 car loan interest deduction (One Big Beautiful
// Bill Act, P.L. 119-21, IRC 163(h)(4)), the 2025-2029 SALT cap (IRC 164(b)(6)-(7)),
// the child tax credit and the 2025/2026 brackets and standard deduction. No I/O.
// Every number was copied from a document fetched on 2026-11-02; see DATA_SOURCES.md.
export const AS_OF = "2026-11-02";
export const REPO = "car-loan-interest-deduction-calculator-mcp";
export const DISCLAIMER = "This is an estimate, not tax advice. Check the IRS instructions or ask a tax professional before you file.";
export const FILING_STATUSES = [
    "single",
    "married_filing_jointly",
    "married_filing_separately",
    "head_of_household",
    "qualifying_surviving_spouse",
];
export const SOURCES = {
    schedule1a: "https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf",
    instructions1040: "https://www.irs.gov/pub/irs-pdf/i1040gi.pdf",
    notice202557: "https://www.irs.gov/pub/irs-drop/n-25-57.pdf",
    scheduleAInstr: "https://www.irs.gov/pub/irs-pdf/i1040sca.pdf",
    scheduleA2026Draft: "https://www.irs.gov/pub/irs-dft/f1040sa--dft.pdf",
    irc164: "https://www.law.cornell.edu/uscode/text/26/164",
    revProc2026: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
    revProc2025: "https://www.irs.gov/pub/irs-drop/rp-24-40.pdf",
    schedule8812: "https://www.irs.gov/pub/irs-pdf/f1040s8.pdf",
    schedule8812Instr: "https://www.irs.gov/pub/irs-pdf/i1040s8.pdf",
    irb: "https://www.irs.gov/irb",
};
const SITE = "https://taxbreakcalc.com";
export function moreUrl(path) {
    return `${SITE}${path}?utm_source=mcp&utm_medium=${REPO}`;
}
export class InputError extends Error {
}
export function round2(x) {
    return Math.round((x + Number.EPSILON) * 100) / 100;
}
function nonNeg(name, v) {
    if (v === undefined || !Number.isFinite(v) || v < 0)
        throw new InputError(`${name} must be a number of 0 or more.`);
    return v;
}
const isJoint = (fs) => fs === "married_filing_jointly";
const INF = Number.POSITIVE_INFINITY;
export const PUBLISHED_YEARS = [2025, 2026];
const BRACKETS = {
    2025: {
        joint: [[23850, 0.1], [96950, 0.12], [206700, 0.22], [394600, 0.24], [501050, 0.32], [751600, 0.35], [INF, 0.37]],
        hoh: [[17000, 0.1], [64850, 0.12], [103350, 0.22], [197300, 0.24], [250500, 0.32], [626350, 0.35], [INF, 0.37]],
        single: [[11925, 0.1], [48475, 0.12], [103350, 0.22], [197300, 0.24], [250525, 0.32], [626350, 0.35], [INF, 0.37]],
        mfs: [[11925, 0.1], [48475, 0.12], [103350, 0.22], [197300, 0.24], [250525, 0.32], [375800, 0.35], [INF, 0.37]],
    },
    2026: {
        joint: [[24800, 0.1], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [INF, 0.37]],
        hoh: [[17700, 0.1], [67450, 0.12], [105700, 0.22], [201750, 0.24], [256200, 0.32], [640600, 0.35], [INF, 0.37]],
        single: [[12400, 0.1], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [INF, 0.37]],
        mfs: [[12400, 0.1], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [384350, 0.35], [INF, 0.37]],
    },
};
// 2025: Form 1040 instructions (OBBBA amounts). 2026: Rev. Proc. 2025-32 section 4.14.
export const STANDARD_DEDUCTION = {
    2025: { single: 15750, joint: 31500, hoh: 23625, mfs: 15750, additional_married: 1600, additional_unmarried: 2000 },
    2026: { single: 16100, joint: 32200, hoh: 24150, mfs: 16100, additional_married: 1650, additional_unmarried: 2050 },
};
function tableKey(fs) {
    if (fs === "married_filing_jointly" || fs === "qualifying_surviving_spouse")
        return "joint";
    if (fs === "head_of_household")
        return "hoh";
    if (fs === "married_filing_separately")
        return "mfs";
    return "single";
}
export function requirePublished(year) {
    if (year === 2025 || year === 2026)
        return year;
    throw new InputError(`The IRS has not published brackets, standard deductions or child tax credit amounts for ${year}. On ${AS_OF} the latest inflation revenue procedure is Rev. Proc. 2025-32 (tax year 2026); no 2027 revenue procedure was in the Internal Revenue Bulletin or irs-drop. Use 2025 or 2026.`);
}
export function standardDeduction(fs, year) {
    const s = STANDARD_DEDUCTION[year];
    return s[tableKey(fs)];
}
export function bracketTable(fs, year) {
    const t = BRACKETS[year][tableKey(fs)];
    let lower = 0;
    return t.map(([upTo, rate]) => {
        const row = { rate, over: lower, not_over: upTo === INF ? null : upTo };
        lower = upTo;
        return row;
    });
}
export function incomeTax(taxable, fs, year) {
    const t = BRACKETS[year][tableKey(fs)];
    let tax = 0, lower = 0, marginal = t[0][1];
    for (const [upTo, rate] of t) {
        if (taxable > lower) {
            tax += (Math.min(taxable, upTo) - lower) * rate;
            marginal = rate;
        }
        lower = upTo;
    }
    return { tax: round2(tax), marginal_rate: marginal };
}
export function getBracketsAndStandardDeduction(input) {
    const year = requirePublished(input.tax_year);
    const statuses = input.filing_status ? [input.filing_status] : ["single", "married_filing_jointly", "married_filing_separately", "head_of_household"];
    const tables = statuses.map((fs) => ({
        filing_status: fs,
        standard_deduction: standardDeduction(fs, year),
        brackets: bracketTable(fs, year),
    }));
    const sd = STANDARD_DEDUCTION[year];
    let computed;
    if (input.taxable_income !== undefined) {
        if (!input.filing_status)
            throw new InputError("Give filing_status together with taxable_income.");
        const ti = nonNeg("taxable_income", input.taxable_income);
        const r = incomeTax(ti, input.filing_status, year);
        computed = { taxable_income: ti, tax: r.tax, marginal_rate: r.marginal_rate, average_rate: ti > 0 ? round2((r.tax / ti) * 10000) / 10000 : 0 };
    }
    return {
        tax_year: year,
        tables,
        additional_standard_deduction_65_or_blind: { married_or_surviving_spouse: sd.additional_married, unmarried: sd.additional_unmarried },
        computed,
        year_2027_status: `Not published by the IRS as of ${AS_OF}.`,
    };
}
// ---------------------------------------------------------------- car loan interest (Schedule 1-A Part IV)
export const CAR_LOAN = { cap: 10000, single: 100000, joint: 200000, step: 1000, perStep: 200, firstYear: 2025, lastYear: 2028 };
export const VEHICLE_TYPES = ["car", "minivan", "van", "suv", "pickup", "motorcycle", "other"];
export function calculateCarLoanInterestDeduction(input) {
    const y = input.tax_year;
    if (!Number.isInteger(y) || y < CAR_LOAN.firstYear || y > CAR_LOAN.lastYear) {
        throw new InputError(`tax_year must be 2025 to 2028. IRC 163(h)(4) applies to taxable years beginning after Dec 31, 2024 and before Jan 1, 2029, so ${y} has no car loan interest deduction.`);
    }
    const magi = nonNeg("magi", input.magi);
    const paid = nonNeg("interest_paid", input.interest_paid);
    const elsewhere = input.interest_deducted_elsewhere === undefined ? 0 : nonNeg("interest_deducted_elsewhere", input.interest_deducted_elsewhere);
    const failed = [];
    const assumed = [];
    const check = (v, okText, failText) => {
        if (v === false)
            failed.push(failText);
        else if (v === undefined)
            assumed.push(okText);
    };
    if (input.loan_origination_date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.loan_origination_date) || Number.isNaN(Date.parse(input.loan_origination_date))) {
            throw new InputError("loan_origination_date must be YYYY-MM-DD.");
        }
        if (input.loan_origination_date <= "2024-12-31")
            failed.push(`The loan was originated on ${input.loan_origination_date}. Only loans originated after December 31, 2024 qualify.`);
    }
    else
        assumed.push("the loan was originated after December 31, 2024");
    if (input.is_lease === true)
        failed.push("Lease payments do not qualify. The loan must be used to purchase the vehicle.");
    check(input.new_vehicle, "the original use of the vehicle starts with you (new, not used)", "A used vehicle does not qualify. The original use must start with you.");
    check(input.us_final_assembly, "final assembly took place in the United States", "The vehicle must have undergone final assembly in the United States (see the vehicle information label or the NHTSA VIN decoder).");
    check(input.personal_use, "you expect personal use more than 50% of the time", "The vehicle must be bought for personal use (more than 50% personal use expected when the loan is incurred).");
    check(input.gvwr_under_14000_lbs, "the gross vehicle weight rating is under 14,000 pounds", "The gross vehicle weight rating must be less than 14,000 pounds.");
    check(input.secured_by_first_lien, "the loan is secured by a first lien on the vehicle", "The loan must be secured by a first lien on the vehicle.");
    if (input.vehicle_type === "other")
        failed.push("Only a car, minivan, van, SUV, pickup truck or motorcycle qualifies.");
    else if (input.vehicle_type === undefined)
        assumed.push("the vehicle is a car, minivan, van, SUV, pickup truck or motorcycle");
    const threshold = isJoint(input.filing_status) ? CAR_LOAN.joint : CAR_LOAN.single;
    const eligible = failed.length === 0;
    const line23 = Math.max(0, paid - elsewhere);
    const line24 = eligible ? Math.min(line23, CAR_LOAN.cap) : 0;
    const excess = Math.max(0, magi - threshold);
    // Schedule 1-A line 28: divide by $1,000 and round UP to the next whole number. Line 29: x $200.
    const steps = Math.ceil(excess / CAR_LOAN.step);
    const reduction = steps * CAR_LOAN.perStep;
    const deduction = Math.max(0, line24 - reduction);
    const fullPhaseoutMagi = threshold + (CAR_LOAN.cap / CAR_LOAN.perStep - 1) * CAR_LOAN.step + 1;
    let estimated_tax_saving;
    if (input.marginal_tax_rate !== undefined) {
        if (!(input.marginal_tax_rate >= 0 && input.marginal_tax_rate <= 0.37))
            throw new InputError("marginal_tax_rate must be between 0 and 0.37 (e.g. 0.22).");
        estimated_tax_saving = round2(deduction * input.marginal_tax_rate);
    }
    return {
        eligible,
        failed_requirements: failed,
        assumed_requirements: assumed,
        filing_status: input.filing_status,
        tax_year: y,
        magi,
        interest_paid: paid,
        interest_deducted_elsewhere: elsewhere,
        interest_counted: line23,
        cap: CAR_LOAN.cap,
        amount_after_cap: line24,
        phaseout: { threshold, excess_magi: round2(excess), steps, reduction, rule: "$200 for each $1,000 (or part of $1,000) of MAGI over the threshold" },
        deduction,
        deduction_reaches_zero_at_magi: fullPhaseoutMagi,
        estimated_tax_saving,
        schedule_1a_lines: { line23, line24, line25_magi: magi, line26_threshold: threshold, line28_steps: steps, line29_reduction: reduction, line30_deduction: deduction },
        notes: [
            "You can claim it whether you itemize or take the standard deduction (Schedule 1-A Part IV).",
            "You must enter the vehicle identification number (VIN) on the return.",
            "Married filing separately can claim it; the threshold is $100,000 for every status except married filing jointly.",
            "Interest on negative equity rolled in from a trade-in, insurance or a trailer does not count. Service plans, extended warranties, sales tax and vehicle fees financed with the purchase do.",
            "A refinanced loan keeps qualifying up to the balance refinanced if it stays secured by a first lien on the same vehicle.",
        ],
    };
}
// ---------------------------------------------------------------- SALT cap (IRC 164(b)(6)-(7))
// 2025: $40,000 / $500,000 (2025 Schedule A instructions). 2026: $40,400 / $505,000 (2026 draft
// Schedule A; IRC 164(b)(7)). 2027-2029: 101% of the prior year (IRC 164(b)(7)(A)(iii), (B)(ii)(III)),
// not yet printed by the IRS. 2030 on: $10,000, no phase-down. Floor $10,000. Rate 30%.
export const SALT_YEARS = [2025, 2026, 2027, 2028, 2029, 2030];
export function saltParameters(year) {
    if (!Number.isInteger(year) || year < 2025)
        throw new InputError("tax_year must be 2025 or later. Before 2025 the cap was a flat $10,000 ($5,000 married filing separately).");
    if (year >= 2030)
        return { cap: 10000, threshold: null, irs_published: false, phase_down: false };
    let cap = 40000, threshold = 500000;
    if (year >= 2026) {
        cap = 40400;
        threshold = 505000;
    }
    for (let y = 2027; y <= year; y++) {
        cap = round2(cap * 1.01);
        threshold = round2(threshold * 1.01);
    }
    return { cap, threshold, irs_published: year <= 2026, phase_down: true };
}
export function calculateSaltDeduction(input) {
    const year = input.tax_year;
    const p = saltParameters(year);
    const magi = nonNeg("magi", input.magi);
    const taxes = nonNeg("state_and_local_taxes", input.state_and_local_taxes);
    const mfs = input.filing_status === "married_filing_separately";
    const floor = 10000;
    let line9, reduction = 0, excess = 0, thresholdUsed = null;
    if (p.threshold === null) {
        line9 = floor;
    }
    else {
        thresholdUsed = mfs ? round2(p.threshold / 2) : p.threshold;
        excess = Math.max(0, magi - thresholdUsed);
        reduction = round2(excess * 0.3);
        line9 = Math.max(round2(p.cap - reduction), floor);
    }
    const cap_after_phase_down = mfs ? round2(line9 / 2) : line9;
    const deduction = Math.min(taxes, cap_after_phase_down);
    let comparison;
    if (input.other_itemized_deductions !== undefined) {
        const other = nonNeg("other_itemized_deductions", input.other_itemized_deductions);
        const sdYear = year === 2025 ? 2025 : 2026;
        const sd = standardDeduction(input.filing_status, sdYear);
        const itemized = round2(deduction + other);
        comparison = {
            total_itemized: itemized,
            standard_deduction: sd,
            standard_deduction_year_used: sdYear,
            standard_deduction_is_estimate: year > 2026,
            better_choice: itemized > sd ? "itemize" : "standard_deduction",
            difference: round2(Math.abs(itemized - sd)),
        };
    }
    return {
        filing_status: input.filing_status,
        tax_year: year,
        magi,
        state_and_local_taxes: taxes,
        cap: mfs ? round2(p.cap / 2) : p.cap,
        statutory_cap_full_return: p.cap,
        phase_down: p.threshold === null
            ? { applies: false, note: "From 2030 the cap returns to $10,000 ($5,000 married filing separately) with no income phase-down." }
            : { applies: excess > 0, threshold: thresholdUsed, excess_magi: round2(excess), reduction_30_percent: reduction, floor: mfs ? 5000 : 10000 },
        cap_after_phase_down,
        deduction,
        amount_lost_to_cap: round2(taxes - deduction),
        irs_published_amounts: p.irs_published,
        comparison,
        notes: [
            ...(p.irs_published ? [] : year < 2030 ? [`The ${year} cap and threshold are 101% of the prior year as IRC 164(b)(7) requires. The IRS has not printed them on a form yet, so its rounding may differ by a few dollars.`] : []),
            "The SALT deduction only helps if you itemize on Schedule A.",
            "MAGI here is Form 1040 line 11b plus excluded foreign and Puerto Rico income.",
        ],
    };
}
// ---------------------------------------------------------------- child tax credit (Schedule 8812)
// 2025: $2,200 per child, $1,700 refundable (2025 Schedule 8812 and instructions).
// 2026: $2,200 and $1,700 (Rev. Proc. 2025-32 section 4.05). $500 other dependents.
// Phase-out: 5% of MAGI over $400,000 joint / $200,000 others, excess rounded UP to the next $1,000.
export const CTC = {
    2025: { perChild: 2200, refundable: 1700 },
    2026: { perChild: 2200, refundable: 1700 },
};
export function calculateChildTaxCredit(input) {
    const year = requirePublished(input.tax_year);
    const magi = nonNeg("magi", input.magi);
    const kids = input.qualifying_children;
    const others = input.other_dependents ?? 0;
    if (!Number.isInteger(kids) || kids < 0 || kids > 20)
        throw new InputError("qualifying_children must be a whole number from 0 to 20.");
    if (!Number.isInteger(others) || others < 0 || others > 20)
        throw new InputError("other_dependents must be a whole number from 0 to 20.");
    const c = CTC[year];
    const line5 = kids * c.perChild;
    const line7 = others * 500;
    const line8 = line5 + line7;
    const threshold = isJoint(input.filing_status) ? 400000 : 200000;
    const rawExcess = Math.max(0, magi - threshold);
    const line10 = Math.ceil(rawExcess / 1000) * 1000;
    const line11 = round2(line10 * 0.05);
    const line12 = Math.max(0, round2(line8 - line11));
    let liability, liabilityEstimated = false;
    if (input.tax_liability_before_credits !== undefined)
        liability = nonNeg("tax_liability_before_credits", input.tax_liability_before_credits);
    else {
        liabilityEstimated = true;
        liability = incomeTax(Math.max(0, magi - standardDeduction(input.filing_status, year)), input.filing_status, year).tax;
    }
    const line14 = Math.min(line12, liability);
    const earned = input.earned_income === undefined ? magi : nonNeg("earned_income", input.earned_income);
    const line16a = round2(line12 - line14);
    const line16b = kids * c.refundable;
    const line17 = Math.min(line16a, line16b);
    const line20 = round2(Math.max(0, earned - 2500) * 0.15);
    const actc = line16a > 0 && line16b > 0 ? Math.min(line17, line20) : 0;
    return {
        filing_status: input.filing_status,
        tax_year: year,
        magi,
        qualifying_children: kids,
        other_dependents: others,
        credit_per_child: c.perChild,
        refundable_limit_per_child: c.refundable,
        credit_before_phaseout: line8,
        phaseout: { threshold, excess_rounded_up: line10, reduction: line11, rule: "5% of MAGI over the threshold, with the excess rounded up to the next $1,000" },
        credit_after_phaseout: line12,
        tax_liability_used: liability,
        tax_liability_is_estimate: liabilityEstimated,
        nonrefundable_credit: round2(line14),
        additional_child_tax_credit: round2(actc),
        total_benefit: round2(line14 + actc),
        unused_credit: round2(line12 - line14 - actc),
        earned_income_used: earned,
        schedule_8812_lines: { line5, line7, line8, line9: threshold, line10, line11, line12, line14: round2(line14), line16a, line16b, line17, line20, line27: round2(actc) },
        notes: [
            "Each qualifying child must be under 17 at the end of the year and have an SSN valid for employment issued by the return due date. From 2025 the taxpayer (or at least one spouse on a joint return) also needs a valid SSN.",
            "The $500 credit for other dependents is not refundable.",
            ...(liabilityEstimated ? ["Tax liability was estimated as federal income tax on MAGI minus the basic standard deduction. Give tax_liability_before_credits for an exact result."] : []),
            "The refundable part uses 15% of earned income over $2,500. The alternative for three or more children based on social security and Medicare tax (Schedule 8812 lines 21-26) is not modeled.",
        ],
    };
}
