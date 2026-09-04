"""Fleet CLI metric-contract behavior."""

from typer.testing import CliRunner

from hermes.cli import app
from hermes.fleet.metrics import METRIC_REGISTRY_VERSION, Availability, definitions

runner = CliRunner()


def test_metrics_list_prints_every_registered_definition_from_the_registry() -> None:
    """The metrics command renders every field from the registered contract."""
    result = runner.invoke(app, ["fleet", "metrics", "list"])

    assert result.exit_code == 0
    registered_definitions = definitions()
    assert (
        f"Metric registry {METRIC_REGISTRY_VERSION} - {len(registered_definitions)} metrics "
        "- simulation only; synthetic; not a forecast"
    ) in result.output

    previous_index = -1
    conditional_definitions = [
        definition
        for definition in registered_definitions
        if definition.availability is Availability.CONDITIONAL
    ]
    always_definitions = [
        definition
        for definition in registered_definitions
        if definition.availability is Availability.ALWAYS
    ]
    assert len(conditional_definitions) == 3
    assert len(always_definitions) == 7

    for definition in registered_definitions:
        definition_index = result.output.index(definition.name)
        assert definition_index > previous_index
        previous_index = definition_index
        assert f"unit: {definition.unit}" in result.output
        assert f"direction: {definition.direction.value}" in result.output
        assert f"aggregation: {definition.aggregation.value}" in result.output
        assert f"population: {definition.population}" in result.output
        assert f"availability: {definition.availability.value}" in result.output
        assert ", ".join(surface.value for surface in definition.surfaces) in result.output
        if definition.absent_when is not None:
            assert f"absent when: {definition.absent_when}" in result.output
        if definition.alias_of is not None:
            assert f"alias of {definition.alias_of}" in result.output
        if definition.descriptive_rank is not None:
            assert f"descriptive rank {definition.descriptive_rank}" in result.output


def test_metrics_list_is_deterministic() -> None:
    """The metrics command emits stable contract text on repeated invocations."""
    first = runner.invoke(app, ["fleet", "metrics", "list"])
    second = runner.invoke(app, ["fleet", "metrics", "list"])

    assert first.exit_code == 0
    assert second.exit_code == 0
    assert first.output == second.output
