// Pure core for ab-test-sample-size-calculator-mcp. No I/O: closed-form and exact statistics only.
import { chiSqSf, crossingProbability, logFactorials, normCdf, normInv, normSf } from './stats.js';
export const REPO = 'ab-test-sample-size-calculator-mcp';
export const SITE = 'https://abwex.com';
export const UTM = `utm_source=mcp&utm_medium=${REPO}`;
export const more = (path) => `${SITE}${path}?${UTM}`;
export const PAGES = {
    sampleSize: more('/tools/sample-size-calculator.html'),
    duration: more('/tools/experiment-duration-estimator/'),
    significance: more('/answers/is-my-ab-test-significant.html'),
    ffh: more('/tools/fisher-freeman-halton-calculator/'),
    fisherVsChi: more('/answers/fisher-exact-vs-chi-square.html'),
    peeking: more('/tools/peeking-inflation-calculator'),
};
export class InputError extends Error {
}
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r6 = (x) => Math.round(x * 1e6) / 1e6;
/** p-values: 4 significant digits, never rounded to zero. */
export const sig = (p) => (p === 0 ? 0 : Number(p.toPrecision(4)));
const pct = (x, d = 2) => `${(x * 100).toFixed(d)}%`;
const fmt = (n) => n.toLocaleString('en-US');
function need(cond, msg) { if (!cond)
    throw new InputError(msg); }
/** Evan Miller's calculator (evanmiller.org/ab-testing/sample-size.html, sample-size-fixed.js), reproduced as published. */
export function evanMillerN(alpha, power, p, delta) {
    if (p > 0.5)
        p = 1 - p;
    const ta = normInv(1 - alpha / 2), tb = normInv(power);
    const sd1 = Math.sqrt(2 * p * (1 - p));
    const sd2 = Math.sqrt(p * (1 - p) + (p + delta) * (1 - p - delta));
    return ((ta * sd1 + tb * sd2) ** 2) / (delta * delta);
}
/**
 * Per-group n for comparing two proportions: pooled variance under H0, unpooled under H1
 * (Fleiss, Levin and Paik 2003 eq. 4.14 without continuity correction; equals R power.prop.test for ratio 1).
 * k = n_treatment / n_control.
 */
