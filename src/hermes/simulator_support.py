"""Import-safe simulator compatibility declarations and pure shared derivations.

This module contains data and pure derivations shared by the producer and the
stored-evidence verifier. It is deliberately outside ``hermes.adapters`` so stored
evidence verification can validate a recorded support profile without loading runtime
adapter code or an external simulator package.
"""

import math

SUPPORTED_METADRIVE_VERSION = "0.4.3"
SUPPORTED_METADRIVE_COMMIT = "85e5dadc6c7436d324348f6e3d8f8e680c06b4db"
SUPPORTED_METADRIVE_SOURCE = "third_party/metadrive"


def metadrive_map_for_gap(initial_gap_m: float | None) -> str:
    """Return the deterministic MetaDrive straight-map pattern for one challenge gap."""
    if initial_gap_m is None:
        return "S"

    # HermesChallengeManager.after_reset places the ego at longitude 5.0 m and uses
    # fixed 4.515 m ego and actor lengths (2.2575 m half-length each):
    # needed extent = 5.0 + 2.2575 + initial gap + 2.2575 = gap + 9.515 m.
    needed_extent_m = initial_gap_m + 9.515
    # This preserves byte identity for existing configurations, not worst-case safety:
    # one "S" guarantees only 50 + 40 = 90 m, while committed gaps reach 100.0 m
    # (109.515 m needed). Those runs rely on the sampled straight at their recorded
    # seed (seed 7 nominally yields 129.905 m); an unlucky seed fails loudly at actor
    # reset with RunOperationalError and publishes no evidence. This pre-existing
    # behavior must remain unchanged, so only the new above-threshold branch grows.
    if needed_extent_m <= 110.0:
        return "S"

    # MetaDrive's fixed first straight block is 50 m; every additional "S" contributes
    # at least 40 m (sampled range 40--80 m). Size from those fixed worst-case bounds,
    # not sampled geometry, with a 10 m margin so producer and verifier need no RNG state.
    blocks = math.ceil((needed_extent_m + 10.0 - 50.0) / 40.0)
    return "S" * blocks
