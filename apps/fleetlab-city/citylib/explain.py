"""Deterministic F0 explanation + bounded mockable F1 interface. No live transport installed."""

import copy
import re

from .contracts import digest


def explain(summary, provider="template", allow_paid=False, remaining_usd=0, transport=None):
    metrics = copy.deepcopy(summary.get("metrics", {}))
    base = {
        "schema": "fleetlab.generated-explanation/1.0.0",
        "provider": "template",
        "status": "DETERMINISTIC_TEMPLATE",
        "decision_authority": "NONE",
        "source_digest": digest(summary),
        "numeric_fields": metrics,
        "text": (
            "Read completion over all created requests, then inspect unfinished "
            "work, empty distance, wait and resource queues. Map qualification and "
            "simulation limits remain separate from the numerical result."
        ),
        "hypotheses": [],
        "references": sorted(metrics),
    }
    if provider == "template":
        return base
    if not allow_paid or remaining_usd <= 0.25 or transport is None:
        return {
            **base,
            "optional_provider_status": "NOT_RUN",
            "reason": "No qualified live transport/budget ledger; deterministic fallback",
        }
    # Transport injection is for tests/local adapter qualification only. No key lookup or
    # network path.
    try:
        draft = transport(
            {"allowed_metrics": metrics, "scope": "SIMULATION_ONLY", "no_authority": True}
        )
        if set(draft) != {"references", "text", "hypotheses"}:
            raise ValueError("draft schema")
        if not isinstance(draft["references"], list) or any(
            r not in metrics for r in draft["references"]
        ):
            raise ValueError("unknown reference")
        text = draft["text"]
        if not isinstance(text, str) or not 1 <= len(text) <= 3000:
            raise ValueError("text bounds")
        if re.search(r"[0-9<>]|\b(deploy|approve|override|certif|safe to|verdict)\w*", text, re.I):
            raise ValueError("authority/numeric substitution")
        if not isinstance(draft["hypotheses"], list) or draft["hypotheses"]:
            raise ValueError("unqualified hypotheses")
        return {
            **base,
            **draft,
            "provider": "fireworks-mockable-adapter",
            "status": "DRAFT_REQUIRES_HUMAN_REVIEW",
        }
    except (ValueError, TypeError, KeyError, TimeoutError, ConnectionError):
        return {
            **base,
            "optional_provider_status": "FALLBACK",
            "reason": "Provider response failed qualification",
        }
