# 0.3.0

- Per-directory studio configs and explicit project MCP contexts for Claude Code/Codex.
- Pinned integration/brand identity, per-request checks, expected-brand first-login guard, non-overwriting login and bind for existing sessions.
- Local config snapshot checks; no silent global fallback for MCP/login/publication. Legacy mode requires explicit --global.
- Mandatory assistant identity/account verification, bilingual migration instructions, independent host subscriptions.

# Historique · Changelog

## 0.2.1 — prochaine publication / pending npm publication

**Français :** détection des nouvelles versions en terminal interactif, cache 24 h, délai réseau court, désactivation possible ; aucune mise à jour automatique et aucun contrôle réseau dans le MCP. Connexion par appui sur Entrée, ouverture du navigateur par défaut sous Windows sans Explorer, délai OAuth démarrant après confirmation.

**English:** interactive update notifications with a 24-hour cache, short network timeout and opt-out; no automatic installation or update checks in MCP. Press Enter before login, open the default Windows browser without Explorer, and start the OAuth timeout after confirmation.

## 0.2.0

### Français

- Installation et désinstallation MCP/Skill pour Codex et Claude Code, avec authentification et planification partagées.
- Conservation des serveurs MCP homonymes et Skills modifiés ; permissions de l’hôte inchangées.
- Diagnostic de l’activation serveur avant l’ouverture du navigateur : client OAuth absent ou anciennes routes.
- Documentation complète en [français](README.md) et en [anglais](README.en.md), avec installation, règles, exemples, dépannage et mise à jour.

### English

- MCP/Skill installation and removal for Codex and Claude Code, sharing authentication and planning.
- Preserve conflicting MCP servers and modified Skills; leave host permissions unchanged.
- Diagnose server activation before opening the browser, including missing OAuth client and old routes.
- Complete [French](README.md) and [English](README.en.md) documentation covering installation, rules, examples, troubleshooting and updates.

## 0.1.0

**Français :** première version du connecteur : OAuth PKCE, coffre système, MCP stdio, import de médias locaux, relecture technique, reprises de planning bornées, révocation des sessions et Skill Claude Code.

**English:** initial connector: OAuth PKCE, OS keychain, stdio MCP, local media uploads, technical review, bounded planning recovery, session revocation and Claude Code Skill.

Le package est disponible sur [npm](https://www.npmjs.com/package/@studiorelay/cli). / The package is available on npm.