export function twoProportionN(p1, p2, alpha, power, sided, k = 1) {
    const za = normInv(1 - (sided === 'two' ? alpha / 2 : alpha));
    const zb = normInv(power);
    const pbar = (p1 + k * p2) / (1 + k);
    const d = Math.abs(p2 - p1);
    const raw = (za * Math.sqrt(pbar * (1 - pbar) * (1 + 1 / k)) + zb * Math.sqrt(p1 * (1 - p1) + (p2 * (1 - p2)) / k)) ** 2 / (d * d);
    const n1 = Math.ceil(raw - 1e-9);
    return { n1, n2: Math.ceil(n1 * k - 1e-9), raw };
}
export function sampleSize(i) {
    need(i.baseline_rate > 0 && i.baseline_rate < 1, 'baseline_rate must be a proportion between 0 and 1 (for 4.2% use 0.042).');
    need(i.mde > 0, 'mde must be positive.');
    need(i.variants >= 2 && i.variants <= 20, 'variants counts every arm including control: 2 to 20.');
    const p1 = i.baseline_rate;
    const delta = i.mde_type === 'relative' ? p1 * i.mde : i.mde;
    const p2 = p1 + delta;
    need(p2 < 1, `baseline ${p1} plus the effect ${r6(delta)} reaches 100%. Use a smaller mde (relative mde of 10% is 0.10).`);
    const comparisons = i.variants - 1;
    const alphaUsed = i.bonferroni && comparisons > 1 ? i.alpha / comparisons : i.alpha;
    const { n1, n2, raw } = twoProportionN(p1, p2, alphaUsed, i.power, i.sided, i.allocation_ratio);
    const total = n1 + n2 * comparisons;
    const em = i.allocation_ratio === 1 && !(i.bonferroni && comparisons > 1) ? Math.round(evanMillerN(i.alpha, i.power, p1, delta)) : null;
    const summary = `To detect a change from ${pct(p1)} to ${pct(p2)} (${i.mde_type === 'relative' ? `${pct(i.mde, 1)} relative` : `${pct(delta)} absolute`} MDE) with ${pct(i.power, 0)} power at alpha ${alphaUsed !== i.alpha ? `${r6(alphaUsed)} (Bonferroni for ${comparisons} comparisons)` : i.alpha} ${i.sided}-sided, ` +
        `you need ${fmt(n1)} users in control${i.allocation_ratio !== 1 ? ` and ${fmt(n2)} in each variant` : ' and in each variant'}: ${fmt(total)} in total across ${i.variants} arms. ` +
        (em !== null ? `Evan Miller's calculator gives ${fmt(em)} per arm for the same inputs (it uses the baseline variance in both terms and always two-sided alpha).` : '');
    return {
        inputs: i, control_rate: p1, variant_rate: r6(p2), absolute_effect: r6(delta), relative_effect: r6(delta / p1), alpha_per_comparison: r6(alphaUsed),
        per_group_raw: r4(raw), sample_size_control: n1, sample_size_per_variant: n2, total_sample_size: total,
        method: 'Two-proportion z-test, pooled variance under H0 and unpooled under H1, no continuity correction (Fleiss 2003; same as R power.prop.test for equal groups). Rounded up.',
        evan_miller_equivalent: em, more: PAGES.sampleSize, summary,
    };
}
// ---------------------------------------------------------------- duration
export function duration(nPerArm, arms, dailyVisitors, trafficShare, nControl = nPerArm) {
    need(dailyVisitors > 0, 'daily_visitors must be positive.');
    need(trafficShare > 0 && trafficShare <= 1, 'traffic_share is the fraction of traffic in the test, 0 to 1.');
    const total = nControl + nPerArm * (arms - 1);
    const perDay = dailyVisitors * trafficShare;
    const days = Math.ceil(total / perDay - 1e-9);
    const weeks = Math.max(1, Math.ceil(days / 7));
    return { total_sample_size: total, visitors_per_day_in_test: r4(perDay), days_needed: days, recommended_days: weeks * 7, recommended_weeks: weeks };
}
export function abTest(i) {
    const { control_visitors: n1, control_conversions: x1, variant_visitors: n2, variant_conversions: x2 } = i;
    for (const [k, v] of Object.entries({ control_visitors: n1, control_conversions: x1, variant_visitors: n2, variant_conversions: x2 }))
        need(Number.isInteger(v) && v >= 0, `${k} must be a whole number of at least 0.`);
    need(n1 > 0 && n2 > 0, 'Each group needs at least one visitor.');
    need(x1 <= n1 && x2 <= n2, 'Conversions cannot exceed visitors.');
    const p1 = x1 / n1, p2 = x2 / n2;
    const pp = (x1 + x2) / (n1 + n2);
    const sePooled = Math.sqrt(pp * (1 - pp) * (1 / n1 + 1 / n2));
    const z = sePooled > 0 ? (p2 - p1) / sePooled : 0;
    const p = i.alternative === 'two-sided' ? Math.min(1, 2 * normSf(Math.abs(z))) : i.alternative === 'greater' ? normSf(z) : normCdf(z);
    const seU = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
    const zc = normInv(1 - i.alpha / 2);
    // 2x2 chi-square: rows = groups, columns = converted / not converted.
    const t = [[x1, n1 - x1], [x2, n2 - x2]];
    const chi = chiSquare(t);
    const yates = chiSquare(t, true);
    const fisher = fisher2x2(t, i.alternative === 'two-sided' ? 'two-sided' : i.alternative === 'greater' ? 'less' : 'greater');
    // SRM: observed split against the planned share of traffic for control.
    const N = n1 + n2;
    const e1 = N * i.expected_split, e2 = N * (1 - i.expected_split);
    const srmChi = (n1 - e1) ** 2 / e1 + (n2 - e2) ** 2 / e2;
    const srmP = chiSqSf(srmChi, 1);
    const significant = p < i.alpha;
    const lift = p1 > 0 ? (p2 - p1) / p1 : null;
    const summary = `Control ${pct(p1)} (${fmt(x1)}/${fmt(n1)}) vs variant ${pct(p2)} (${fmt(x2)}/${fmt(n2)})${lift !== null ? `, relative lift ${lift >= 0 ? '+' : ''}${pct(lift)}` : ''}. ` +
        `Two-proportion z = ${z.toFixed(4)}, ${i.alternative} p = ${sig(p)}: ${significant ? `significant at alpha ${i.alpha}` : `not significant at alpha ${i.alpha}`}. ` +
        `${pct(1 - i.alpha, 0)} CI for the difference: ${pct(p2 - p1 - zc * seU, 3)} to ${pct(p2 - p1 + zc * seU, 3)}. ` +
        `Chi-square ${chi.statistic.toFixed(4)} (p ${sig(chi.p_value)}), with Yates correction p ${sig(yates.p_value)}, Fisher exact p ${sig(fisher.p_value)}. ` +
        (srmP < 0.001 ? `Warning: sample ratio mismatch (p ${sig(srmP)} against a ${pct(i.expected_split, 0)} control split); check assignment before trusting the result. ` : '') +
        'This p-value is only valid if the sample size was fixed in advance and you did not stop early on a peek.';
    return {
        control: { visitors: n1, conversions: x1, rate: r6(p1) }, variant: { visitors: n2, conversions: x2, rate: r6(p2) },
        absolute_difference: r6(p2 - p1), relative_lift: lift === null ? null : r6(lift),
        z_test: { z: r6(z), p_value: sig(p), alternative: i.alternative, pooled_rate: r6(pp), standard_error: r6(sePooled), significant },
        confidence_interval: { level: 1 - i.alpha, lower: r6(p2 - p1 - zc * seU), upper: r6(p2 - p1 + zc * seU), method: 'Wald, unpooled' },
        chi_square: { statistic: r6(chi.statistic), df: 1, p_value: sig(chi.p_value) },
        chi_square_yates: { statistic: r6(yates.statistic), df: 1, p_value: sig(yates.p_value) },
        fisher_exact: { p_value: sig(fisher.p_value), alternative: i.alternative },
        sample_ratio_mismatch: { expected_control_share: i.expected_split, chi_square: r6(srmChi), p_value: sig(srmP), flagged: srmP < 0.001 },
        more: PAGES.significance, summary,
    };
}
// ---------------------------------------------------------------- contingency tables
export function validateTable(t) {
    need(Array.isArray(t) && t.length >= 2, 'table needs at least 2 rows.');
    const c = t[0]?.length ?? 0;
    need(c >= 2, 'table needs at least 2 columns.');
    for (const row of t) {
        need(Array.isArray(row) && row.length === c, 'every row must have the same number of columns.');
        for (const v of row)
            need(Number.isInteger(v) && v >= 0, 'cells must be whole-number counts of at least 0.');
    }
    return t.map((r) => [...r]);
}
export function chiSquare(t, yates = false) {
    const R = t.map((r) => r.reduce((a, b) => a + b, 0));
    const C = t[0].map((_, j) => t.reduce((a, r) => a + r[j], 0));
    const N = R.reduce((a, b) => a + b, 0);
    let stat = 0, minE = Infinity, small = 0, cells = 0;
    const useYates = yates && t.length === 2 && t[0].length === 2;
    for (let i = 0; i < t.length; i++)
        for (let j = 0; j < t[0].length; j++) {
            if (R[i] === 0 || C[j] === 0)
                continue;
            const e = (R[i] * C[j]) / N;
            cells++;
            minE = Math.min(minE, e);
            if (e < 5)
                small++;
            let d = Math.abs(t[i][j] - e);
            if (useYates)
                d = Math.max(0, d - 0.5);
            stat += (d * d) / e;
        }
    const df = (R.filter((x) => x > 0).length - 1) * (C.filter((x) => x > 0).length - 1);
    return { statistic: stat, df, p_value: df > 0 ? chiSqSf(stat, df) : 1, min_expected: minE === Infinity ? 0 : minE, cells_expected_below_5: small, cells };
}
/** 2x2 Fisher exact test. 'greater' tests odds ratio > 1 (P(X >= a)), as in R fisher.test. */
export function fisher2x2(t, alternative) {
    const [[a, b], [c, d]] = t;
    const r1 = a + b, c1 = a + c, N = a + b + c + d;
    const lf = logFactorials(N);
    const lo = Math.max(0, r1 + c1 - N), hi = Math.min(r1, c1);
    const lp = (x) => lf[r1] + lf[N - r1] + lf[c1] + lf[N - c1] - lf[N] - lf[x] - lf[r1 - x] - lf[c1 - x] - lf[N - r1 - c1 + x];
    const obs = lp(a);
    let p = 0;
    for (let x = lo; x <= hi; x++) {
        const v = lp(x);
        if (alternative === 'greater' ? x >= a : alternative === 'less' ? x <= a : v <= obs + 1e-7)
            p += Math.exp(v);
    }
    const or = b * c === 0 ? (a * d === 0 ? null : Infinity) : (a * d) / (b * c);
    return { p_value: Math.min(1, p), odds_ratio: or };
}
export class TooLarge extends Error {
}
/**
 * Exact conditional test for an r x c table (Fisher-Freeman-Halton): sum of the probabilities of all tables with
 * the observed margins whose probability is <= the observed one (relative tolerance 1e-7, as R fisher.test).
 * Network algorithm in the style of Mehta and Patel (1983): columns are stages, a node is the sorted vector of
 * remaining row totals; exact longest and shortest completions prune whole sub-networks.
 */
