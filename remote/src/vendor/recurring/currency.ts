/**
 * ISO 4217 alphabetic codes, the active list.
 *
 * The invoice engine's `currencyDecimals()` answers 2 for anything it does not know, so a
 * typo like "EURO" or a made-up "XYZ" is silently accepted and then printed on a real PDF
 * that goes to a client. A recurring schedule makes that worse than a one-off invoice: the
 * wrong code is stamped on every period forever. So the code is checked once, at the point
 * the schedule is stored.
 */
const ISO_4217 = new Set([
  "AED","AFN","ALL","AMD","ANG","AOA","ARS","AUD","AWG","AZN","BAM","BBD","BDT","BGN","BHD",
  "BIF","BMD","BND","BOB","BOV","BRL","BSD","BTN","BWP","BYN","BZD","CAD","CDF","CHE","CHF",
  "CHW","CLF","CLP","CNY","COP","COU","CRC","CUP","CVE","CZK","DJF","DKK","DOP","DZD","EGP",
  "ERN","ETB","EUR","FJD","FKP","GBP","GEL","GHS","GIP","GMD","GNF","GTQ","GYD","HKD","HNL",
  "HTG","HUF","IDR","ILS","INR","IQD","IRR","ISK","JMD","JOD","JPY","KES","KGS","KHR","KMF",
  "KPW","KRW","KWD","KYD","KZT","LAK","LBP","LKR","LRD","LSL","LYD","MAD","MDL","MGA","MKD",
  "MMK","MNT","MOP","MRU","MUR","MVR","MWK","MXN","MXV","MYR","MZN","NAD","NGN","NIO","NOK",
  "NPR","NZD","OMR","PAB","PEN","PGK","PHP","PKR","PLN","PYG","QAR","RON","RSD","RUB","RWF",
  "SAR","SBD","SCR","SDG","SEK","SGD","SHP","SLE","SOS","SRD","SSP","STN","SVC","SYP","SZL",
  "THB","TJS","TMT","TND","TOP","TRY","TTD","TWD","TZS","UAH","UGX","USD","USN","UYI","UYU",
  "UYW","UZS","VED","VES","VND","VUV","WST","XAF","XCD","XCG","XDR","XOF","XPF","XSU","XUA",
  "YER","ZAR","ZMW","ZWG",
]);

export function isKnownCurrency(code: string): boolean {
  return ISO_4217.has(code.toUpperCase());
}
