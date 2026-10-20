"""Protect published stats from missing fields, unrelated pages, and source drift."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("refresh_events", ROOT / "scripts/refresh-events.py")
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class EventStatsTests(unittest.TestCase):
    def test_organizer_fixtures_and_all_statistics(self):
        expected = {
            "marshmallow-tower": [("Students Attended", 9), ("Projects", 9)],
            "lego-city": [("Students Attended", 18)],
            "scratch": [("Kids Attended", 10), ("Amazing Projects", 9)],
            "lego-bridge": [("Kids Attended", 14), ("Bridges", 14), ("Creative Designs", 14)],
            "light-sound": [("Kids Attended", 12), ("Mini challenges", 5), ("Groups", 6)],
        }
        total = 0
        for name, stats in expected.items():
            with self.subTest(event=name):
                source = (ROOT / f"tests/fixtures/events/{name}.html").read_text()
                parsed = module.parse_stats(source)
                self.assertEqual([(s["label"], s["value"]) for s in parsed], stats)
                total += module.attendance(parsed)
        self.assertEqual(total, 63)

    def test_rejects_missing_malformed_and_duplicate_statistics(self):
        for body in ["", '<div id="stats">10',
                     '<div id="stats">ten<div>Kids Attended</div></div>',
                     '<div id="stats">9<div>Projects</div></div>',
                     '<div id="stats">10<div>Kids Attended</div>11<div>Kids Attended</div></div>',
                     '<div id="stats">10<div>Kids Attended</div></div><div id="stats"></div>']:
            with self.subTest(source=body), self.assertRaises(ValueError):
                module.parse_stats(body)

    def test_ignores_numbers_outside_stats_and_script_content(self):
        html = ('<div>999 attendees</div><div id="stats"><svg><text>55</text></svg>'
                '<script>77</script><div>10</div><div>Kids Attended</div></div>')
        self.assertEqual(module.attendance(module.parse_stats(html)), 10)

    def test_unrelated_source_does_not_pass_identity_check(self):
        config = json.loads((ROOT / "data/event-sources.json").read_text())
        with self.assertRaises(ValueError):
            module.refresh(config, lambda url: '<h1>Other workshop</h1><div id="stats">10<div>Kids Attended</div></div>')

    def test_colonia_announcement_scrapes_details_without_inventing_attendance(self):
        event = json.loads((ROOT / "data/event-sources.json").read_text())[0]
        source = (ROOT / "tests/fixtures/events/colonia-announcement.html").read_text()
        snapshot = module.refresh([event], lambda url: source)
        self.assertEqual(snapshot["events"][0]["statistics"], [])
        self.assertEqual(snapshot["events"][0]["time"], "1:00 PM–2:00 PM")
        page = module.render((ROOT / "index.html").read_text(), snapshot)
        self.assertIn("Results not yet published", page)
        self.assertIn('<strong>0</strong><span>Student attendances</span>', page)

    def test_colonia_announcement_rejects_changed_date_or_cost(self):
        event = json.loads((ROOT / "data/event-sources.json").read_text())[0]
        source = (ROOT / "tests/fixtures/events/colonia-announcement.html").read_text()
        for original, replacement in [("October 10th", "October 17th"), ("Free!", "$10")]:
            with self.subTest(field=original), self.assertRaises(ValueError):
                module.refresh([event], lambda url: source.replace(original, replacement))

    def test_render_is_repeatable_and_preserves_galleries(self):
        page = (ROOT / "index.html").read_text()
        snapshot = json.loads((ROOT / "data/events.json").read_text())
        updated = module.render(page, snapshot)
        self.assertEqual(module.render(updated, snapshot), updated)
        self.assertEqual(updated, page)
        self.assertEqual(updated.count('data-photo-carousel'), page.count('data-photo-carousel'))
        self.assertIn('<strong>63</strong>', updated)
        self.assertNotIn('Registration open', updated)

    def test_missing_marker_fails_before_publishing(self):
        with self.assertRaises(ValueError):
            module.replace_region("<p>Existing content</p>", "event-impact", "replacement")


if __name__ == "__main__":
    unittest.main()
