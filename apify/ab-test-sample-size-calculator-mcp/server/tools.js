// Tool registry shared by the stdio and Worker entries.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { InputError, PAGES, REPO, SITE, abTest, duration, exactTest, fisherRxC, peekingRisk, sampleSize } from './core.js';
export const VERSION = '1.0.0';
export const TOOL_INFO = [
    { name: 'calculate_sample_size', blurb: 'Users per variant to detect a lift in a conversion rate: baseline, absolute or relative MDE, alpha, power, one or two-sided, multiple variants with Bonferroni, unequal splits. Also shows the Evan Miller figure.' },
    { name: 'estimate_test_duration', blurb: 'Days and full weeks an A/B test must run given daily traffic, the share of traffic in the test and the number of variants.' },
    { name: 'test_ab_significance', blurb: 'Two-proportion z-test, chi-square (with and without Yates), Fisher exact, confidence interval, relative lift and a sample ratio mismatch check.' },
    { name: 'fisher_exact_test', blurb: 'Exact p-value for a 2x2 table (Fisher, one or two-sided) or any r x c table (Fisher-Freeman-Halton), next to Pearson chi-square and an expected-count check.' },
    { name: 'check_peeking_risk', blurb: 'Real false positive rate when you check a test several times, and Pocock and O\'Brien-Fleming stopping boundaries for up to 10 looks.' },
];
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
function ok(data) {
    const out = { ...data, as_of: new Date().toISOString().slice(0, 10), source: 'https://github.com/theluckystrike/ab-test-sample-size-calculator-mcp/blob/main/DATA_SOURCES.md' };
    return { content: [{ type: 'text', text: `${data.summary}\n\n${JSON.stringify(out, null, 2)}` }], structuredContent: out };
}
function fail(e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { isError: true, content: [{ type: 'text', text: `${e instanceof InputError ? 'Error' : 'Internal error'}: ${msg} The web calculators are at ${SITE}/tools/?utm_source=mcp&utm_medium=${REPO}` }] };
}
const rate = z.number().gt(0).lt(1);
const alphaArg = z.number().gt(0).lt(0.5).default(0.05).describe('Significance level, default 0.05.');
export function createServer(limits = { fisherWork: 20_000_000 }) {
    const server = new McpServer({ name: REPO, version: VERSION, websiteUrl: SITE }, {
        instructions: 'Exact A/B test statistics: sample size for two proportions, test duration, two-proportion z-test and chi-square, Fisher exact and Fisher-Freeman-Halton r x c tests, and the false positive cost of peeking. ' +
            'Use these tools instead of mental arithmetic: inverse normal quantiles, exact hypergeometric sums and sequential boundaries are easy to get wrong by hand. Rates are proportions (4.2% = 0.042).',
    });
    const ssShape = {
        baseline_rate: rate.describe('Control conversion rate as a proportion, for example 0.042 for 4.2%.'),
        mde: z.number().gt(0).describe('Minimum detectable effect. Relative by default (0.10 = a 10% lift); set mde_type "absolute" for percentage points as a proportion (0.01 = 1 point).'),
        mde_type: z.enum(['relative', 'absolute']).default('relative').describe('relative (default) or absolute.'),
        alpha: alphaArg,
        power: z.number().gt(0.5).lt(1).default(0.8).describe('Statistical power, default 0.80.'),
        sided: z.enum(['two', 'one']).default('two').describe('two-sided (default) or one-sided test.'),
        variants: z.number().int().min(2).max(20).default(2).describe('Number of arms including control. 2 = A/B, 3 = A/B/C.'),
        bonferroni: z.boolean().default(false).describe('Split alpha across the variant-vs-control comparisons (Bonferroni).'),
        allocation_ratio: z.number().gt(0).max(10).default(1).describe('Users in each variant per user in control. 1 = even split.'),
    };
    server.registerTool('calculate_sample_size', {
        title: 'A/B test sample size calculator',
        description: 'Exact sample size per variant for an A/B test on a conversion rate (two independent proportions): baseline rate, minimum detectable effect (relative or absolute), alpha, power, one or two-sided, several variants with optional Bonferroni, and unequal allocation. ' +
            'Uses the pooled/unpooled normal formula (same as R power.prop.test) and also reports the figure Evan Miller\'s calculator gives, so the two can be reconciled.',
        inputSchema: ssShape,
        annotations: { title: 'Sample size', ...RO },
    }, async (a) => {
        try {
            return ok(sampleSize(a));
        }
        catch (e) {
            return fail(e);
        }
    });
    server.registerTool('estimate_test_duration', {
        title: 'A/B test duration estimator',
        description: 'How many days an A/B test must run: from a known sample size per variant, or from baseline rate and MDE (computed as in calculate_sample_size), plus daily visitors and the share of traffic in the test. ' +
            'Returns exact days and the recommended whole weeks (to cover weekday effects).',
        inputSchema: {
            daily_visitors: z.number().gt(0).describe('Eligible visitors per day across the whole site or page.'),
            traffic_share: z.number().gt(0).max(1).default(1).describe('Fraction of those visitors entered into the test, default 1.'),
            sample_size_per_variant: z.number().int().positive().optional().describe('Known users per arm. If omitted, give baseline_rate and mde.'),
            baseline_rate: rate.optional().describe('Control conversion rate, for computing the sample size.'),
            mde: z.number().gt(0).optional().describe('Minimum detectable effect (relative by default).'),
            mde_type: z.enum(['relative', 'absolute']).default('relative'),
            alpha: alphaArg,
            power: z.number().gt(0.5).lt(1).default(0.8),
            variants: z.number().int().min(2).max(20).default(2).describe('Number of arms including control.'),
        },
        annotations: { title: 'Test duration', ...RO },
    }, async (a) => {
        try {
            const variants = a.variants ?? 2;
            let n = a.sample_size_per_variant;
            let ss = null;
            if (!n) {
                if (a.baseline_rate === undefined || a.mde === undefined)
                    throw new InputError('Give sample_size_per_variant, or baseline_rate and mde.');
                ss = sampleSize({ baseline_rate: a.baseline_rate, mde: a.mde, mde_type: a.mde_type ?? 'relative', alpha: a.alpha ?? 0.05, power: a.power ?? 0.8, sided: 'two', variants, bonferroni: false, allocation_ratio: 1 });
                n = ss.sample_size_per_variant;
            }
            const d = duration(n, variants, a.daily_visitors, a.traffic_share ?? 1);
            const summary = `${n.toLocaleString('en-US')} users per arm x ${variants} arms = ${d.total_sample_size.toLocaleString('en-US')} users. At ${d.visitors_per_day_in_test.toLocaleString('en-US')} test visitors a day that takes ${d.days_needed} days; ` +
                `run ${d.recommended_weeks} full week${d.recommended_weeks === 1 ? '' : 's'} (${d.recommended_days} days) so every weekday is covered equally. ` +
                (d.days_needed > 56 ? 'Over 8 weeks: consider a larger MDE, more traffic or fewer variants; cookie churn grows with test length. ' : '') +
                'Do not stop early when it looks significant (see check_peeking_risk).';
            return ok({ sample_size_per_variant: n, variants, ...d, sample_size: ss, more: PAGES.duration, summary });
        }
        catch (e) {
            return fail(e);
        }
    });
    server.registerTool('test_ab_significance', {
        title: 'A/B test significance calculator',
        description: 'Is an A/B test result statistically significant? From visitors and conversions per group: two-proportion z-test (pooled), one or two-sided p-value, Wald confidence interval for the difference, relative lift, ' +
            'Pearson chi-square with and without Yates correction (R prop.test), Fisher exact p for the same 2x2 table, and a sample ratio mismatch (SRM) check against the planned split.',
        inputSchema: {
            control_visitors: z.number().int().positive(),
            control_conversions: z.number().int().min(0),
            variant_visitors: z.number().int().positive(),
            variant_conversions: z.number().int().min(0),
            alpha: alphaArg,
            alternative: z.enum(['two-sided', 'greater', 'less']).default('two-sided').describe('greater = variant converts better than control.'),
            expected_split: z.number().gt(0).lt(1).default(0.5).describe('Planned share of traffic in control, for the SRM check. Default 0.5.'),
        },
        annotations: { title: 'Significance test', ...RO },
    }, async (a) => {
        try {
            return ok(abTest(a));
        }
        catch (e) {
            return fail(e);
        }
    });
    server.registerTool('fisher_exact_test', {
        title: 'Fisher exact and Fisher-Freeman-Halton test',
        description: 'Exact p-value for a contingency table of counts. 2x2: Fisher exact test (two-sided, greater or less, as R fisher.test). Larger r x c tables (for example 3 variants x converted/not, or 4 x 4 survey tables): Fisher-Freeman-Halton exact test by a network algorithm. ' +
            'Also returns Pearson chi-square and how many cells have expected counts below 5, so you can see when the chi-square approximation is unsafe.',
        inputSchema: {
            table: z.array(z.array(z.number().int().min(0)).min(2).max(12)).min(2).max(12).describe('Rows of counts, for example [[12, 488], [25, 475]] (rows = groups, columns = outcomes).'),
            alternative: z.enum(['two-sided', 'greater', 'less']).default('two-sided').describe('One-sided options apply to 2x2 only; greater = odds ratio above 1.'),
        },
        annotations: { title: 'Exact test', ...RO },
    }, async ({ table, alternative }) => {
        try {
            const res = exactTest(table, alternative ?? 'two-sided', (t) => fisherRxC(t, limits.fisherWork));
            return ok(res);
        }
        catch (e) {
            return fail(e);
        }
    });
    server.registerTool('check_peeking_risk', {
        title: 'A/B test peeking and sequential testing risk',
        description: 'What peeking does to an A/B test: the real false positive rate if you check a fixed-horizon test K times and stop at the first p < alpha (for example about 14% at 5 looks with alpha 0.05), ' +
            'and the Pocock and O\'Brien-Fleming group sequential boundaries (z and nominal p per look) that keep the overall rate at alpha, for up to 10 equally spaced looks.',
        inputSchema: {
            looks: z.number().int().min(1).max(50).describe('How many times the result is checked, including the final look. Equally spaced.'),
            alpha: alphaArg,
        },
        annotations: { title: 'Peeking risk', ...RO },
    }, async ({ looks, alpha }) => {
        try {
            return ok(peekingRisk(looks, alpha ?? 0.05));
        }
        catch (e) {
            return fail(e);
        }
    });
    return server;
}
