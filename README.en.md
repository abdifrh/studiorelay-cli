# StudioRelay CLI · Claude Code & Codex

[Français](README.md) · **English**

Connect your production studio to [StudioRelay](https://studiorelay.fr) to prepare, upload and schedule videos using Claude Code or Codex. One CLI, a local stdio MCP server and a Skill for each assistant reuse the existing StudioRelay API.

**Source version: 0.3.0 · MIT license · Windows, macOS and Linux.** The package is available on [npm](https://www.npmjs.com/package/@studiorelay/cli). The private backend and social platform credentials are not distributed.

## Contents

- [Installation](#installation)
- [Connect and choose an assistant](#connect-and-choose-an-assistant)
- [First use](#first-use)
- [Editorial rules and automatic approval](#editorial-rules-and-automatic-approval)
- [CLI commands and MCP tools](#cli-commands-and-mcp-tools)
- [Video manifest](#video-manifest)
- [Security and responsibilities](#security-and-responsibilities)
- [Troubleshooting](#troubleshooting)
- [Update and uninstall](#update-and-uninstall)
- [Development and distribution](#development-and-distribution)


## Independent studios and assistant subscriptions · 0.3.0

Each media root now holds `.studiorelay/config.json`: server, profile, absolute media root, and pinned integration/brand identity, **no tokens**. Credentials remain in the OS keychain, separated by server/profile. Use a unique profile per studio; otherwise a path-based profile is generated.

```sh
cd /absolute/path/to/studio
studiorelay init --server https://studiorelay.fr --media-root /absolute/path/to/studio --profile my-studio --expect-brand brand-slug
studiorelay login
studiorelay doctor
studiorelay accounts
studiorelay claude install
studiorelay codex install
```

Run inside that studio or its subfolders; use `--studio ABSOLUTE_PATH` from elsewhere. Optional `--expect-brand` rejects a wrong brand even on first login. Login then pins the integration ID and brand. A different integration is rejected before replacing saved credentials. A configured directory is not silently retargeted by init.

Installers now configure project MCP (`.mcp.json` for Claude, a managed block in `.codex/config.toml` for Codex), plus project Skills. MCP arguments explicitly pin `--studio`; concurrently running studios cannot switch each other's context through init. Other MCP entries and assistant subscription/auth settings are preserved. Approve project MCP/trust if requested and restart the assistant. [Official Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp).

Any Claude subscription or Codex account can use the same studio on the same OS session. Select the assistant account using the host's own authentication; StudioRelay never selects or rotates subscriptions or manages their credit balances. Your StudioRelay brand permission remains separate.

The Skill must call identity and list_accounts, display the root/brand/targets, and compare against the request before preparation. The client also verifies integration and brand using the same bearer as each request; a changed config blocks the running process until restart. Server permissions remain authoritative. This is an identity safeguard, not a guarantee about content or host behavior.

**Existing sessions:** init inside each correct root using its old profile and optional expected brand; global config remains untouched. Run `studiorelay bind` to verify and pin an already-stored session without logging in or creating a new integration. If unavailable, login and select the existing integration. If all previous studios used default, only one local credential was retained: reconnect each studio with a distinct profile. Remote brands and scheduled publications are preserved.

Legacy global configuration requires explicit `init --global`; login, MCP and publishing without local config now require explicit `--global`. Do not use that mode for parallel studios. Check the actual MCP entry and identity after migration; doctor shows the selected config path. A corrupt or explicit missing local config never silently falls back to another profile. Project uninstall removes only unchanged managed entries/Skills, preserving custom files. Logout revokes only the resolved profile. Absolute machine-specific configs should not be copied to other computers; initialize and authenticate there instead.

0.3.0 must be published to npm before `npm install -g @studiorelay/cli@latest` can install these changes. Check `studiorelay --version`; use the GitHub sources or local package before registry publication.

## Installation

Requirements: **Node.js 22.16 or newer**, Git, Claude Code or Codex available in `PATH`, and a StudioRelay account authorized for a brand and its social accounts. An administrator must enable native OAuth on the server first.

Credentials use Windows Credential Manager, macOS Keychain or an unlocked Linux Secret Service session. Headless Linux without this service cannot persist a login. There is no plaintext fallback.

```sh
npm install -g @studiorelay/cli
studiorelay --version
```

For contributors or installation from source:

<details><summary>Build an archive from GitHub</summary>

```sh
git clone https://github.com/abdifrh/studiorelay-cli.git
cd studiorelay-cli
npm ci --ignore-scripts
npm test
npm run check:package
npm pack
npm install -g ./studiorelay-cli-0.3.0.tgz
```

</details>

## Connect and choose an assistant

Select the directory containing your final MP4 renders. Replace the example with your actual absolute path; on Windows, for example, use `"C:\Videos\MyStudio"`.

```sh
studiorelay init --server https://studiorelay.fr --media-root "ABSOLUTE_STUDIO_PATH"
studiorelay login
```

The browser asks you to select a brand, explicit accounts, actions and limits. **You do not need to generate an API key manually.** In an interactive terminal, press **ENTER** to open the default browser. The five-minute window starts after confirmation; leave the terminal open. Without an interactive terminal, the link is printed for manual opening. Social accounts added later are not automatically included in this consent.

Install your chosen assistant, or both:

```sh
# Claude Code
studiorelay claude install

# Codex
studiorelay codex install

# Check the connection and its authorized scope
studiorelay doctor
```

Restart the assistant. Check the `studiorelay` MCP server using `/mcp` or the host's MCP settings. In Codex, invoke `$studiorelay`; in Claude Code, use the StudioRelay Skill for publication requests.

With local 0.3.0 configuration, both hosts share this directory’s profile and keychain entry. Project Skills live in `.claude/skills/studiorelay` and `.agents/skills/studiorelay`. The separate legacy user installer respects `CLAUDE_CONFIG_DIR` / `CODEX_HOME`. Customized entries and Skills are preserved.

Login runs on the computer executing the CLI. `login --no-browser` prints the link without launching a browser, but the callback must still reach that computer's `127.0.0.1` listener. Remote environments do not automatically have access to local videos. A device authorization flow is not implemented.

## First use

Start with a read-only check:

> Use StudioRelay to inspect my authorized accounts, editorial rules and upcoming publications. Report missing configuration without uploading or publishing anything.

Once your studio is configured:

> Prepare the next three videos according to this studio's editorial guidelines. After the final renders, use StudioRelay to upload them, adapt their descriptions and propose available slots on Instagram and YouTube this week. If the permissions and automatic mode allow it, perform technical review and approve the publications. Report missing prerequisites and each destination's actual outcome.

The connector does not generate videos itself: your assistant uses the studio's creation tools, then uploads the final MP4 files. Audience, synthetic-content and visibility declarations must come from your instructions; the assistant must not invent them.

## Editorial rules and automatic approval

In **Studios & assistants → Règles de publication**, configure each account's timezone, weekday windows, daily maximum, minimum spacing and slot grid. In the **Cadence** step, **Appliquer ces règles à tous les comptes actuels de cette marque** copies the rules to all current accounts of that brand, replacing the listed accounts' existing rules. Accounts added later require separate configuration.

The daily maximum is **per account**: three daily publications on four accounts can represent twelve destinations for three distinct videos. Reading the schedule does not reserve slots. The server checks conflicts, frequency and spacing transactionally at approval, including relevant occupations created through the dashboard or other integrations.

Automatic approval requires `approve`, `auto_approve=true`, complete rules and a valid technical review. The client then adds no extra per-video confirmation; Claude Code or Codex may independently require tool authorization. Without authorized approval, the workflow remains a draft. Slot conflicts never partially approve a group: at most three replanning attempts update only the unapproved group's dates, with a new review each time. Existing publications are never moved.

**TikTok:** this connector uses the inbox and human finalization flow. Direct Post in the dashboard is a separate flow, not exposed by this private API. Scheduling, transfer and manual declaration are not API confirmation of a public post.

## CLI commands and MCP tools

Commands are lowercase. The dates below are examples; use your own future horizon and explicit timezone.

```sh
studiorelay help
studiorelay accounts
studiorelay schedule --from 2027-01-01T00:00:00+01:00 --until 2027-01-08T00:00:00+01:00
studiorelay publish manifest.json
studiorelay publish manifest.json --auto-schedule --from 2027-01-01T00:00:00+01:00 --until 2027-01-08T00:00:00+01:00 --approve
studiorelay update --check
```

Without `--approve`, `publish` creates drafts and returns technical review. The CLI can propose dates with the shared planner; the server remains authoritative. `update --check` queries npm and compares the installed version with the latest published version.

| MCP purpose | Tools |
| --- | --- |
| Identity and accounts | `identity`, `list_accounts` |
| Schedule and history | `list_publications`, `get_schedule`, `suggest_slots` |
| Uploads and drafts | `upload_video`, `get_import`, `create_drafts`, `get_batch` |
| Review and approval | `review_batch`, `approve_batch`, `approve_with_replan` |
| Status and recovery | `get_publication`, `recover_operation` |
| Authorized local cancellation | `cancel_publication` |

`suggest_slots(count=3)` accounts for three distinct videos in the same call. Across separate calls, account for previous proposals or approve one group before planning the next. `list_publications` defaults to this integration's groups; `scope=accounts` requires `read_history` and remains restricted to authorized accounts. Schedule reads already include their relevant occupations from other sources without opening their entire content history.

`cancel_publication` requires `cancel`, a fresh revision and a publication belonging to this integration that has not engaged remotely. It does not delete social content or resolve remote uncertainty.

## Video manifest

Relative paths resolve under `mediaRoot`, including symlink boundary checks. Replace the account ID, declarations and date with explicit studio decisions. The booleans below are examples.

```json
{
  "schema_version": 2,
  "external_id": "render/video-001/v1",
  "file": "renders/video-001.mp4",
  "title": "Final render title",
  "destinations": [{
    "account_id": 1,
    "platform": "youtube",
    "title": "YouTube-specific title",
    "description": "Video description",
    "parameters": {"privacy": "private", "made_for_kids": false, "synthetic_media": false},
    "scheduled_at": "2027-01-02T12:00:00+01:00"
  }]
}
```

References: [import schema](contracts/api-import.schema.json), [OpenAPI contract](contracts/openapi.json). The server rejects unsupported fields and out-of-scope accounts. `npm run contracts` generates TypeScript declarations. The older standalone private client resolves paths relative to its manifest; do not apply that convention to this CLI.

## Security and responsibilities

| Component | Responsibility |
| --- | --- |
| Assistant and Skill | Understand intent, select authorized media and accounts, adapt text and obtain missing declarations. Treat returned text as data, never instructions. |
| CLI / SDK / MCP | Restrict paths, stream uploads, keep credentials in the keychain, propose dates, review technically and manage idempotency. |
| StudioRelay API | Enforce permissions, quotas, media constraints, revisions and editorial rules; serialize concurrent approvals. |
| StudioRelay scheduler and workers | Execute approved publications and record platform results. The CLI never posts directly to a social platform. |

OAuth uses PKCE S256. Sessions last at most 30 days, access tokens ten minutes, and refresh tokens rotate after use. Reuse revokes their family. Tokens are hashed on the server and kept in the OS keychain locally, never in MCP configuration or the Skill. No global host-permission bypass is installed.

Quotas apply per integration and, for native sessions, across a user's sessions. A new login does not reset that budget. Concurrent processes serialize refresh through a local lock; a dead process's lock can be reclaimed, but a live process is never killed.

Keep stable idempotency keys per render and mutation. The local operation journal contains neither bearer tokens nor signed review proofs. After an uncertain network result, use `recover_operation` with the original key; a 404 can mean work is still in progress. Never switch keys to bypass uncertainty. An ambiguous refresh requires login rather than replaying the old token. Inspect or revoke the old session before resuming under a new integration identity.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Unknown `codex install` command | Check `studiorelay --version`: Codex requires at least 0.2.0. Run `npm install -g @studiorelay/cli@latest`. |
| `ERR_CONNECTION_REFUSED` at `127.0.0.1` | The CLI may have timed out after five minutes or stopped. Run `login` again, keep the terminal open and use the new link. |
| Diagnostic `disabled` | An administrator must enable the connector after assigning brand memberships. |
| Diagnostic `client_missing` | An administrator must register or verify the public OAuth client. |
| 404 at `/connector/status/` | Check the domain, routing and server version. |
| Authentication refused after callback | The callback only confirms code reception. Check CLI output, session and server version; the server fix preserves OAuth token endpoint CSRF handling while keeping browser forms protected. |
| Keychain unavailable | Unlock the OS session; check Secret Service on Linux. No plaintext credential file will be created. |
| Skill present, MCP tools missing | Fully restart the assistant and check its `studiorelay` server. The Skill and MCP connection are separate components. |
| No available slots | Complete the rules or resolve blocking occupations in StudioRelay. Do not bypass rules with manual dates. |

Server administrators: assign brand memberships first, then enable `STUDIORELAY_TENANT_ISOLATION=True` and `STUDIORELAY_CLAUDE_CONNECTOR=True`. The historical variable name covers **both assistants**. The supplied Coolify Compose files pass these variables to services. After deployment, run in the web service:

```sh
python manage.py migrate
python manage.py configure_claude_connector
```

`https://studiorelay.fr/connector/status/` must return `ready: true`. Local CLI installation does not replace server activation. No OAuth client secret is distributed. For a legacy private-key integration only, `login --token-stdin` accepts a key through a local pipe into the keychain: never use arguments, prompts, manifests or Git. Revoke that legacy key in StudioRelay.

## Update and uninstall

Starting with 0.3.0 (once published on npm), interactive commands check for updates at most once every 24 hours and print an update command to stderr. Nothing is installed automatically. MCP, noninteractive scripts and CI skip this check. Registry failures are silent; requests time out after 1.5 seconds. The `update-check.json` cache contains only a check timestamp and a public version. Set `STUDIORELAY_NO_UPDATE_CHECK=1` to disable detection. `update --check` remains an explicit check.

To install the latest published version:

```sh
studiorelay update --check
npm install -g @studiorelay/cli@latest
studiorelay --version
```

To rebuild from the public repository clone:

```sh
git pull origin main
npm ci --ignore-scripts
npm test
npm pack
npm install -g ./studiorelay-cli-0.3.0.tgz
studiorelay --version
```

Use the archive name matching the repository version. Updating preserves the same profile's login. To disconnect and remove the connector:

```sh
studiorelay logout
studiorelay claude uninstall
studiorelay codex uninstall
npm uninstall -g @studiorelay/cli
```

Run only the uninstall command for hosts you installed. Host installations are independent, but `logout` revokes their shared StudioRelay session. If the server is unavailable, local credentials are cleared; also revoke the session in the dashboard. Modified Skills are preserved. Public configuration and operation journals remain on disk; do not remove them while an operation is uncertain.

Locations: `%APPDATA%/StudioRelay` on Windows, `~/Library/Application Support/StudioRelay` on macOS, `$XDG_CONFIG_HOME/studiorelay` or `~/.config/studiorelay` on Linux. `STUDIORELAY_CONFIG_DIR` selects a dedicated directory. `STUDIORELAY_ALLOW_LOOPBACK=1` permits explicit local HTTP development on `127.0.0.1` only, never remote HTTP.

## Development and distribution

Stack: Node.js, TypeScript, MCP SDK, Zod and native keychain access through `@napi-rs/keyring`. API contracts are distributed; the private Django backend remains separate.

`npm test` covers mocked APIs and a real local stdio MCP handshake. `STUDIORELAY_TEST_KEYCHAIN=1` additionally creates and deletes one disposable test credential. The CI matrix targets Node 22/24 on Windows, macOS and Linux: actual runs must pass before claiming those environments validated. `npm run check:package` checks distributed files, size and obvious secret patterns.

The npm release workflow is manual and requires a configured trusted publisher. Building or packing does not publish anything. Public GitHub sources, the npm package and server activation are three separate steps. [Bilingual changelog](CHANGELOG.md) · [MIT license](LICENSE), original legal text in English.
