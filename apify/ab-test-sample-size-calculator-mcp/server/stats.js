// Numerical building blocks. No I/O. Written for double precision; accuracy notes per function.
/** ln Gamma(x), Lanczos (g = 7, n = 9). Relative error about 1e-15 for x > 0. */
const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lnGamma(x) {
    if (x < 0.5)
        return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
    x -= 1;
    let a = LANCZOS[0];
    const t = x + 7.5;
    for (let i = 1; i < 9; i++)
        a += LANCZOS[i] / (x + i);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
/** Regularized incomplete gamma P(a, x) and Q(a, x) = 1 - P (series / Lentz continued fraction). */
export function gammaPQ(a, x) {
    if (x <= 0)
        return { p: 0, q: 1 };
    const lnPre = a * Math.log(x) - x - lnGamma(a);
    if (x < a + 1) {
        let sum = 1 / a, term = sum, ap = a;
        for (let n = 0; n < 1000; n++) {
            ap += 1;
            term *= x / ap;
            sum += term;
            if (Math.abs(term) < Math.abs(sum) * 1e-16)
                break;
        }
        const p = sum * Math.exp(lnPre);
        return { p, q: 1 - p };
    }
    const tiny = 1e-300;
    let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d;
    for (let i = 1; i < 1000; i++) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < tiny)
            d = tiny;
        c = b + an / c;
        if (Math.abs(c) < tiny)
            c = tiny;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < 1e-16)
            break;
    }
    const q = Math.exp(lnPre) * h;
    return { p: 1 - q, q };
}
/** Upper tail of the standard normal, P(Z > z), accurate in the far tail. */
export function normSf(z) {
    if (z === 0)
        return 0.5;
    const tail = 0.5 * gammaPQ(0.5, (z * z) / 2).q;
    return z > 0 ? tail : 1 - tail;
}
export const normCdf = (z) => normSf(-z);
/** Inverse standard normal CDF. Wichura (1988) AS 241 PPND16, about 1e-16 relative accuracy. */
export function normInv(p) {
    if (!(p > 0 && p < 1))
        throw new RangeError('probability must be strictly between 0 and 1');
    const q = p - 0.5;
    if (Math.abs(q) <= 0.425) {
        const r = 0.180625 - q * q;
        return q * (((((((r * 2509.0809287301226727 + 33430.575583588128105) * r + 67265.770927008700853) * r + 45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r + 133.14166789178437745) * r + 3.387132872796366608) /
            (((((((r * 5226.495278852545925 + 28729.085735721942674) * r + 39307.89580009271061) * r + 21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r + 42.313330701600911252) * r + 1);
    }
    let r = q < 0 ? p : 1 - p;
    r = Math.sqrt(-Math.log(r));
    let v;
    if (r <= 5) {
        r -= 1.6;
        v = (((((((r * 7.7454501427834140764e-4 + 0.0227238449892691845833) * r + 0.24178072517745061177) * r + 1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r + 4.6303378461565452959) * r + 1.42343711074968357734) /
            (((((((r * 1.05075007164441684324e-9 + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r + 0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r + 2.05319162663775882187) * r + 1);
    }
    else {
        r -= 5;
        v = (((((((r * 2.01033439929228813265e-7 + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r + 0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r + 5.4637849111641143699) * r + 6.6579046435011037772) /
            (((((((r * 2.04426310338993978564e-15 + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r + 7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r + 0.59983220655588793769) * r + 1);
    }
    return q < 0 ? -v : v;
}
/** Upper tail of chi-square with df degrees of freedom. */
export const chiSqSf = (x, df) => (x <= 0 ? 1 : gammaPQ(df / 2, x / 2).q);
// ---------------------------------------------------------------- log factorials
let LF = new Float64Array([0, 0]);
export function logFactorials(n) {
    if (LF.length > n)
        return LF;
    const out = new Float64Array(n + 1);
    out.set(LF);
    for (let i = LF.length; i <= n; i++)
        out[i] = out[i - 1] + Math.log(i);
    LF = out;
    return LF;
}
// ---------------------------------------------------------------- group sequential crossing probability
/**
 * Probability that a two-sided test crosses |Z_k| >= b_k at any of K equally spaced looks under H0
 * (Armitage, McPherson and Rowe 1969 recursion). Works on the partial sum S_k = sqrt(k) Z_k, whose increments
 * are independent N(0, 1). Composite Simpson integration on a grid of step about h.
 */
export function crossingProbability(bounds, h = 0.05) {
    const K = bounds.length;
    const phi = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    let prevX = null;
    let prevF = null;
    let prevW = null;
    for (let k = 1; k <= K; k++) {
        const B = bounds[k - 1] * Math.sqrt(k);
        let m = Math.ceil(B / h);
        if (m % 2)
            m++; // even number of intervals each side keeps Simpson valid over [-B, B]
        const n = 2 * m + 1;
        const step = (2 * B) / (n - 1);
        const xs = new Float64Array(n), f = new Float64Array(n), w = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            xs[i] = -B + i * step;
            w[i] = (i === 0 || i === n - 1 ? 1 : i % 2 ? 4 : 2) * step / 3;
        }
        if (!prevX) {
            for (let i = 0; i < n; i++)
                f[i] = phi(xs[i]);
        }
        else {
            for (let i = 0; i < n; i++) {
                let s = 0;
                const x = xs[i];
                for (let j = 0; j < prevX.length; j++)
                    s += prevW[j] * prevF[j] * phi(x - prevX[j]);
                f[i] = s;
            }
        }
        prevX = xs;
        prevF = f;
        prevW = w;
    }
    let stay = 0;
    for (let i = 0; i < prevX.length; i++)
        stay += prevW[i] * prevF[i];
    return Math.min(1, Math.max(0, 1 - stay));
}
