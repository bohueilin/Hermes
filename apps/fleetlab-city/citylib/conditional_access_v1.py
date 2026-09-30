"""Small explicit temporal predicate subset, not a driving-permission evaluator.

Only restrictive values, one clause, daily/weekday clock windows, and ordinary
passenger cars in America/Los_Angeles are supported. An inactive predicate does
not imply access. Importer, fleet engine, and routing integration are separate.
"""

import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

PROFILE = "fleetlab.conditional-predicate/1.0.0"
ZONE = "America/Los_Angeles"
DAYS = ("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su")
VALUES = frozenset({"no", "no_left_turn", "no_right_turn", "no_straight_on", "no_u_turn"})
_PATTERN = re.compile(
    r"(?P<value>[a-z_]+) @ \((?:(?P<days>Mo|Tu|We|Th|Fr|Sa|Su)"
    r"(?:-(?P<last>Mo|Tu|We|Th|Fr|Sa|Su))? )?"
    r"(?P<windows>[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2}"
    r"(?:,[0-9]{2}:[0-9]{2}-[0-9]{2}:[0-9]{2})*)\)"
)


@dataclass(frozen=True)
class ConditionalRule:
    raw: str
    value: str
    weekdays: tuple[int, ...]
    windows: tuple[tuple[int, int], ...]
    profile: str = PROFILE


@dataclass(frozen=True)
class ConditionalEvaluation:
    active: bool
    value: str | None
    local_timestamp: str
    raw: str
    profile: str = PROFILE


def _minutes(value):
    hour, minute = map(int, value.split(":"))
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        raise ValueError("unsupported clock time")
    return hour * 60 + minute


def parse_condition(expression):
    """Parse an exact bounded subset. No unknown expression becomes inactive."""
    if not isinstance(expression, str) or len(expression) > 256:
        raise ValueError("conditional expression exceeds supported bounds")
    match = _PATTERN.fullmatch(expression)
    if not match or match["value"] not in VALUES:
        raise ValueError("unsupported conditional expression or value")
    first = DAYS.index(match["days"]) if match["days"] else 0
    last = DAYS.index(match["last"]) if match["last"] else first
    if first > last:
        raise ValueError("wrapped weekday ranges are unsupported")
    weekdays = tuple(range(first, last + 1)) if match["days"] else tuple(range(7))
    windows = tuple(tuple(_minutes(t) for t in w.split("-")) for w in match["windows"].split(","))
    if len(windows) > 4 or any(a == b for a, b in windows):
        raise ValueError("unsupported equal endpoints or too many windows")
    # Reject overlaps, including next-day portions of midnight-wrapping windows.
    covered = set()
    for start, end in windows:
        span = range(start, end if end > start else end + 1440)
        week = {(day * 1440 + minute) % 10080 for day in weekdays for minute in span}
        if covered & week:
            raise ValueError("overlapping conditional windows are unsupported")
        covered.update(week)
    return ConditionalRule(expression, match["value"], weekdays, windows)


def local_instant(timestamp, *, vehicle_class, timezone_name):
    """Require explicit supported context and an unambiguous instant."""
    if vehicle_class != "passenger_car" or timezone_name != ZONE:
        raise ValueError("unsupported vehicle class or timezone context")
    if not isinstance(timestamp, datetime) or timestamp.utcoffset() is None:
        raise ValueError("an aware traversal timestamp is required")
    if isinstance(timestamp.tzinfo, ZoneInfo):
        utc = timestamp.astimezone(UTC)
        roundtrip = utc.astimezone(timestamp.tzinfo)
        if roundtrip.replace(tzinfo=None) != timestamp.replace(tzinfo=None):
            raise ValueError("nonexistent local timestamp")
        if timestamp.replace(fold=0).utcoffset() != timestamp.replace(fold=1).utcoffset():
            raise ValueError("ambiguous local timestamp; supply UTC or an explicit fixed offset")
    return timestamp.astimezone(ZoneInfo(ZONE))


def evaluate_condition(rule, timestamp, *, vehicle_class, timezone_name):
    """Evaluate [start,end) at the traversal instant; None is not permission."""
    if not isinstance(rule, ConditionalRule) or parse_condition(rule.raw) != rule:
        raise ValueError("conditional rule differs from its supported raw expression")
    local = local_instant(timestamp, vehicle_class=vehicle_class, timezone_name=timezone_name)
    minute = local.hour * 60 + local.minute + local.second / 60 + local.microsecond / 60000000
    active = False
    for start, end in rule.windows:
        if end > start:
            active |= local.weekday() in rule.weekdays and start <= minute < end
        else:
            active |= local.weekday() in rule.weekdays and minute >= start
            active |= (local - timedelta(days=1)).weekday() in rule.weekdays and minute < end
    return ConditionalEvaluation(
        bool(active), rule.value if active else None, local.isoformat(), rule.raw
    )
