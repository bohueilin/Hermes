# Hermes Future Evidence Authenticity Design — Design Only

## 1. Scope

This document defines a minimal credible future trust anchor. It is not authorized for Phase 6 implementation.

Phase 6 review schemas expose authenticity NOT_AUTHENTICATED, authorization NOT_EVALUATED,
deployment permission NONE, and authoritative status NOT_DEFINED. This future mechanism must never
overwrite gate verdict or integrity.

## 2. Why integrity is insufficient

Current local hashes establish internal consistency under the installed verifier. A bundle author can rewrite the complete bundle and recompute all hashes. Authenticity requires an independently trusted key and verification policy.

## 3. Separate concepts

| Concept | Question |
|---|---|
| Integrity | Are the captured files internally consistent? |
| Authenticity | Did an expected key sign this exact attestation? |
| Authorization | Was that identity allowed to attest for this purpose? |
| Provenance | What code, configuration, and environment are claimed? |
| Advancement permission | May the software move to the next stage? |
| Deployment permission | May it control a physical system? |

A valid signature answers only part of authenticity. It does not establish correctness, authorization, advancement, or deployment permission by itself.

## 4. Minimal attestation

Recommended detached canonical attestation:

```yaml
attestation_schema_version: "1.0"
project_identity: "bohueilin/Hermes"
bundle_digest_sha256: "..."
manifest_digest_sha256: "..."
evidence_schema_version: "..."
hermes_git_commit: "..."
signer_key_id: "..."
signer_identity: "..."
signing_scope: "development-simulation-evidence"
signature_algorithm: "Ed25519"
signed_at_utc: "..."
```

Files:

```text
attestation.json
attestation.sig
```

These should be external to or versioned alongside the existing evidence bundle without creating a self-reference cycle.

## 5. Key custody

Minimum credible options:

1. macOS Keychain-backed developer key for a local prototype.
2. Hardware-backed key for higher assurance.
3. CI signing identity for a controlled build or evaluation environment.

Never store private keys in:

- repository;
- artifact directory;
- committed `.env` files;
- source code;
- test fixtures representing real keys.

## 6. Trust policy

Verification requires an independently configured policy:

- accepted key IDs;
- signer identities;
- allowed signing scopes;
- validity windows;
- revoked keys;
- project or environment constraints.

The artifact cannot declare its own key trusted.

The policy owner must be independent of the artifact producer. Policy input includes accepted
project identity, key ID, signer identity, signing scope, validity interval, revocation state, and
allowed attestation schema. Unknown or ambiguous policy fails authentication closed.

## 7. Rotation and revocation

- stable key ID;
- new key for rotation;
- bounded validity;
- independent revocation list or policy;
- signature retains original key ID;
- UI clearly distinguishes expired, revoked, untrusted, and valid signatures.
- Emergency revocation and routine rotation are independently distributed policy updates; an
  artifact cannot remove or supersede them.
- Historical verification records the policy version used and never silently upgrades an old
  result.

## 8. Time limitation

A local signing timestamp is self-asserted unless bound to a trusted timestamp authority or transparency log. Do not claim trusted time in the minimal phase.

## 9. Optional append-only transparency

A later phase may publish attestation digests to an append-only log to reduce equivocation and deletion risk. This requires separate service, availability, privacy, and governance design.

## 10. UX states

```text
NOT_AUTHENTICATED
SIGNATURE_VALID_UNTRUSTED_KEY
AUTHENTICATED_EXPECTED_SIGNER
SIGNATURE_INVALID
SIGNATURE_EXPIRED
SIGNER_REVOKED
AUTHORIZATION_NOT_EVALUATED
```

Never collapse signature state into gate verdict.

## 11. Required predecessor for implementation

Before signing implementation:

- workbench trust states are stable;
- signer persona and signing scope are selected;
- key custody is selected;
- trust-policy owner is selected;
- rotation and revocation process is defined;
- threat model is approved;
- multi-user or approval use case is explicitly authorized.

## 12. Non-claims

Even authenticated evidence does not prove:

- correct policy behavior;
- correct simulator behavior;
- real-world safety;
- certification;
- deployment permission.

## 13. Phase 6 implementation status

Checkpoint `90fb7d8` intentionally implements none of the future signing design in sections 4-10.
The canonical ten-file evidence bundle is unchanged: it has no `attestation.json`,
`attestation.sig`, signature, signer, trust-policy, approval, promotion, or deployment-authority
field. The workbench has no sign, authenticate, approve, promote, release, or deploy action.

Both `ReviewEnvelope` and `ComparisonEnvelope` keep integrity separate from origin and authority.
Every current review exposes `NOT_AUTHENTICATED`; authorization remains `NOT_EVALUATED`;
deployment permission remains `NONE`; scope remains `SIMULATION_ONLY`; authoritative status
remains `NOT_DEFINED`. Adversarial tests also confirm that a coherent full-bundle rewrite can remain
internally consistent while these trust states remain unchanged.

The Phase 6 implementation therefore satisfies the predecessor requirement that trust dimensions
be stable, but it does not select a signer persona, custody mechanism, trust-policy owner,
rotation/revocation process, trusted time source, or multi-user approval use case. Those decisions
still require an explicitly authorized authenticity phase. The accepted process-cache P2 is an
availability concern and does not justify or imply signing, authorization, or deployment.
