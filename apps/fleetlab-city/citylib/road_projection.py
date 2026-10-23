"""Deterministic display-only road projection from the captured graph inventory."""


def project_roads(pack):
    features = []
    for r in pack["inventory"]:
        if r["scope"] == "outside-buffer" or len(r["source_nodes"]) < 2:
            continue
        coords = [pack["nodes"][n] for n in r["source_nodes"] if n in pack["nodes"]]
        if len(coords) < 2:
            continue
        features.append(
            {
                "type": "Feature",
                "id": r["id"],
                "properties": {k: r[k] for k in ("id", "name", "class", "status", "scope")},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [[round(x, 6), round(y, 6)] for x, y in coords],
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}
