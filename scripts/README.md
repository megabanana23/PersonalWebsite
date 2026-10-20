# Workshop statistics

Run from the repository root:

```sh
python3 scripts/refresh-events.py
```

The refresh fetches every organizer source in `data/event-sources.json`, reads all
published statistics from the visible `#stats` section, and updates the events
section in `index.html` plus the source snapshot in `data/events.json`. Visitors
see the verified data immediately, including when JavaScript is disabled.

The page covers five Fanwood workshops and the Snap Circuits workshop at Henry
Inman Branch Library in Colonia. It shows all organizer statistics, a last-checked
date, a source link for each workshop, and the total published student attendances. Attendances are workshop
visits, not a count of unique students. Projects, bridges, challenges, and groups
keep their original labels and are not added together. An announcement without
published results shows "Results not yet published" and is excluded from both
the attendance total and the count of workshops with results. The Colonia
announcement's date, venue, and free admission are verified during refresh;
its time is scraped directly. The library listing supplies its audience and
confirms Om and his STEMENJ team lead the workshop.

A failed fetch, missing attendance field, changed stats markup, or unrelated
event page stops the refresh before replacing published results. Review the
diff before committing and publishing through the existing GitHub Pages flow.

Fanwood dates and times in `event-sources.json` are the workshop dates already
recorded on this site. Recap URL dates are publication dates and must not replace
event dates. The Fanwood library listings returned HTTP 403 during this update.
The organizer's announcements corroborate four Fanwood dates, but the Scratch
announcement says June 25 while this site records July 25. Its recap does not
resolve that discrepancy, so July 25 was retained pending confirmation.

To add a workshop, add its known date/time and verified recap URL to
`event-sources.json`, add its details and gallery to `index.html`, and include
the `event-stats:<workshop-id>:start` and `:end` HTML comment markers around its
stats block. Add it to past results only after it has taken place. Set
`sourceType` to `results` for recaps or `announcement` for scheduled workshops;
set `sourceLocationToken` to text that identifies its venue on the source page.
When a Colonia recap is published, update its URL and source type, and move its
details into the past-results group. The title and venue are checked to prevent
an unrelated STEMENJ event from being attributed to this program.

Rebuild HTML from the stored snapshot without network access:

```sh
python3 scripts/refresh-events.py --from-cache
```

Check the scraper against the saved organizer stats fixtures:

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
```