export function fisherRxC(input, maxWork = 3_000_000) {
    let t = input.filter((r) => r.some((v) => v > 0));
    const keepCols = t[0] ? t[0].map((_, j) => t.some((r) => r[j] > 0)) : [];
    t = t.map((r) => r.filter((_, j) => keepCols[j]));
    if (t.length < 2 || (t[0]?.length ?? 0) < 2)
        return { p_value: 1, tables_considered: 0, work: 0 };
    if (t.length > t[0].length)
        t = t[0].map((_, j) => t.map((r) => r[j]));
    const rows = t.map((r) => r.reduce((a, b) => a + b, 0));
    const cols = t[0].map((_, j) => t.reduce((a, r) => a + r[j], 0)).sort((a, b) => a - b);
    const N = rows.reduce((a, b) => a + b, 0);
    const lf = logFactorials(N);
    const K = rows.reduce((a, r) => a + lf[r], 0) + cols.reduce((a, c) => a + lf[c], 0) - lf[N];
    let obs = 0;
    for (const r of t)
        for (const v of r)
            obs -= lf[v];
    const thr = obs + Math.log1p(1e-7);
    const C = cols.length;
    const suffix = new Float64Array(C + 1);
    for (let j = C - 1; j >= 0; j--)
        suffix[j] = suffix[j + 1] + lf[cols[j]];
    let work = 0;
    const tick = () => { if (++work > maxWork)
        throw new TooLarge('table too large for exact enumeration within this server\'s limits'); };
    // Enumerate ways to split column total c over rows with remaining totals R. cb(edgeLogWeight, newR).
    function each(c, R, cb) {
        const m = R.length;
        const tailSum = new Array(m + 1).fill(0);
        for (let i = m - 1; i >= 0; i--)
            tailSum[i] = tailSum[i + 1] + R[i];
        const x = new Array(m).fill(0);
        const rec = (i, left, e) => {
            if (i === m - 1) {
                if (left > R[i])
                    return;
                x[i] = left;
                tick();
                const Rn = R.map((v, k) => v - x[k]).sort((a, b) => a - b);
                cb(e - lf[left], Rn);
                return;
            }
            const lo = Math.max(0, left - tailSum[i + 1]);
            const hi = Math.min(R[i], left);
            for (let v = lo; v <= hi; v++) {
                x[i] = v;
                rec(i + 1, left - v, e - lf[v]);
            }
        };
        rec(0, c, 0);
    }
    const memo = new Map();
    function bounds(j, R) {
        if (j === C - 1) {
            const v = -R.reduce((a, r) => a + lf[r], 0);
            return [v, v];
        }
        const key = `${j}|${R.join(',')}`;
        const hit = memo.get(key);
        if (hit)
            return hit;
        let mx = -Infinity, mn = Infinity;
        each(cols[j], R, (e, Rn) => {
            const [a, b] = bounds(j + 1, Rn);
            if (e + a > mx)
                mx = e + a;
            if (e + b < mn)
                mn = e + b;
        });
        const out = [mx, mn];
        memo.set(key, out);
        return out;
    }
    let stage = new Map();
    const R0 = [...rows].sort((a, b) => a - b);
    stage.set(R0.join(','), { R: R0, past: new Map([[0, { lw: 0, n: 1 }]]) });
    let p = 0;
    let paths = 0;
    for (let j = 0; j < C; j++) {
        const next = new Map();
        for (const node of stage.values()) {
            const [mx, mn] = bounds(j, node.R);
            const nRem = node.R.reduce((a, b) => a + b, 0);
            const total = lf[nRem] - node.R.reduce((a, r) => a + lf[r], 0) - suffix[j];
            for (const { lw, n } of node.past.values()) {
                if (lw + mx <= thr) {
                    p += n * Math.exp(K + lw + total);
                    paths += n;
                    continue;
                }
                if (lw + mn > thr) {
                    paths += n;
                    continue;
                }
                each(cols[j], node.R, (e, Rn) => {
                    const key = Rn.join(',');
                    let child = next.get(key);
                    if (!child) {
                        child = { R: Rn, past: new Map() };
                        next.set(key, child);
                    }
                    const v = lw + e;
                    const pk = Math.round(v * 1e8);
                    const prev = child.past.get(pk);
                    if (prev)
                        prev.n += n;
                    else
                        child.past.set(pk, { lw: v, n });
                });
            }
        }
        stage = next;
        if (!stage.size)
            break;
    }
    return { p_value: Math.min(1, p), tables_considered: paths, work };
}
export function exactTest(table, alternative, rxc = (t) => fisherRxC(t)) {
    const t = validateTable(table);
    const r = t.length, c = t[0].length;
    const N = t.flat().reduce((a, b) => a + b, 0);
    need(N > 0, 'table is all zeros.');
    need(N <= 100000, 'total count above 100,000: use the chi-square test; the exact test adds nothing at this size.');
    const chi = chiSquare(t);
    const is2x2 = r === 2 && c === 2;
    if (!is2x2)
        need(alternative === 'two-sided', 'one-sided alternatives exist only for 2x2 tables.');
    let p = null;
    let note = null;
    let odds = null;
    let tables = null;
    if (is2x2) {
        const f = fisher2x2(t, alternative);
        p = f.p_value;
        odds = f.odds_ratio === Infinity ? null : f.odds_ratio;
    }
    else {
        try {
            const f = rxc(t);
            p = f.p_value;
            tables = f.tables_considered;
        }
        catch (e) {
            if (!(e instanceof TooLarge))
                throw e;
            note = `Exact enumeration stopped at its work limit for this ${r} x ${c} table with n = ${N}. With expected counts this large the chi-square p-value below is a close approximation; for an exact answer use R fisher.test(x, simulate.p.value = TRUE, B = 1e6) or the abwex.com calculator.`;
        }
    }
    const name = is2x2 ? 'Fisher exact test (2x2)' : 'Fisher-Freeman-Halton exact test';
    const summary = `${name} on a ${r} x ${c} table, n = ${fmt(N)}: ` +
        (p !== null ? `${alternative} exact p = ${sig(p)}. ` : 'exact p not computed. ') +
        `Pearson chi-square ${chi.statistic.toFixed(4)} on ${chi.df} df, p = ${sig(chi.p_value)}` +
        (chi.cells_expected_below_5 ? `; ${chi.cells_expected_below_5} of ${chi.cells} cells have expected counts below 5, so prefer the exact p-value.` : '; all expected counts are 5 or more, so the chi-square approximation is reasonable.') +
        (note ? ` ${note}` : '');
    return {
        test: name, rows: r, columns: c, n: N, alternative, p_value: p === null ? null : sig(p), p_value_full: p,
        odds_ratio: odds === null ? null : r6(odds), tables_enumerated: tables,
        chi_square: { statistic: r6(chi.statistic), df: chi.df, p_value: sig(chi.p_value), min_expected: r4(chi.min_expected), cells_expected_below_5: chi.cells_expected_below_5 },
        note, more: is2x2 ? PAGES.fisherVsChi : PAGES.ffh, summary,
    };
}
// ---------------------------------------------------------------- peeking / sequential
/** Constant c such that crossing |Z_k| >= c * g(k) at any of K looks has probability alpha. */
export function solveBoundary(K, alpha, shape, h = 0.06) {
    const mk = (c) => Array.from({ length: K }, (_, i) => (shape === 'pocock' ? c : c * Math.sqrt(K / (i + 1))));
    let lo = normInv(1 - alpha / 2) - 0.01, hi = 6;
    for (let it = 0; it < 40 && hi - lo > 2e-5; it++) {
        const mid = (lo + hi) / 2;
        if (crossingProbability(mk(mid), h) > alpha)
            lo = mid;
        else
            hi = mid;
    }
    return mk((lo + hi) / 2);
}
export function peekingRisk(looks, alpha) {
    need(Number.isInteger(looks) && looks >= 1 && looks <= 50, 'looks must be 1 to 50.');
    need(alpha > 0 && alpha < 0.5, 'alpha must be between 0 and 0.5.');
    const z = normInv(1 - alpha / 2);
    const fpr = crossingProbability(Array(looks).fill(z), looks > 20 ? 0.1 : 0.05);
    let pocock = null, obf = null;
    if (looks <= 10) {
        pocock = solveBoundary(looks, alpha, 'pocock');
        obf = solveBoundary(looks, alpha, 'obf');
    }
    const toP = (b) => sig(2 * normSf(b));
    const schedule = pocock && obf ? Array.from({ length: looks }, (_, k) => ({
        look: k + 1, information_fraction: r4((k + 1) / looks),
        pocock_z: r4(pocock[k]), pocock_p: toP(pocock[k]), obrien_fleming_z: r4(obf[k]), obrien_fleming_p: toP(obf[k]),
    })) : null;
    const summary = `Checking a fixed-horizon test ${looks} time${looks === 1 ? '' : 's'} at equally spaced points and stopping at the first p < ${alpha} gives a real false positive rate of ${pct(fpr, 1)} under no true effect, ` +
        `${(fpr / alpha).toFixed(2)} times the nominal ${pct(alpha, 0)}. ` +
        (schedule ? `To keep ${pct(alpha, 0)} overall with ${looks} looks, stop only if p < ${schedule[0].pocock_p} at every look (Pocock), or use O'Brien-Fleming: p < ${schedule[0].obrien_fleming_p} at the first look down to p < ${schedule[looks - 1].obrien_fleming_p} at the last. ` : 'Boundaries are given for up to 10 planned looks. ') +
        'Decide the number of looks before the test starts.';
    return {
        looks, alpha, nominal_z: r4(z), false_positive_rate: r4(fpr), inflation_factor: r4(fpr / alpha), schedule,
        method: 'Armitage, McPherson and Rowe (1969) recursive numerical integration for equally spaced looks; boundary constants solved by bisection.',
        more: PAGES.peeking, summary,
    };
}
