"""Shared bounded YAML parser rejecting ambiguity-producing YAML features."""

from __future__ import annotations

from typing import Any

import yaml
from yaml.constructor import ConstructorError


class StrictYamlError(ValueError):
    """YAML input is unsafe, ambiguous, malformed, or outside the supported subset."""


class _UniqueKeySafeLoader(yaml.SafeLoader):
    pass


def _construct_unique_mapping(
    loader: yaml.SafeLoader,
    node: yaml.MappingNode,
    deep: bool = False,
) -> dict[str, Any]:
    mapping: dict[str, Any] = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if not isinstance(key, str):
            raise ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                "mapping keys must be strings",
                key_node.start_mark,
            )
        if key == "<<":
            raise ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                "YAML merge keys are not supported",
                key_node.start_mark,
            )
        if key in mapping:
            raise ConstructorError(
                "while constructing a mapping",
                node.start_mark,
                f"duplicate key: {key!r}",
                key_node.start_mark,
            )
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


_UniqueKeySafeLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_unique_mapping,
)


def load_strict_yaml(text: str) -> dict[str, Any]:
    """Load the supported YAML subset with unique keys and no aliases or anchors."""
    try:
        for token in yaml.scan(text):
            if isinstance(token, (yaml.tokens.AliasToken, yaml.tokens.AnchorToken)):
                raise StrictYamlError("YAML aliases and anchors are not supported")
            if isinstance(token, yaml.tokens.ScalarToken) and token.value == "<<":
                raise StrictYamlError("YAML merge keys are not supported")
        payload = yaml.load(text, Loader=_UniqueKeySafeLoader)
    except StrictYamlError:
        raise
    except (RecursionError, yaml.YAMLError) as exc:
        raise StrictYamlError(str(exc)) from exc
    if not isinstance(payload, dict):
        raise StrictYamlError("YAML root must be a mapping")
    return payload
