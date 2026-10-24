# FleetLab release records

`fleetlab-current.json` records a historical publication. A local build does not
replace it or establish a new publication. Preserve its observed deployment and
readback facts until new evidence is available.

The tracked writer verifies the complete stage against a clean, exact source
commit before recording it:

```sh
node apps/fleetlab-city/deploy/record-release.mjs \
  --site "$STAGE/site" --source "$REPOSITORY" --commit "$SOURCE_COMMIT" \
  --out "$LOCAL_RECORD"
```

This produces `fleetlab.local-release/1.0.0`, with publication and readback marked
`NOT_PERFORMED`. `server_side: "none"` describes only the verified local static
stage. It does not assert the provider's configuration or what a later tool may
upload. The record grants no deployment permission.

After a separately authorized publication, supply the complete outputs from
`tools/readback.py --site` and `tools/check-headers.py`. The writer checks their
paths, digests, statuses, transport results and header values against the stage.
It performs no network request and does not treat a reported success flag as
sufficient evidence.

```sh
node apps/fleetlab-city/deploy/record-release.mjs \
  --site "$STAGE/site" --source "$REPOSITORY" --commit "$SOURCE_COMMIT" \
  --readback "$FULL_READBACK" --headers "$HEADER_READBACK" \
  --python "$PYTHON" --out docs/releases/fleetlab-current.json --replace
```

Both observations must cover `https://fleetlab.pages.dev`. The resulting
publication-readback record establishes consistency with supplied observations,
not independent authenticity, a deployment identifier, browser acceptance, or
operational authority. Replacement is explicit and atomic. Retain the full
observation files with the private release evidence; the record binds their hashes.
