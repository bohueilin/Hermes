# Hermes Future Evidence Authenticity Design — Design Only

## 1. Scope

This document defines a minimal credible future trust anchor. It is not authorized for Phase 6 implementation.

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

## 7. Rotation and revocation

- stable key ID;
- new key for rotation;
- bounded validity;
- independent revocation list or policy;
- signature retains original key ID;
- UI clearly distinguishes expired, revoked, untrusted, and valid signatures.

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
