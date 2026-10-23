# FleetLab release token input

This interface does not grant permission to publish. An owner must separately authorize the exact source commit and target. The wrapper does not retrieve Keychain items or create credentials.

For each owner-operated remote invocation, supply these process environment inputs through an owner-controlled, ephemeral injector outside the agent session:

| Input | Contract |
| --- | --- |
| `FLEETLAB_DEPLOY_TOKEN_REF` | Non-secret metadata: `keychain:<item-name>`. The item name has 1–128 ASCII letters, digits, dots, underscores or hyphens and starts with a letter or digit. Example metadata: `keychain:fleetlab-pages-release`. |
| `CLOUDFLARE_API_TOKEN` | The owner-injected value. It must be a nonempty string. The wrapper forwards it opaquely; it does not parse, normalize, display or persist it. Never place the value in command arguments, shell profiles, env files, documentation or chat. |
| `CLOUDFLARE_ACCOUNT_ID` | Optional non-secret account selection: exactly 32 hexadecimal characters. Supply the ID of the account containing `fleetlab` when a scoped token cannot discover accounts. Only Wrangler receives this input. Omission retains discovery; malformed supplied values refuse before Git or installation. This does not grant access or verify the token's scope. |

Deployment and deployment listing refuse missing/empty token inputs, missing/malformed references or malformed account IDs before Git, installation or release tools run. The local `--version` path does not require, read or forward these inputs. Other local build tools are unchanged.

The reference is a label, not proof that the value came from that item. The wrapper cannot establish token validity, permissions, account inventory, expiry or revocation offline. Account scope, expiry and the actual injector remain owner verification work, recorded separately for each release. Account-scoped Pages Edit is not existing-project-only authority. Explicit account selection skips discovery; it does not bypass Cloudflare's project authorization.

After capture, the wrapper removes all three inputs from its inherited environment. Git, verification builders and npm do not receive them. Only the explicit Wrangler environment receives the opaque token and selected account ID. Wrangler uses a fresh home and configuration directory, fixed log sanitization and no OS keyring authentication; the temporary home is removed on exit. The hash-pinned CLI receives checked patches that substitute a generic authentication error when upstream header validation fails and disable redundant Git discovery. Wrangler's own stdin is closed: account-selection or project-creation prompts cannot continue. Owner confirmation happens in the wrapper.

Production is the allowlisted Cloudflare branch `feat/fleetlab-playground`. Before installation or Wrangler execution, the wrapper displays the full source commit and target and requires the exact first 12 commit characters plus Enter in an interactive terminal. EOF, mismatch and redirected input/output refuse. It rechecks the source, stage and configuration after the prompt. Preview branch `codex-city-explorer`, listing and local version checks do not prompt.

All automated evidence uses synthetic inputs. No live token, Keychain retrieval, Cloudflare request or deployment is part of these tests. The first owner-operated real release still requires separate authorization and verification.
