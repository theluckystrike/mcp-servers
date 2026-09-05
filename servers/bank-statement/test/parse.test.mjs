// The reader, against the shape each bank actually exports. Every fixture below is the
// header row a real export writes, with the delimiter, the date order and the number
// locale that bank uses.
import test from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { readStatement, counterpartyOf, counterpartyKey, inferDateOrder, parseDateCell, normHeader } =
  await import(join(here, "..", "dist", "detect.js"));

const REVOLUT = [
  "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
  "CARD_PAYMENT,Current,2026-03-01 08:12:00,2026-03-01 09:00:00,Spotify,-9.99,0.00,EUR,COMPLETED,1200.01",
  "TOPUP,Current,2026-03-02 10:00:00,2026-03-02 10:01:00,Payment from Acme,1500.00,0.00,EUR,COMPLETED,2700.01",
  "CARD_PAYMENT,Current,2026-03-03 12:00:00,2026-03-03 12:05:00,Hotel that fell through,-220.00,0.00,EUR,REVERTED,2700.01",
].join("\n");

const WISE = [
  '"TransferWise ID","Date","Amount","Currency","Description","Payment Reference","Running Balance","Merchant"',
  '"CARD-1","03-03-2026","-12.50","EUR","Card transaction of 12.50 EUR issued by Github","","1187.51","GITHUB"',
  '"CARD-2","15-03-2026","-40.00","EUR","Card transaction of 40.00 EUR issued by Hetzner","","1147.51","HETZNER"',
  '"TRF-3","20-03-2026","2500.00","EUR","Received money from ACME LTD","invoice 2026-04","3647.51",""',
].join("\n");

// mBank: three preamble lines before the header, semicolons, "1 234,56" amounts with the
// currency inside the cell.
const MBANK = [
  "mBank S.A.;;;;;",
  "Lista operacji;;;;;",
  ";;;;;",
  "#Data operacji;#Opis operacji;#Rachunek;#Kategoria;#Kwota;#Saldo po operacji",
  '2026-03-05;"PLATNOSC KARTA 1234 SPOTIFY P05";"12 3456";Rozrywka;-19,99 PLN;1 234,56 PLN',
  '2026-03-06;"PRZELEW PRZYCHODZACY OD ACME SP Z O O";"12 3456";Wplywy;3 000,00 PLN;4 234,56 PLN',
  '2026-03-07;"ZAKUP PRZY UZYCIU KARTY BIEDRONKA 4021";"12 3456";Zakupy;-123,45 PLN;4 111,11 PLN',
].join("\n");

// PKO: every amount is positive and the direction lives in its own column.
const PKO = [
  '"Data operacji","Data waluty","Typ transakcji","Kwota","Waluta","Saldo po transakcji","Opis transakcji"',
  '"2026-03-07","2026-03-07","Przelew wychodzacy","100,00","PLN","900,00","PRZELEW DO ZUS"',
  '"2026-03-08","2026-03-08","Przelew przychodzacy","2500,00","PLN","3400,00","FAKTURA 12/2026"',
].join("\n");

const ING = [
  '"Data transakcji";"Data ksiegowania";"Dane kontrahenta";"Tytul";"Nr rachunku";"Kwota transakcji (waluta rachunku)";"Waluta";"Saldo po transakcji"',
  '"2026-03-08";"2026-03-09";"IKEA RETAIL SP Z O O";"ZAKUP TOWARU";"PL61109010140000071219812874";"-249,00";"PLN";"1 000,00"',
  '"2026-03-09";"2026-03-10";"ACME SP Z O O";"FAKTURA 13/2026";"PL61109010140000071219812874";"4 000,00";"PLN";"5 000,00"',
].join("\n");

const N26 = [
  '"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency"',
  '"2026-03-09","2026-03-09","Spotify AB","DE12500105170648489890","MasterCard Payment","Spotify P09","Main Account","-9.99","",""',
  '"2026-03-11","2026-03-11","ACME LTD","DE12500105170648489891","Income","invoice 14/2026","Main Account","1800.00","",""',
].join("\n");

// A plain export with separate debit and credit columns, day-first dates and no currency.
const GENERIC = [
  "Date,Description,Debit,Credit,Balance",
  "01/04/2026,Coffee shop,3.50,,996.50",
  "15/04/2026,Client payment,,500.00,1496.50",
  "16/04/2026,Rent,1200.00,,296.50",
].join("\n");

test("Revolut: signed amount column, a REVERTED line is not a transaction", () => {
  const s = readStatement(REVOLUT);
  assert.equal(s.bank, "Revolut");
  assert.equal(s.delimiter, ",");
  assert.equal(s.columns.date, "Completed Date");
  assert.equal(s.columns.amount, "Amount");
  assert.equal(s.rows.length, 2, JSON.stringify(s.skipped));
  assert.equal(s.rows[0].date, "2026-03-01");
  assert.equal(s.rows[0].amount_minor, -999);
  assert.equal(s.rows[0].currency, "EUR");
  assert.equal(s.rows[0].balance_minor, 120001);
  assert.equal(s.rows[1].amount_minor, 150000);
  assert.equal(s.skipped.length, 1);
  assert.match(s.skipped[0].reason, /REVERTED/i);
});

