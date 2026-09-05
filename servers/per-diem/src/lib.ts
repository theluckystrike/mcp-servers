/**
 * The per diem engine, as a stable public API for other servers in this repo.
 *
 * `src/index.ts` is the MCP server (tools, licensing, storage). Everything below it --
 * the bundled rate tables, the scheme arithmetic and the trip store -- is generic and is
 * re-exported here so a sibling server can price a trip without a second copy of the
 * rules, and without a second copy of the tables that would drift from these.
 *
 * Nothing in this module touches the network. The tables are read from disk on first use.
 *
 * Stability: the names below are the contract. `dist/*.js` deep imports are not.
 */
export { currencyDecimals, formatMoney, table, TABLE_IDS } from "./tables.js";
export type { Band, FiscalYear, RateRow, Table, TableHeader, TableId } from "./tables.js";
export { calc, findRate, MAX_TRIP_DAYS, MEALS, parseInstant, resolveTimezone, SCHEMES } from "./schemes.js";
export type { CalcInput, CalcResult, DayLine, MealName, SchemeId } from "./schemes.js";
export { dataDir, findTrip, getTrips, lockPath, nextTripId, setTrips } from "./store.js";
export type { Trip } from "./store.js";
export { VERSION } from "./version.js";
