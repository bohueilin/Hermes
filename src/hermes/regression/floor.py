"""The requirement floor: a draft may add coverage, never subtract it.

This closes an authority-laundering channel (PRD §0-A.8.4). An agent that cannot change a
verdict directly could otherwise change what counts as passing — propose a "regression"
scenario that quietly drops the AEB expectation, get it approved because it looks like added
coverage, and thereafter every controller passes it.

The floor is enforced by the deterministic validator, not by the approval step, for the same
reason enforcement lives in the tool layer generally: a human approving a plausible-looking
YAML diff is a weak check, and asking one to spot a *missing* requirement is weaker still.

Two rules:

* **Mandatory minimum.** Any scenario tagged for an ADAS function must declare the
  expectations that make a run of it judgeable at all.
* **No weakening.** Relative to the scenario it derives from, a draft may add functions,
  requirements and tags, and may not remove them or soften a declared expectation.
"""

from __future__ import annotations

from hermes.domain.models import ScenarioDefinition
from hermes.regression.models import FloorViolation

#: Expectation strength, so "weakening" is an ordering rather than a special case.
#:
#: `forbidden` and `required` are both stronger than absence: each makes a definite claim the
#: evaluators can fail. `none` declines to claim anything about warnings.
_AEB_STRENGTH = {None: 0, "forbidden": 1, "required": 1}
_FCW_STRENGTH = {None: 0, "none": 1, "required": 2}


def _adas_functions(scenario: ScenarioDefinition) -> frozenset[str]:
    return frozenset(scenario.adas.enabled) if scenario.adas is not None else frozenset()


def _requirement_ids(scenario: ScenarioDefinition) -> frozenset[str]:
    return frozenset(item.property_id for item in scenario.requirements)


def mandatory_minimum_violations(scenario: ScenarioDefinition) -> tuple[FloorViolation, ...]:
    """Check a scenario declares enough for its own results to mean anything."""
    violations: list[FloorViolation] = []
    functions = _adas_functions(scenario)
    if not functions:
        return ()

    if "aeb" in functions and (scenario.adas is None or scenario.adas.expected_aeb is None):
        violations.append(
            FloorViolation(
                rule="aeb_expectation_required",
                detail=(
                    "a scenario enabling aeb must declare expected_aeb; without it neither "
                    "a missed intervention nor a false one can be judged"
                ),
            )
        )
    if "fcw" in functions and (scenario.adas is None or scenario.adas.expected_fcw is None):
        violations.append(
            FloorViolation(
                rule="fcw_expectation_required",
                detail="a scenario enabling fcw must declare expected_fcw",
            )
        )
    return tuple(violations)


def weakening_violations(
    source: ScenarioDefinition,
    draft: ScenarioDefinition,
) -> tuple[FloorViolation, ...]:
    """Check a draft does not reduce the coverage of the scenario it derives from."""
    violations: list[FloorViolation] = []

    removed_functions = _adas_functions(source) - _adas_functions(draft)
    if removed_functions:
        violations.append(
            FloorViolation(
                rule="no_function_removal",
                detail=f"draft drops ADAS functions present in the source: "
                f"{', '.join(sorted(removed_functions))}",
            )
        )

    removed_requirements = _requirement_ids(source) - _requirement_ids(draft)
    if removed_requirements:
        violations.append(
            FloorViolation(
                rule="no_requirement_removal",
                detail=f"draft drops requirements present in the source: "
                f"{', '.join(sorted(removed_requirements))}",
            )
        )

    removed_tags = frozenset(source.tags) - frozenset(draft.tags)
    if removed_tags:
        violations.append(
            FloorViolation(
                rule="no_tag_removal",
                detail=(
                    "draft drops tags present in the source, which would remove it from "
                    f"suite selections: {', '.join(sorted(removed_tags))}"
                ),
            )
        )

    source_aeb = source.adas.expected_aeb if source.adas is not None else None
    draft_aeb = draft.adas.expected_aeb if draft.adas is not None else None
    if _AEB_STRENGTH[None if draft_aeb is None else draft_aeb.kind] < _AEB_STRENGTH[
        None if source_aeb is None else source_aeb.kind
    ]:
        violations.append(
            FloorViolation(
                rule="no_aeb_expectation_weakening",
                detail="draft removes the source's declared AEB expectation",
            )
        )
    if (
        source_aeb is not None
        and draft_aeb is not None
        and source_aeb.kind != draft_aeb.kind
    ):
        # Not strictly weaker, but a draft that flips required to forbidden is asserting the
        # opposite of the coverage it claims to extend. That is a new scenario, not a
        # regression case, and it must be authored deliberately rather than derived.
        violations.append(
            FloorViolation(
                rule="no_aeb_expectation_inversion",
                detail=(
                    f"draft changes expected_aeb from {source_aeb.kind!r} to "
                    f"{draft_aeb.kind!r}; a derived regression may not invert its source"
                ),
            )
        )

    source_fcw = source.adas.expected_fcw if source.adas is not None else None
    draft_fcw = draft.adas.expected_fcw if draft.adas is not None else None
    if _FCW_STRENGTH[None if draft_fcw is None else draft_fcw.kind] < _FCW_STRENGTH[
        None if source_fcw is None else source_fcw.kind
    ]:
        violations.append(
            FloorViolation(
                rule="no_fcw_expectation_weakening",
                detail="draft weakens or removes the source's declared FCW expectation",
            )
        )
    return tuple(violations)


def enforce_floor(
    source: ScenarioDefinition,
    draft: ScenarioDefinition,
) -> tuple[FloorViolation, ...]:
    """Every way a draft fails the floor, reported together rather than one at a time."""
    return (*mandatory_minimum_violations(draft), *weakening_violations(source, draft))