test("Wise: day-first dates, a merchant column, and the running balance", () => {
  const s = readStatement(WISE);
  assert.equal(s.bank, "Wise");
  assert.equal(s.rows.length, 3);
  // 15-03-2026 has a day above 12, which settles the order for the whole column: certain, not a guess
  assert.equal(s.date_order, "dmy");
  assert.equal(s.date_order_inferred, false);
  assert.equal(s.rows[0].date, "2026-03-03");
  assert.equal(s.rows[1].date, "2026-03-15");
  assert.equal(s.rows[0].amount_minor, -1250);
  assert.equal(s.rows[0].counterparty, "GITHUB");
  assert.equal(s.rows[2].amount_minor, 250000);
});

test("mBank: preamble lines, semicolons, '1 234,56' amounts and PLN inside the cell", () => {
  const s = readStatement(MBANK);
  assert.equal(s.bank, "mBank");
  assert.equal(s.delimiter, ";");
  assert.equal(s.header_line, 4, "the header is on line 4, under three lines of preamble");
  assert.equal(s.columns.date, "#Data operacji");
  assert.equal(s.rows.length, 3, JSON.stringify(s.skipped));
  assert.equal(s.rows[0].amount_minor, -1999);
  assert.equal(s.rows[0].currency, "PLN", "the ISO code is in the amount cell, not in a column");
  assert.equal(s.rows[0].balance_minor, 123456);
  assert.equal(s.rows[1].amount_minor, 300000, "3 000,00 is three thousand, not three");
  assert.equal(s.rows[2].amount_minor, -12345);
  assert.equal(s.rows[0].counterparty, "1234 SPOTIFY P05");
});

test("PKO: every amount is positive, so the direction column decides the sign", () => {
  const s = readStatement(PKO);
  assert.equal(s.bank, "PKO BP");
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[0].amount_minor, -10000, "Przelew wychodzacy is money leaving");
  assert.equal(s.rows[1].amount_minor, 250000);
  assert.ok(s.notes.some((n) => /direction was taken/.test(n)), s.notes.join(" | "));
});

test("ING: a counterparty column, a currency column and a long amount header", () => {
  const s = readStatement(ING);
  assert.equal(s.bank, "ING");
  assert.equal(s.delimiter, ";");
  assert.equal(s.columns.amount, "Kwota transakcji (waluta rachunku)");
  assert.equal(s.columns.currency, "Waluta");
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[0].amount_minor, -24900);
  assert.equal(s.rows[0].currency, "PLN");
  assert.equal(s.rows[0].counterparty, "IKEA RETAIL SP Z O O");
  assert.equal(s.rows[1].amount_minor, 400000);
});

test("N26: the currency is named only in the amount header", () => {
  const s = readStatement(N26);
  assert.equal(s.bank, "N26");
  assert.equal(s.rows.length, 2);
  assert.equal(s.rows[0].currency, "EUR", "Amount (EUR) names the currency");
  assert.equal(s.rows[0].amount_minor, -999);
  assert.equal(s.rows[0].counterparty, "Spotify AB");
  assert.equal(s.rows[1].amount_minor, 180000);
});

test("generic: separate debit and credit columns become one signed amount", () => {
  const s = readStatement(GENERIC);
  assert.equal(s.bank, "generic");
  assert.equal(s.columns.amount, null);
  assert.equal(s.columns.debit, "Debit");
  assert.equal(s.columns.credit, "Credit");
  assert.equal(s.rows.length, 3);
  assert.equal(s.rows[0].amount_minor, -350, "a debit is negative");
  assert.equal(s.rows[1].amount_minor, 50000, "a credit is positive");
  assert.equal(s.rows[2].amount_minor, -120000);
  assert.equal(s.rows[0].date, "2026-04-01");
  assert.equal(s.date_order, "dmy", "15/04 has a day above 12 and settles the column");
  assert.ok(s.notes.some((n) => /EUR was assumed/.test(n)), s.notes.join(" | "));
});

test("locale amounts: the same digits mean different numbers in different files", () => {
  const eu = readStatement([
    "Date,Description,Amount,Currency",
    "2026-03-01,European grouping,\"1.234,56\",EUR",
    "2026-03-02,European decimal only,\"12,99\",EUR",
    "2026-03-03,Space grouping,\"1 250,00\",EUR",
  ].join("\n"));
  assert.deepEqual(eu.rows.map((r) => r.amount_minor), [123456, 1299, 125000]);

  const en = readStatement([
    "Date,Description,Amount,Currency",
    "2026-03-01,English grouping,\"1,234.56\",USD",
    "2026-03-02,Plain,403.00,USD",
    "2026-03-03,Accounting negative,\"(75.00)\",USD",
  ].join("\n"));
  assert.deepEqual(en.rows.map((r) => r.amount_minor), [123456, 40300, -7500]);
});

