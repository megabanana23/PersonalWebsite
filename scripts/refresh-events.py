#!/usr/bin/env python3
"""Refresh public workshop statistics without browser scraping or dependencies."""

import argparse
from datetime import date, datetime, timezone
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


class StatsParser(HTMLParser):
    """Read only visible text in STEMENJ's #stats subtree, excluding scripts."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.active_depth = None
        self.ignored = 0
        self.parts = []
        self.regions = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"area", "base", "br", "col", "embed", "hr", "img", "input",
                   "link", "meta", "param", "source", "track", "wbr"}:
            return
        self.depth += 1
        if dict(attrs).get("id") == "stats":
            self.regions += 1
            self.active_depth = self.depth
        if self.active_depth is not None and tag in {"script", "style", "svg"}:
            self.ignored += 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if tag in {"area", "base", "br", "col", "embed", "hr", "img", "input",
                   "link", "meta", "param", "source", "track", "wbr"}:
            return
        if self.active_depth is not None:
            if tag in {"script", "style", "svg"} and self.ignored:
                self.ignored -= 1
            if self.depth == self.active_depth:
                self.active_depth = None
        self.depth -= 1

    def handle_data(self, data):
        if self.active_depth is not None and not self.ignored:
            value = " ".join(data.split())
            if value:
                self.parts.append(value)


def parse_stats(source):
    parser = StatsParser()
    parser.feed(source)
    if parser.regions != 1 or parser.active_depth is not None:
        raise ValueError("Expected one complete public event statistics section")
    parts = parser.parts
    if not parts or len(parts) % 2:
        raise ValueError("Statistics markup changed; keeping the published data")
    stats = []
    for number, label in zip(parts[::2], parts[1::2]):
        if not re.fullmatch(r"\d{1,6}", number) or re.search(r"\d", label):
            raise ValueError(f"Invalid statistic: {number!r}, {label!r}")
        if label in {s["label"] for s in stats}:
            raise ValueError(f"Duplicate statistic: {label}")
        stats.append({"label": label, "value": int(number)})
    attendance(stats)  # A missing attendance field must not turn into zero.
    return stats


def attendance(stats):
    matches = [s["value"] for s in stats
               if s["label"].casefold() in {"kids attended", "students attended"}]
    if len(matches) != 1:
        raise ValueError("Expected exactly one student attendance statistic")
    return matches[0]


def replace_region(page, key, content):
    start, end = f"<!-- {key}:start -->", f"<!-- {key}:end -->"
    if page.count(start) != 1 or page.count(end) != 1:
        raise ValueError(f"Missing or duplicate managed HTML region: {key}")
    pattern = re.escape(start) + r".*?" + re.escape(end)
    return re.sub(pattern, lambda _: start + content + end, page, flags=re.S)


def stat_html(label, value):
    return (f'<div class="event-stat"><small>{escape(label)}</small>'
            f'<strong>{escape(str(value))}</strong></div>')


def render(page, snapshot):
    events = snapshot["events"]
    results = [event for event in events if event["statistics"]]
    checked = datetime.fromisoformat(snapshot["checkedAt"].replace("Z", "+00:00"))
    total = sum(attendance(event["statistics"]) for event in results)
    summary = (
        f'\n        <div><strong>{len(results)}</strong><span>Workshops with results</span></div>'
        f'\n        <div><strong>{total}</strong><span>Student attendances</span></div>'
        '\n        <div><strong>Free</strong><span>Every workshop</span></div>\n        '
    )
    page = replace_region(page, "event-impact", summary)
    checked_date = checked.strftime("%B %d, %Y").replace(" 0", " ")
    page = replace_region(page, "event-updated",
                          f'Stats checked <time datetime="{checked.date()}">{checked_date}</time>.')
    for event in events:
        event_date = date.fromisoformat(event["date"])
        formatted = event_date.strftime("%B %d, %Y").replace(" 0", " ")
        cells = [("Date", formatted), ("Time", event["time"]),
                 ("Location", event["location"]), ("Cost", "Free")]
        if event.get("audience"):
            cells.append(("Audience", event["audience"]))
        cells.extend((s["label"], s["value"]) for s in event["statistics"])
        if not event["statistics"]:
            cells.append(("Attendance", "Results not yet published"))
        markup = '\n                <div class="event-stats">\n                  '
        markup += '\n                  '.join(stat_html(*cell) for cell in cells)
        markup += '\n                </div>\n'
        markup += (f'                <p class="workshop-stat-source"><a href="{escape(event["sourceUrl"], quote=True)}" '
                   'target="_blank" rel="noopener noreferrer">Source: STEMENJ '
                   + ('event recap' if event["statistics"] else 'event announcement')
                   + ' ↗</a></p>\n                ')
        page = replace_region(page, f'event-stats:{event["id"]}', markup)
    return page


def refresh(config, fetch):
    events = []
    for event in config:
        url = event["sourceUrl"]
        if not re.fullmatch(r"https://nj\.stemepa\.com/events/\d{4}-\d{2}-\d{2}", url):
            raise ValueError(f"Unexpected source URL: {url}")
        source = fetch(url)
        parser = TextParser()
        parser.feed(source)
        text = " ".join(parser.parts).casefold()
        if (event["sourceTitle"].casefold() not in text
                or event["sourceLocationToken"].casefold() not in text):
            raise ValueError(f'Source is not the expected workshop: {event["id"]}')
        if event["sourceType"] == "announcement":
            # An announcement may later acquire results at the same URL.
            stats_parser = StatsParser()
            stats_parser.feed(source)
            statistics = parse_stats(source) if stats_parser.regions else []
            details = parse_details(parser.parts)
            event_date = date.fromisoformat(event["date"])
            source_date = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", details["date"])
            parsed_date = datetime.strptime(source_date, "%B %d")
            if (parsed_date.month, parsed_date.day) != (event_date.month, event_date.day):
                raise ValueError(f'Workshop date changed: {event["id"]}')
            if event["sourceLocationToken"].casefold() not in details["location"].casefold():
                raise ValueError(f'Workshop venue changed: {event["id"]}')
            if details["cost"].rstrip("!").casefold() != "free":
                raise ValueError(f'Workshop cost changed: {event["id"]}')
            # Time comes from the visible announcement, rather than a cached value.
            event = {**event, "time": details["time"].replace(" - ", "–")}
        elif event["sourceType"] == "results":
            statistics = parse_stats(source)
        else:
            raise ValueError(f'Unknown source type: {event["sourceType"]}')
        events.append({**event, "statistics": statistics})
    return {"checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "events": events}


class TextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.ignored = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self.ignored += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self.ignored:
            self.ignored -= 1

    def handle_data(self, data):
        if not self.ignored and data.strip():
            self.parts.append(" ".join(data.split()))


def parse_details(parts):
    details = {}
    for key in ("location", "date", "time", "cost"):
        matches = [i for i, value in enumerate(parts) if value.casefold().endswith(key + ":")]
        if len(matches) != 1 or matches[0] + 1 >= len(parts):
            raise ValueError(f"Expected one announcement {key} field")
        details[key] = parts[matches[0] + 1]
    return details


def fetch_html(url):
    request = Request(url, headers={"User-Agent": "OmRamanathan-WorkshopStats/1.0"})
    with urlopen(request, timeout=30) as response:
        if response.headers.get_content_type() != "text/html":
            raise ValueError(f"Source returned non-HTML content: {url}")
        return response.read().decode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from-cache", action="store_true",
                        help="Rebuild HTML from the last verified snapshot without fetching")
    args = parser.parse_args()
    try:
        snapshot_path = ROOT / "data/events.json"
        if args.from_cache:
            snapshot = json.loads(snapshot_path.read_text())
        else:
            config = json.loads((ROOT / "data/event-sources.json").read_text())
            snapshot = refresh(config, fetch_html)
        page_path = ROOT / "index.html"
        original = page_path.read_text()
        updated = render(original, snapshot)
        # Finish all fetching, validation, and rendering before changing either file.
        if not args.from_cache:
            snapshot_path.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n")
        if updated != original:
            page_path.write_text(updated)
        print(f'Refreshed {len(snapshot["events"])} workshops; '
              f'{sum(attendance(e["statistics"]) for e in snapshot["events"] if e["statistics"])} published student attendances.')
    except (OSError, ValueError) as error:
        print(f"Event refresh failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
