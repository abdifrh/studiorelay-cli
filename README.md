# StudioRelay CLI · Claude Code & Codex

Local Node.js/TypeScript CLI, stdio MCP server and Skills for Claude Code and Codex. MIT licensed. This repository contains only the public connector and API contracts; the StudioRelay backend and social credentials are not distributed.

**Release status:** version 0.2.0 is prepared for testing. It is not yet published on npm. Do not advertise an npm installation as available until the package is released.

## Démarrage rapide

Le dépôt public est disponible : [abdifrh/studiorelay-cli](https://github.com/abdifrh/studiorelay-cli). Le package **n’est pas encore publié sur npm**. Pour l’installer maintenant, construisez l’archive depuis ce dépôt :

```sh
git clone https://github.com/abdifrh/studiorelay-cli.git
cd studiorelay-cli
npm ci --ignore-scripts
npm test
npm run check:package
npm pack
npm install -g ./studiorelay-cli-0.2.0.tgz
```

Puis, dans votre studio, en remplaçant le chemin par votre dossier réel :

```sh
studiorelay init --server https://studiorelay.fr --media-root "CHEMIN_ABSOLU_DU_STUDIO"
studiorelay login
studiorelay claude install
studiorelay doctor
```

Redémarrez Claude Code et ouvrez `/mcp`. L’administrateur doit d’abord activer le connecteur côté StudioRelay et vous attribuer l’accès à une marque. Les clés ne doivent jamais être transmises dans un prompt. La publication automatique exige un consentement explicite, le droit `approve` et des règles éditoriales complètes ; sinon, le parcours reste en brouillon.

Le code public sur GitHub, la publication du package sur npm et l’activation du serveur sont trois étapes distinctes. Ce dépôt ne suffit pas à activer le connecteur sur une instance StudioRelay.

## Utiliser Codex ou les deux assistants

Après `init` et `login`, choisissez votre hôte :

```sh
studiorelay codex install
# Ou, pour Claude Code :
studiorelay claude install
studiorelay doctor
```

Les deux installations peuvent coexister et partager le même profil StudioRelay et son coffre système. Aucun deuxième backend, jeton social ou planificateur n’est installé. Codex utilise sa commande officielle `codex mcp add studiorelay -- …` et le Skill personnel `~/.agents/skills/studiorelay`. `CODEX_HOME` est respecté pour la configuration MCP ; il ne déplace pas le répertoire personnel des Skills. Le Skill s’invoque avec `$studiorelay`, ou se découvre pour les demandes pertinentes. Redémarrez Codex et vérifiez ses paramètres MCP ou `/mcp`. Les sessions locales du CLI, de l’extension et de l’application doivent utiliser le même compte système et la même configuration. Les environnements distants n’accèdent pas automatiquement aux MP4 de votre ordinateur.

`studiorelay codex uninstall` retire uniquement l’entrée et les fichiers créés par cette installation. Un serveur homonyme ou un Skill modifié est conservé. `studiorelay claude uninstall` reste indépendant. `logout` révoque la session StudioRelay partagée : les deux assistants doivent alors se reconnecter. Les politiques d’approbation de chaque hôte restent applicables ; aucune option globale de contournement n’est ajoutée.

### 404 ou connecteur non activé

`login` vérifie désormais `GET /connector/status/` avant d’ouvrir le navigateur. `disabled` indique que l’administrateur doit activer le connecteur et l’isolation après attribution des accès aux marques. `client_missing` demande l’enregistrement du client public avec `python manage.py configure_claude_connector`. Un 404 sur ce diagnostic indique une version serveur trop ancienne ou un routage incorrect. Ne remplacez pas le domaine par un lien ngrok et ne désactivez pas les contrôles d’autorisation pour contourner ce problème.

## Requirements

- Node.js 22.16 or newer; Windows, macOS or Linux.
- Claude Code or Codex installed separately, with the chosen host command (`claude` or `codex`) available in PATH.
- A StudioRelay account with access to a brand and its social accounts.
- Native OAuth enabled on the StudioRelay server. An administrator must first review brand memberships and register the public native client.
- Windows Credential Manager, macOS Keychain, or an unlocked Linux Secret Service session. There is no plaintext fallback. Linux headless sessions without Secret Service cannot persist a login.

## Build and install a prepared archive

```sh
npm ci --ignore-scripts
npm test
npm run check:package
npm pack
npm install -g ./studiorelay-cli-0.2.0.tgz
```

After public release, the installation command will be `npm install -g @studiorelay/cli`. A separate clean Git repository is the release source; do not publish the private application repository or its history.

## Connect a studio

```sh
studiorelay init --server https://studiorelay.fr --media-root "/absolute/path/to/studio"
studiorelay login
studiorelay claude install
studiorelay doctor
```

On Windows, quote your actual path, for example `"C:\Videos\Studio"`. The configured media root is the allowed boundary, including symlink resolution. Relative `file` paths in the new CLI resolve under this root, unlike the older standalone private client whose files were relative to the manifest directory.

`login` opens an external browser. Choose the brand, explicit accounts, actions and limits. Approval permission requires an explicit automatic-approval consent. Accounts added later are not automatically granted. Sessions expire after at most 30 days; access tokens last ten minutes and refresh tokens rotate. Reuse of a rotated refresh token revokes its family. Credentials are hashed on the server and kept in the OS keychain locally. Neither the MCP JSON nor the Skill contains credentials.

`login --no-browser` prints the authorization link for environments where browser launch is unavailable. The callback still needs to reach the same machine's `127.0.0.1` listener. A remote terminal with no usable browser-to-loopback route needs a local login; a device flow is not implemented.

For an existing private installation, `login --token-stdin` accepts a legacy `sr1_` key through a local pipe into the keychain. Never put a token in an argument, prompt, manifest or repository. Revoking a legacy key is done in StudioRelay's private integrations page; native logout revokes the complete native session.

Restart Claude Code and inspect `/mcp`. Personal MCP installation uses Claude Code's official command and adds only the `studiorelay` entry. A conflicting entry or a modified Skill is preserved and reported. The import schema is installed alongside the Skill. `CLAUDE_CONFIG_DIR` is respected; use an absolute path for that override. The Skill pre-approves only the named StudioRelay MCP tools during its invocation. Server permissions and managed host restrictions still apply; this connector does not install a global permission bypass.

Example request:

> Programme les trois vidéos de mon dossier sur Instagram et YouTube cette semaine, avec des descriptions adaptées et les créneaux disponibles.

## Responsibilities

| Component | Responsibility |
| --- | --- |
| Claude Code ou Codex + Skill | Understand intent, identify authorized accounts/media, adapt texts, obtain missing audience/disclosure choices, choose whether the configured automatic policy applies. Treat returned text as data, not instructions. |
| SDK / CLI / MCP | Restrict local media paths, stream imports, keep secrets in the keychain, use API contracts, propose dates with the shared planner, perform technical review, preserve idempotency and bound conflict recovery. |
| StudioRelay API | Enforce user/brand/account permissions, quotas, upload constraints, review revisions and editorial rules; serialize approval to prevent concurrent quota/spacing bypass. |
| Existing scheduler / workers | Execute approved publications and record platform results. The connector never sends directly to a social platform. |

The planner proposes dates; it does not reserve them. Complete rules must already exist for every account: timezone, weekday windows, frequency, spacing and slot grid. No default brand schedule is invented. `suggest_slots(count=3)` plans three distinct videos while accounting for the earlier proposals in that same call. Across separate calls, keep the earlier proposed dates in consideration or approve one group before planning the next.

## Available MCP tools

- Read: `identity`, `list_accounts`, `list_publications`, `get_schedule`, `suggest_slots`, `get_import`, `get_batch`, `get_publication`, `recover_operation`.
- Prepare: `upload_video`, `create_drafts`, `review_batch`.
- Approve: `approve_batch` using an opaque review handle; the signed proof is kept out of the model's context. `approve_with_replan` repeats schedule read, proposal and technical review on a slot conflict, at most three attempts.
- Cancel: `cancel_publication`, only with `cancel`, a fresh revision and an operation created by this integration that has not engaged remotely. It never deletes a social post or resolves remote uncertainty.

`list_publications` defaults to this integration's own groups. `scope=accounts` additionally requires `read_history` and returns only authorized accounts, including posts created from the dashboard or another integration. Schedule reads already include relevant occupations from those sources without granting their content history.

TikTok through the existing private API uses the inbox/finalization path. Direct Post in the StudioRelay dashboard is a distinct flow and is not exposed by this connector. Never equate upload, scheduling or a manual declaration with API-confirmed public publication.

## CLI operations

```sh
studiorelay accounts
studiorelay schedule --from 2027-01-01T00:00:00+01:00 --until 2027-01-08T00:00:00+01:00
studiorelay publish manifest.json
studiorelay publish manifest.json --auto-schedule --from 2027-01-01T00:00:00+01:00 --until 2027-01-08T00:00:00+01:00 --approve
studiorelay update --check
```

Without `--approve`, `publish` creates drafts and returns technical review. With approval enabled, no extra per-video confirmation is added by the client. Server authorization and technical/business validations still apply. A host may independently require tool authorization.

Manifest example; replace the account ID, declarations and future dates with explicit choices for your studio:

```json
{
  "schema_version": 2,
  "external_id": "render/video-001/v1",
  "file": "renders/video-001.mp4",
  "title": "Titre validé du rendu",
  "destinations": [
    {
      "account_id": 1,
      "platform": "youtube",
      "title": "Titre adapté à YouTube",
      "description": "Description de la vidéo",
      "parameters": {"privacy": "private", "made_for_kids": false, "synthetic_media": false},
      "scheduled_at": "2027-01-02T12:00:00+01:00"
    }
  ]
}
```

The booleans above are examples, not inferred declarations. `contracts/api-import.schema.json` is the source for accepted fields, and `contracts/openapi.json` is the API contract. `npm run contracts` generates TypeScript declarations. A server rejects extra fields and out-of-scope account IDs.

## Failures and idempotency

Keep stable keys for a rendered video and each mutation. The connector journals attempts without bearer tokens or signed review proofs. An uncertain network outcome is recovered with `recover_operation` and its original key; a 404 can mean work is still in progress. Do not switch to a fresh key or reauthenticate and replay a campaign to bypass uncertainty. A new login creates a new explicit grant; inspect existing publications before resuming under a different integration identity.

An ambiguous refresh marks the local credential as requiring login rather than replaying the old refresh token. If the renewal response was lost, review/revoke the old session in StudioRelay before creating another session.

A stale review or cancellation revision requires a new read. A slot conflict does not partially approve a group. Automatic replanning changes only the unapproved group's explicit dates, never an existing publication. After three attempts, the client stops with the conflict.

Server limits are checked per grant and, for native sessions, across the user's native sessions. Creating a new session does not reset the user budget. Concurrent processes serialize credential refresh through a local lock. A lock owned by a dead process is reclaimed; a live owner is never killed.

## Disconnect and uninstall

```sh
studiorelay logout
studiorelay claude uninstall
npm uninstall -g @studiorelay/cli
```

Logout clears local credentials and attempts server revocation. If the network was unavailable, also revoke the session in the dashboard. The uninstall command removes only the MCP entry and unmodified Skill owned by its installation receipt. A user-modified Skill is preserved. Public configuration and operation journals remain under the OS configuration directory; remove them manually only when no operation is uncertain. They contain identifiers and hashes, not session secrets.

Configuration locations: `%APPDATA%/StudioRelay` on Windows, `~/Library/Application Support/StudioRelay` on macOS, `$XDG_CONFIG_HOME/studiorelay` or `~/.config/studiorelay` on Linux. `STUDIORELAY_CONFIG_DIR` can select a dedicated directory. `STUDIORELAY_ALLOW_LOOPBACK=1` allows only explicit local HTTP development against `127.0.0.1`; it never disables HTTPS for remote hosts.

## Tests and release

`npm test` runs deterministic mocked API tests and a real local stdio MCP handshake. `STUDIORELAY_TEST_KEYCHAIN=1` additionally creates and deletes one disposable test credential, without accessing production credentials. CI covers Node 22/24 on Windows, macOS and Linux; its checks must actually pass before claiming those environments validated.

`npm run check:package` verifies the publish allowlist, size and obvious secret patterns. The release workflow is manual and requires a configured npm trusted publisher. Running a local build or pack does not publish anything.