test("an ambiguous date column reports the assumption instead of hiding it", () => {
  const s = readStatement([
    "Date,Description,Amount,Currency",
    "03/04/2026,One,-1.00,EUR",
    "05/06/2026,Two,-2.00,EUR",
  ].join("\n"));
  assert.equal(s.date_order_inferred, true, "no value above 12 in either position: a guess was actually made");
  assert.equal(s.rows[0].date, "2026-04-03");
  assert.ok(s.notes.some((n) => /ambiguous/.test(n)), s.notes.join(" | "));
});

test("month-first dates are recognised when a value above 12 sits in the second position", () => {
  const { order, inferred } = inferDateOrder(["03/14/2026", "04/02/2026"]);
  assert.equal(order, "mdy");
  assert.equal(inferred, false, "14 in the month position settles the column: certain, not a guess");
  assert.equal(parseDateCell("03/14/2026", "mdy"), "2026-03-14");
  assert.equal(parseDateCell("02/30/2026", "mdy"), null, "30 February is not a date");
});

test("D-R54: a pure ISO date column is reported as ymd, not dmy, and not a guess", () => {
  const s = readStatement([
    "Date,Description,Amount,Currency",
    "2026-08-07 10:00:00,One,-1.00,EUR",
    "2026-08-09 11:30:00,Two,-2.00,EUR",
    "2026-09-01 00:00:00,Three,-3.00,EUR",
  ].join("\n"));
  assert.equal(s.date_order, "ymd", "every value is unambiguous ISO, not a dmy guess");
  assert.equal(s.date_order_inferred, false, "ISO order is certain, nothing was guessed");
  assert.equal(s.rows[0].date, "2026-08-07");
  assert.equal(s.rows[2].date, "2026-09-01");
  assert.ok(!s.notes.some((n) => /ambiguous/.test(n)), s.notes.join(" | "));
});

test("a dd/mm file with a day over 12 is unambiguous dmy, not a guess", () => {
  const s = readStatement([
    "Date,Description,Amount,Currency",
    "13/04/2026,One,-1.00,EUR",
    "05/06/2026,Two,-2.00,EUR",
  ].join("\n"));
  assert.equal(s.date_order, "dmy");
  assert.equal(s.date_order_inferred, false, "13 in the day position settles the column");
  assert.equal(s.rows[0].date, "2026-04-13");
  assert.ok(!s.notes.some((n) => /ambiguous/.test(n)), s.notes.join(" | "));
});

test("a file with no usable header says so instead of importing nonsense", () => {
  assert.throws(() => readStatement("just,some,text\n1,2,3\n"), /no header row was found/);
  assert.throws(() => readStatement("Date,Amount\n2026-03-01,-1.00\n"), /no description or counterparty column/);
});

test("counterparty: card-network noise and reference numbers are stripped", () => {
  assert.equal(counterpartyOf("CARD PAYMENT TO SPOTIFY AB 12345678"), "SPOTIFY AB");
  assert.equal(counterpartyOf("Direct debit HETZNER ONLINE GMBH"), "HETZNER ONLINE GMBH");
  assert.equal(counterpartyOf("anything at all", "  ACME LTD  "), "ACME LTD");
  // the grouping key ignores the per-charge reference digits, so months collapse together
  assert.equal(counterpartyKey("SPOTIFY P05"), counterpartyKey("SPOTIFY P06"));
  assert.notEqual(counterpartyKey("SPOTIFY"), counterpartyKey("NETFLIX"));
});

test("headers are normalised past diacritics, case and punctuation", () => {
  assert.equal(normHeader("#Data operacji"), "data operacji");
  assert.equal(normHeader("Tytuł"), "tytul");
  assert.equal(normHeader("Kwota transakcji (waluta rachunku)"), "kwota transakcji waluta rachunku");
  assert.equal(normHeader("Obciążenie"), "obciazenie");
});

test("a row that is not a transaction is skipped with a reason, not silently dropped", () => {
  const s = readStatement([
    "Date,Description,Amount,Currency",
    "2026-03-01,Real one,-1.00,EUR",
    "not a date,Broken,-2.00,EUR",
    "2026-03-03,No amount,,EUR",
  ].join("\n"));
  assert.equal(s.rows.length, 1);
  assert.equal(s.skipped.length, 2);
  assert.match(s.skipped[0].reason, /is not a date/);
  assert.match(s.skipped[1].reason, /is not an amount/);
  assert.equal(s.skipped[0].line, 3, "the line number counts the header");
});
