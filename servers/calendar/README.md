# mcp-calendar

Your calendar app can show you next Tuesday. It cannot tell you where your week actually went, which two things you
said yes to at the same time, or how many billable hours last month's meetings were worth. This server reads the
`.ics` file your calendar already exports and answers those questions: events in any window with recurring series
expanded properly, merged busy blocks and the real free gaps inside your working hours, every double booking across
work and personal calendars at once, a clean `.ics` of just the events you picked, and the exact time entry for a
meeting you should have billed. No account is connected, nothing is synced, and the calendar file stays on your
machine as plain text.

Built by [theluckystrike](https://github.com/theluckystrike).

![calendar demo](../../assets/demo-calendar.gif)

**Import the .ics your calendar exports, then ask what is on, when you are free, and what clashes -- zero setup, all local.**

## 60-second install

npm publish for `@theluckystrike/mcp-calendar` is pending. Until then, the `.mcpb` one-click bundle or a clone+build
is the working path -- both are verified below.

**One-click (.mcpb):** download `calendar.mcpb` from the latest release and double-click it in Claude Desktop:
https://github.com/theluckystrike/mcp-servers/releases/latest

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "calendar": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-calendar"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add calendar -- npx -y @theluckystrike/mcp-calendar
```

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "calendar": {
      "command": "npx",
      "args": ["-y", "@theluckystrike/mcp-calendar"]
    }
  }
}
```

The `npx` form above starts working the moment the package is published. Until then, use the .mcpb bundle above,
or build from source with exactly these four commands:

```sh
git clone https://github.com/theluckystrike/mcp-servers.git && cd mcp-servers
npm install
npm run build -w packages/mcp-license -w servers/timezone -w servers/calendar
```

Then point your client's `command` at `node` with one arg: the absolute path to `servers/calendar/dist/index.js`.

To run in Pro mode set `MCP_LICENSE_KEY` in the same config block, or call `license_activate` once with your key.

## Getting the .ics out of your calendar

| App | Where |
| --- | --- |
| Google Calendar | Settings -> Import & export -> Export. You get a zip; import the `.ics` inside it. |
| Apple Calendar | File -> Export -> Export... |
| Outlook (desktop) | File -> Save Calendar, format iCalendar (.ics) |
| Outlook / Microsoft 365 (web) | Settings -> Calendar -> Shared calendars -> Publish, then use the ICS link (Pro) |
| Anything else | Any published feed URL ending in `.ics`, or `webcal://` (Pro) |

Then: `ics_import {path: "~/Downloads/mike@example.com.ics", name: "work"}`

## Tools

| Tool | What it does |
| --- | --- |
| `ics_import` | Read a `.ics` file (`path`), pasted contents (`text`) or a public feed (`url`, Pro) and keep it locally under a name. Importing the same name again replaces it. |
| `calendars_list` | Every imported calendar: name, source, event count, size, when it was imported. |
| `events_list` | Every event between two dates with recurring series expanded to real occurrences, sorted, in your own time zone. Each row carries an id. |
| `events_search` | Events whose title, description, location, organizer or attendees contain a phrase. |
| `free_busy` | Merged busy blocks and the free gaps inside your working hours, day by day. Events marked free/transparent do not count as busy. |
| `conflicts` | Every pair of events that overlap, with the overlap in minutes -- across all calendars, so a client call clashing with a school run is caught. A longer window is shortened to the free 31 days and answered, never refused. |
| `next_event` | The next thing that has not started, and how long until it does. |
| `event_export` | Write chosen events (by id, or a whole window) to a new `.ics` you can send. Times in UTC, so it lands correctly in any client. |
| `event_to_time_entry` | Turn one meeting into the exact arguments for the time-tracker's `entry_add`, so a call becomes billable time without retyping it. |
| `ics_forget` | Remove one calendar and its local copy. |
| `license_status` / `license_activate` | Show the tier; activate a Pro key offline. |

Resource `calendar://today` gives today's schedule in one read. Prompt `plan_my_day` walks the whole loop: what is on,
what clashes, where the free stretches are, and which finished meetings to bill.

### What the parser handles

Written against real exports, not just the spec: line folding (CRLF, bare LF and bare CR, and folds that Exchange
places inside a multi-byte character, which are rejoined on the bytes before decoding), `\n \, \; \\` escaping,
whole-day events with an exclusive `DTEND`, `DURATION` instead of `DTEND`, `TZID` and UTC times, floating times,
`RRULE` for `HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY` and `YEARLY` with `COUNT`, `UNTIL` (inclusive), `INTERVAL`,
`BYDAY` including ordinals (`2MO`, `-1FR`), `BYMONTHDAY`, `BYMONTH` and `BYSETPOS`, `EXDATE`, `RDATE`,
`RECURRENCE-ID` overrides (the moved instance replaces the original instead of appearing twice),
`STATUS:CANCELLED`, `TRANSP:TRANSPARENT`, and `VALARM` blocks inside an event. An event it cannot read is skipped
and counted rather than costing you the rest of the file.

`FREQ=MINUTELY` and `FREQ=SECONDLY` are deliberately not expanded: one such rule fills any window with thousands of
occurrences and buries the rest of the week. Those events are listed at their first occurrence and the reason is
said out loud. A rule with no `COUNT` and no `UNTIL` is expanded only as far as the window you asked for.

Exports written by this server keep whole-day events as `DATE` values, so a holiday leaves as the same day it
arrived rather than a timed block on the day before in your machine's zone.

`VTIMEZONE` is deliberately ignored. A file's inline DST rules are only as fresh as the app that wrote it; the `TZID`
is kept and every offset is computed from the ICU data inside your Node build instead, which is what keeps a weekly
Warsaw 10:00 meeting at 10:00 local across the March clock change.

## Free vs Pro

| | Free | Pro ($19 one-time) |
| --- | --- | --- |
| Calendars kept | 2 | unlimited |
| Window per question | up to 31 days | any window |
| `conflicts` over a longer window | answered for the first 31 days, cap named | any window |
| Events per export | 50 | unlimited |
| Import from a URL or webcal feed | -- | yes |
| Everything else | full | full |

[Get Pro](https://mcp.zovo.one/buy/calendar) -- or $39 for every server in the suite, lifetime.

## Privacy

Everything is local. The calendar file you import is copied to
`${XDG_DATA_HOME:-~/.local/share}/mcp-servers/calendar/` and read from there; deleting that directory resets the
server. There is exactly one network call in the whole server, and only when you pass a `url` yourself: it fetches
that address once, with a 12-second timeout, a 5 MB cap, and a refusal on loopback, private and cloud-metadata
addresses. Nothing is uploaded, no account is linked, and licence keys verify offline.

## Pairs with

- [mcp-timezone](../timezone/README.md) -- this server reads its time zone and `.ics` engine from it: convert a meeting time, find slots across countries, write an invite.
- [mcp-time-tracker](../time-tracker/README.md) -- `event_to_time_entry` hands it a finished meeting; it tracks and reports the hours.
- [mcp-invoice](../invoice/README.md) -- turn those tracked hours into a numbered invoice.
- [office-suite](../office-suite/README.md) -- several servers behind one install, one config entry.

## FAQ

**Does it connect to my Google or Outlook account?**
No. There is no OAuth, no token and no sync. You export a file (or paste a public feed URL on Pro) and it is read
locally. That also means an import is a snapshot: re-import when the calendar has moved on.

**Do recurring events work properly?**
Yes, and that is most of the code. A weekly series is expanded on the wall clock, so a Warsaw 10:00 meeting stays
10:00 through the DST change rather than drifting to 11:00. Monthly on the 31st skips February instead of rolling into
March, `UNTIL` includes the occurrence that falls exactly on it, and a single moved instance replaces the original.

**Why is my whole-day event one day shorter than I expected?**
It is not: RFC 5545 makes `DTEND` exclusive for a whole-day event, so 1--3 June means the 1st and the 2nd. This
server follows the spec, which is what your calendar app does too.

**Can it write to my calendar?**
It writes `.ics` files with `event_export`, which you can import anywhere. It never modifies the calendar it read.

**How big a file can it read?**
5 MB, which is a few thousand events. Export a narrower date range if a full history is bigger than that.
