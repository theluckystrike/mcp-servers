// Pure calculation core for the Section 179 deduction, the 168(k) special (bonus) depreciation
// allowance as changed by the One Big Beautiful Bill Act (P.L. 119-21), the vehicle limits
// (IRC 179(b)(5) heavy SUV cap and IRC 280F passenger automobile caps) and asset loan payments.
// No I/O. Every number was copied from an irs.gov document fetched on 2026-11-02; see DATA_SOURCES.md.
export const AS_OF = "2026-11-02";
export const REPO = "section-179-deduction-calculator-mcp";
export const DISCLAIMER = "This is an estimate, not tax advice. Check Form 4562, its instructions and Pub. 946, or ask a tax professional before you file.";
export const SOURCES = {
    revProc2026: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf",
    i4562: "https://www.irs.gov/pub/irs-pdf/i4562.pdf",
    p946: "https://www.irs.gov/pub/irs-pdf/p946.pdf",
    notice202611: "https://www.irs.gov/pub/irs-drop/n-26-11.pdf",
    revProc202515: "https://www.irs.gov/pub/irs-drop/rp-25-16.pdf",
    revProc202615: "https://www.irs.gov/pub/irs-drop/rp-26-15.pdf",
    irb: "https://www.irs.gov/irb",
};
const SITE = "https://assetloancalculator.com";
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
// ---------------------------------------------------------------- Section 179 limits
// 2025: $2,500,000 / $4,000,000, SUV $31,300 (2025 Form 4562 instructions; Pub. 946 chapter 2).
// 2026: $2,560,000 / $4,090,000, SUV $32,000 (Rev. Proc. 2025-32 section 4.24).
export const LIMITS = {
    2025: { limit: 2500000, threshold: 4000000, suv: 31300 },
    2026: { limit: 2560000, threshold: 4090000, suv: 32000 },
};
export function requireYear(y) {
    if (y === 2025 || y === 2026)
        return y;
    if (y > 2026) {
        throw new InputError(`The IRS has not published the ${y} Section 179 limits. On ${AS_OF} the latest is Rev. Proc. 2025-32 (tax years beginning in 2026: $2,560,000, phase-out from $4,090,000); no 2027 inflation revenue procedure was in the Internal Revenue Bulletin or irs-drop. Use 2025 or 2026.`);
    }
    throw new InputError("tax_year must be 2025 or 2026. Earlier years used pre-OBBBA limits that this server does not cover.");
}
export function calculateSection179(input) {
    const year = requireYear(input.tax_year);
    const L = LIMITS[year];
    const total = nonNeg("total_section_179_property_cost", input.total_section_179_property_cost);
    const excess = Math.max(0, total - L.threshold);
    const dollarLimit = Math.max(0, L.limit - excess);
    const elected = input.elected_cost === undefined ? Math.min(total, dollarLimit) : nonNeg("elected_cost", input.elected_cost);
    if (elected > total)
        throw new InputError("elected_cost cannot be more than total_section_179_property_cost.");
    const tentative = Math.min(elected, dollarLimit);
    let deduction = tentative, carryover = 0, incomeLimit = null;
    if (input.business_taxable_income !== undefined) {
        if (!Number.isFinite(input.business_taxable_income))
            throw new InputError("business_taxable_income must be a number.");
        incomeLimit = Math.max(0, input.business_taxable_income);
        deduction = Math.min(tentative, incomeLimit);
        carryover = round2(tentative - deduction);
    }
    return {
        tax_year: year,
        maximum_deduction: L.limit,
        phase_out_threshold: L.threshold,
        total_section_179_property_cost: total,
        reduction: excess,
        dollar_limit_after_phase_out: dollarLimit,
        fully_phased_out_at: L.limit + L.threshold,
        elected_cost: elected,
        tentative_deduction: tentative,
        business_income_limit: incomeLimit,
        deduction,
        carryover_to_next_year: carryover,
        remaining_basis_for_bonus_and_macrs: round2(total - deduction - carryover),
        form_4562_lines: { line1: L.limit, line2: total, line3: L.threshold, line4: excess, line5: dollarLimit, line9_tentative: tentative, line11_business_income_limit: incomeLimit, line12: deduction, line13_carryover: carryover },
        notes: [
            "The reduction is dollar for dollar: every dollar of section 179 property placed in service above the threshold cuts the limit by one dollar.",
            "Married filing jointly counts as one taxpayer. Married filing separately splits the limit 50/50 unless both elect otherwise.",
            "The business income limit is taxable income from the active conduct of any trade or business, including wages. A disallowed amount carries forward.",
            "A heavy SUV (over 6,000 and up to 14,000 lb GVWR) is capped separately; use get_vehicle_depreciation_limits.",
            "Listed property (most vehicles) qualifies only if business use is more than 50%.",
        ],
    };
}
function isoDate(name, v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)))
        throw new InputError(`${name} must be YYYY-MM-DD.`);
    return v;
}
export function bonusRate(acquired, placed, lpp, electReduced) {
    const py = Number(placed.slice(0, 4));
    if (acquired < "2017-09-28") {
        throw new InputError("Property acquired before September 28, 2017 falls under the old 50% rules, which this server does not cover.");
    }
    if (acquired >= "2025-01-20") {
        if (electReduced) {
            if (py !== 2025)
                throw new InputError("The 40% (60% long production) election under IRC 168(k)(10) is only for the first tax year ending after January 19, 2025 (2025 for calendar-year taxpayers).");
            return { rate: lpp ? 0.6 : 0.4, regime: "OBBBA 168(k), elected reduced rate for the first tax year ending after Jan 19, 2025" };
        }
        return { rate: 1, regime: "OBBBA 168(k): 100% for property acquired after January 19, 2025 (permanent)" };
    }
    if (electReduced)
        throw new InputError("elect_reduced_rate applies only to property acquired after January 19, 2025.");
    // TCJA 168(k)(6): 100% through 2022, then down 20 points a year; long production property and certain aircraft one year later.
    const shift = lpp ? 1 : 0;
    const steps = Math.max(0, py - 2022 - shift);
    const rate = Math.max(0, 1 - 0.2 * steps);
    return { rate: round2(rate), regime: "TCJA 168(k)(6) phase-down for property acquired after September 27, 2017 and before January 20, 2025" };
}
export function calculateBonusDepreciation(input) {
    const acquired = isoDate("acquired_date", input.acquired_date);
    const placed = isoDate("placed_in_service_date", input.placed_in_service_date);
    if (placed < acquired)
        throw new InputError("placed_in_service_date cannot be before acquired_date.");
    const basis = nonNeg("depreciable_basis", input.depreciable_basis);
    const s179 = input.section_179_deduction === undefined ? 0 : nonNeg("section_179_deduction", input.section_179_deduction);
    if (s179 > basis)
        throw new InputError("section_179_deduction cannot be more than depreciable_basis.");
    const lpp = input.long_production_or_aircraft ?? false;
    const { rate, regime } = input.elect_out ? { rate: 0, regime: "Elected out under IRC 168(k)(7) for this class of property" } : bonusRate(acquired, placed, lpp, input.elect_reduced_rate ?? false);
    const basisAfter179 = round2(basis - s179);
    const bonus = round2(basisAfter179 * rate);
    return {
        acquired_date: acquired,
        placed_in_service_date: placed,
        long_production_or_aircraft: lpp,
        regime,
        bonus_rate: rate,
        depreciable_basis: basis,
        section_179_deduction: s179,
        basis_after_section_179: basisAfter179,
        special_depreciation_allowance: bonus,
        remaining_basis_for_macrs: round2(basisAfter179 - bonus),
        first_year_section_179_plus_bonus: round2(s179 + bonus),
        notes: [
            "Acquisition date is the date of a written binding contract, not delivery. Property under a binding contract signed before January 20, 2025 is treated as acquired before that date (Notice 2026-11 sec. 2.02 and 3.03).",
            "Qualified property: MACRS property with a recovery period of 20 years or less, off-the-shelf software, water utility property and qualified productions. Used property can qualify.",
            "Listed property (most vehicles) needs more than 50% business use.",
            ...(rate > 0 && rate < 1 && acquired < "2025-01-20" && Number(placed.slice(0, 4)) >= 2026
                ? ["This rate continues the TCJA phase-down (20 points a year) that Notice 2026-11 describes for property acquired before January 20, 2025. Confirm with a tax professional."]
                : []),
        ],
    };
}
// ---------------------------------------------------------------- vehicle limits
// IRC 280F limits: Rev. Proc. 2025-16 (placed in service 2025) and Rev. Proc. 2026-15 (2026).
export const AUTO_LIMITS = {
    2025: { with_bonus: [20200, 19600, 11800, 7060], without_bonus: [12200, 19600, 11800, 7060] },
    2026: { with_bonus: [20300, 19800, 11900, 7160], without_bonus: [12300, 19800, 11900, 7160] },
};
export function getVehicleLimits(input) {
    const year = requireYear(input.tax_year);
    const gvwr = nonNeg("gvwr_lbs", input.gvwr_lbs);
    const bu = input.business_use_percent ?? 100;
    if (!(bu >= 0 && bu <= 100))
        throw new InputError("business_use_percent must be between 0 and 100.");
    const cost = input.cost === undefined ? undefined : nonNeg("cost", input.cost);
    const bonusEligible = input.bonus_eligible ?? true;
    const qualifies = bu > 50;
    const f = bu / 100;
    const t = AUTO_LIMITS[year];
    let category, rules;
    let first_year_max = null;
    let section_179_cap = null;
    let yearly = null;
    if (gvwr <= 6000) {
        category = "passenger_automobile";
        const table = bonusEligible && qualifies ? t.with_bonus : t.without_bonus;
        yearly = table.map((x) => round2(x * f));
        first_year_max = cost === undefined ? yearly[0] : Math.min(yearly[0], round2(cost * f));
        rules = [
            `IRC 280F caps depreciation plus section 179 on a passenger automobile (6,000 lb or less) placed in service in ${year}: year 1 $${table[0].toLocaleString("en-US")}, year 2 $${table[1].toLocaleString("en-US")}, year 3 $${table[2].toLocaleString("en-US")}, each later year $${table[3].toLocaleString("en-US")}, multiplied by the business use share.`,
        ];
    }
    else if (gvwr <= 14000 && !input.exempt_from_suv_cap) {
        category = "heavy_suv_section_179_cap";
        section_179_cap = LIMITS[year].suv;
        if (cost !== undefined && qualifies) {
            const businessBasis = round2(cost * f);
            const s179 = Math.min(section_179_cap, businessBasis);
            const bonus = bonusEligible ? round2(businessBasis - s179) : 0;
            first_year_max = round2(s179 + bonus);
        }
        rules = [
            `Section 179 on a sport utility vehicle rated over 6,000 and up to 14,000 lb GVWR is capped at $${section_179_cap.toLocaleString("en-US")} for ${year}. The 280F passenger automobile caps do not apply, so 100% bonus depreciation can take the rest of the business basis.`,
            "The SUV cap does not apply to a vehicle that seats more than nine behind the driver, has an open or enclosed cargo area of at least 6 feet not readily reached from the passenger area, or is a cargo van with no seating behind the driver and no body section more than 30 inches ahead of the windshield. Set exempt_from_suv_cap for those.",
        ];
    }
    else {
        category = gvwr > 14000 ? "over_14000_lbs" : "heavy_vehicle_exempt_from_suv_cap";
        section_179_cap = LIMITS[year].limit;
        if (cost !== undefined && qualifies)
            first_year_max = round2(cost * f);
        rules = [
            "No vehicle-specific dollar cap: the general section 179 limit and bonus depreciation can cover the whole business basis.",
        ];
    }
    if (!qualifies) {
        first_year_max = null;
        rules.push("Business use is 50% or less, so neither section 179 nor bonus depreciation is allowed; use straight-line ADS depreciation.");
    }
    return {
        tax_year: year,
        gvwr_lbs: gvwr,
        category,
        business_use_percent: bu,
        qualifies_for_179_and_bonus: qualifies,
        bonus_eligible: bonusEligible,
        section_179_cap,
        passenger_auto_limits_by_year: yearly ? { year_1: yearly[0], year_2: yearly[1], year_3: yearly[2], each_later_year: yearly[3] } : null,
        cost: cost ?? null,
        first_year_maximum_deduction: first_year_max,
        rules,
    };
}
// ---------------------------------------------------------------- asset loan payment and after-tax cost
export const ASSET_PAGES = {
    equipment: "/equipment-loan-calculator/",
    tractor: "/tractor-loan-calculator/",
    semi_truck: "/semi-truck-loan-calculator/",
    commercial_truck: "/commercial-truck-loan-calculator/",
    commercial_vehicle: "/commercial-vehicle-loan-calculator/",
    farm: "/farm-loan-calculator/",
    aircraft: "/aircraft-loan-calculator/",
    trailer: "/trailer-loan-calculator/",
    rv: "/rv-loan-calculator/",
    motorcycle: "/motorcycle-loan-calculator/",
    land: "/land-loan-calculator/",
    manufactured_home: "/manufactured-home-loan-calculator/",
    atv: "/atv-loan-calculator/",
    utv: "/utv-loan-calculator/",
    pontoon: "/pontoon-loan-calculator/",
    other: "/",
};
export const ASSET_TYPES = Object.keys(ASSET_PAGES);
export function monthlyPayment(principal, aprPercent, months) {
    const r = aprPercent / 100 / 12;
    if (r === 0)
        return principal / months;
    return (principal * r) / (1 - Math.pow(1 + r, -months));
}
export function calculateAssetLoan(input) {
    const price = nonNeg("price", input.price);
    const down = input.down_payment === undefined ? 0 : nonNeg("down_payment", input.down_payment);
    if (down > price)
        throw new InputError("down_payment cannot be more than price.");
    const apr = nonNeg("apr_percent", input.apr_percent);
    if (apr > 60)
        throw new InputError("apr_percent looks wrong (over 60).");
    const n = input.term_months;
    if (!Number.isInteger(n) || n < 1 || n > 480)
        throw new InputError("term_months must be a whole number from 1 to 480.");
    const principal = price - down;
    const pmtExact = monthlyPayment(principal, apr, n);
    const payment = round2(pmtExact);
    // amortize with the exact payment, report rounded
    let bal = principal, interestY1 = 0, principalY1 = 0, totalInterest = 0;
    const r = apr / 100 / 12;
    for (let m = 1; m <= n; m++) {
        const i = bal * r;
        const p = pmtExact - i;
        bal -= p;
        totalInterest += i;
        if (m <= 12) {
            interestY1 += i;
            principalY1 += p;
        }
    }
    const out = {
        asset_type: input.asset_type ?? "other",
        price,
        down_payment: down,
        amount_financed: round2(principal),
        apr_percent: apr,
        term_months: n,
        monthly_payment: payment,
        total_of_payments: round2(pmtExact * n),
        total_interest: round2(totalInterest),
        total_cost_with_down_payment: round2(pmtExact * n + down),
        first_12_months: { payments: round2(pmtExact * Math.min(12, n)), interest: round2(interestY1), principal: round2(principalY1) },
    };
    if (input.marginal_tax_rate !== undefined || input.business_use_percent !== undefined) {
        const rate = input.marginal_tax_rate ?? 0;
        if (!(rate >= 0 && rate <= 0.6))
            throw new InputError("marginal_tax_rate must be between 0 and 0.6 (combined federal and state, e.g. 0.30).");
        const bu = (input.business_use_percent ?? 100) / 100;
        if (!(bu >= 0 && bu <= 1))
            throw new InputError("business_use_percent must be between 0 and 100.");
        const businessBasis = round2(price * bu);
        const y1Ded = input.first_year_deduction === undefined ? businessBasis : nonNeg("first_year_deduction", input.first_year_deduction);
        if (y1Ded > businessBasis + 0.005)
            throw new InputError("first_year_deduction cannot be more than price x business use.");
        const y1Interest = round2(interestY1 * bu);
        const y1Saving = round2((y1Ded + y1Interest) * rate);
        const lifeSaving = round2((businessBasis + totalInterest * bu) * rate);
        out.after_tax = {
            marginal_tax_rate: rate,
            business_use_percent: bu * 100,
            first_year_deduction: y1Ded,
            first_year_interest_deduction: y1Interest,
            first_year_tax_saving: y1Saving,
            first_year_net_cash: round2(down + pmtExact * Math.min(12, n) - y1Saving),
            lifetime_tax_saving: lifeSaving,
            after_tax_total_cost: round2(down + pmtExact * n - lifeSaving),
            note: "Assumes the business share of the price is fully deducted over time (first_year_deduction in year 1, the rest later) and the business share of interest is deductible, all at one flat marginal rate. Recapture on sale and state conformity are ignored.",
        };
    }
    return out;
}
