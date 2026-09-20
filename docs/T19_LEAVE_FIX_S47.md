# T19: Repair servers/leave MCP server

STATUS: in progress

## Goal
Fix src/ syntax/logic errors in /Users/mike/mcp-servers/servers/leave, port test suite to leave_* tools, pass `npm run build` clean and `npm test` 0 fail.

## Evidence

- iter: Fixed src/index.ts syntax/logic errors (stray paren L106, icsEscape backtick L113, END:VEVENT push L115, `email` not-in-Employee, `locked` return Promise, `ariiedOver`→carriedOver, 'Rrequest'→'Request', 'parenntal'→'parental', refine ``isIsoDate(v`)``→`isIsoDate(v)`, `type not in`→`!LEAVE_TYPES.includes`, `joi`→`join`, `comment;`→`comment:`, `reqff`→`req`, `commitredDays`→`committedDays`, `rematingHalves`→`remainingHalves`, `redece`→`reduce`, `appled`→`applied`, `patt`→`path`, `dirName(dirName(...`→`dirname(dirname(...))`, `toLowerdCase`/`toLowerDcase`→`toLowerCase`, `/ii`→`/i`, `String`→`string`, `z.enum(LEAVE_STATUSES as [...])`).
- `npm run build` → 0 TS errors (clean).

NEXT: port test/ to leave_* tools.