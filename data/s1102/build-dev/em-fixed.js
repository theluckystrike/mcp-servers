function num_subjects(alpha, power_level, p, delta) {
    if (p > 0.5) {
        p = 1.0 - p;
    }
    var t_alpha2 = ppnd(1.0-alpha/2);
    var t_beta = ppnd(power_level);

    var sd1 = Math.sqrt(2 * p * (1.0 - p));
    var sd2 = Math.sqrt(p * (1.0 - p) + (p + delta) * (1.0 - p - delta));

    return (t_alpha2 * sd1 + t_beta * sd2) * (t_alpha2 * sd1 + t_beta * sd2) / (delta * delta);
}

function didReceiveInvalidInput() {
}

function didFinishDrawing() {
}
