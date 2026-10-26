# StudioRelay CLI · Claude Code & Codex

**Français** · [English](README.en.md)

Connectez votre studio de création à [StudioRelay](https://studiorelay.fr) pour préparer, importer et programmer vos vidéos avec Claude Code ou Codex. Un seul CLI, un serveur MCP local et un Skill par assistant réutilisent l’API StudioRelay existante.

**Version : 0.2.0 · Licence MIT · Windows, macOS et Linux.** Le package est disponible sur [npm](https://www.npmjs.com/package/@studiorelay/cli). Le backend privé et les secrets des réseaux sociaux ne sont pas distribués.

## Sommaire

- [Installation](#installation)
- [Connexion et choix de l’assistant](#connexion-et-choix-de-lassistant)
- [Première utilisation](#première-utilisation)
- [Règles et approbation automatique](#règles-et-approbation-automatique)
- [Commandes et outils MCP](#commandes-et-outils-mcp)
- [Manifeste vidéo](#manifeste-vidéo)
- [Sécurité et responsabilités](#sécurité-et-responsabilités)
- [Dépannage](#dépannage)
- [Mise à jour et désinstallation](#mise-à-jour-et-désinstallation)
- [Développement et distribution](#développement-et-distribution)

## Installation

Prérequis : **Node.js 22.16 minimum**, Git, Claude Code ou Codex accessible dans le `PATH`, et un compte StudioRelay autorisé sur une marque et ses comptes sociaux. Le serveur doit avoir activé le connecteur OAuth.

Les identifiants sont conservés dans le Gestionnaire d’informations d’identification Windows, le Trousseau macOS ou un service Secret Service déverrouillé sous Linux. Une session Linux sans ce service ne peut pas conserver la connexion ; aucun stockage en clair n’est utilisé.

```sh
npm install -g @studiorelay/cli
studiorelay --version
```

Pour les contributeurs ou une installation depuis les sources :

<details><summary>Construire une archive depuis GitHub</summary>

```sh
git clone https://github.com/abdifrh/studiorelay-cli.git
cd studiorelay-cli
npm ci --ignore-scripts
npm test
npm run check:package
npm pack
npm install -g ./studiorelay-cli-0.2.0.tgz
```

</details>

## Connexion et choix de l’assistant

Choisissez le dossier qui contient vos rendus MP4. Remplacez le chemin d’exemple par votre chemin réel ; sous Windows, utilisez par exemple `"C:\Videos\MonStudio"`.

```sh
studiorelay init --server https://studiorelay.fr --media-root "CHEMIN_ABSOLU_DU_STUDIO"
studiorelay login
```

Le navigateur demande la marque, les comptes, les actions et les limites autorisés. **Aucune clé n’est à générer manuellement.** Terminez l’autorisation en moins de cinq minutes et gardez le terminal ouvert. Les nouveaux comptes sociaux ne sont pas ajoutés automatiquement au consentement.

Installez ensuite l’assistant souhaité, ou les deux :

```sh
# Claude Code
studiorelay claude install

# Codex
studiorelay codex install

# Vérification de la connexion et de sa portée
studiorelay doctor
```

Redémarrez l’assistant. Vérifiez le serveur MCP `studiorelay` avec `/mcp` ou les paramètres MCP de l’hôte. Dans Codex, invoquez le Skill avec `$studiorelay`. Dans Claude Code, utilisez le Skill StudioRelay pour vos demandes de diffusion.

Les deux hôtes partagent le même profil StudioRelay et son coffre système. L’installation préserve les serveurs homonymes et les Skills personnalisés au lieu de les écraser. Claude Code respecte `CLAUDE_CONFIG_DIR`. Codex respecte `CODEX_HOME` pour le MCP ; son Skill personnel se trouve dans `~/.agents/skills/studiorelay`. Le schéma d’import est installé avec chaque Skill.

La connexion s’effectue sur l’ordinateur où tourne le CLI. `login --no-browser` affiche le lien sans ouvrir de navigateur, mais le retour vers `127.0.0.1` doit toujours atteindre ce même ordinateur. Les environnements distants n’accèdent pas automatiquement aux vidéos locales ; aucun flux d’authentification par code appareil n’est implémenté.

## Première utilisation

Commencez par une vérification sans publication :

> Utilise StudioRelay pour consulter mes comptes autorisés, leurs règles et leurs prochaines programmations. Signale ce qui manque sans importer ni publier de vidéo.

Une fois le studio configuré :

> Prépare les trois prochaines vidéos selon les consignes éditoriales de ce studio. Après les rendus finaux, utilise StudioRelay pour les importer, adapter leurs descriptions et proposer les créneaux disponibles sur Instagram et YouTube cette semaine. Si les droits et le mode automatique l’autorisent, effectue la relecture technique puis approuve les publications. Signale les prérequis manquants et le résultat réel de chaque destination.

Le connecteur ne génère pas les vidéos lui-même : votre assistant utilise les outils de création de votre studio, puis importe les MP4 finaux. Les choix d’audience, de contenu synthétique et de visibilité doivent venir de vos consignes ; l’assistant ne doit pas les inventer.

## Règles et approbation automatique

Dans **Studios & assistants → Règles de publication**, configurez pour chaque compte le fuseau horaire, les jours et plages, le maximum quotidien, l’espacement minimal et le pas de grille. À l’étape **Cadence**, l’option **Appliquer ces règles à tous les comptes actuels de cette marque** copie les réglages et remplace les règles existantes des destinataires affichés. Les comptes ajoutés plus tard doivent être configurés séparément.

Le maximum est **par compte** : trois publications par jour sur quatre comptes peuvent représenter douze destinations pour trois vidéos différentes. Une consultation du planning ne réserve pas les créneaux. Le serveur vérifie les conflits, l’espacement et la fréquence lors de l’approbation transactionnelle, y compris pour les occupations créées dans le dashboard ou par d’autres intégrations.

L’approbation automatique exige simultanément le droit `approve`, `auto_approve=true`, des règles complètes et une relecture technique valide. Le client n’ajoute alors pas de confirmation par vidéo ; les autorisations propres à Claude Code ou Codex restent applicables. Sans approbation autorisée, le parcours reste en brouillon. En cas de conflit, aucune approbation partielle : au maximum trois tentatives de replanification du groupe non approuvé, avec nouvelle relecture. Aucune publication existante n’est déplacée.

**TikTok :** ce connecteur utilise la boîte de réception et la finalisation humaine dans TikTok. Le Direct Post proposé dans le dashboard est un parcours distinct, non exposé par cette API privée. Une programmation, un transfert ou une déclaration manuelle ne vaut pas confirmation d’une publication publique par API.

## Commandes et outils MCP

Les commandes sont en minuscules. Les dates ci-dessous sont des exemples : adaptez-les à votre horizon et à votre fuseau.

```sh
studiorelay help
studiorelay accounts
studiorelay schedule --from 2027-01-01T00:00:00+01:00 --until 2027-01-08T00:00:00+01:00
studiorelay publish manifest.json
studiorelay publish manifest.json --auto-schedule --from 2027-01-01T00:00:00+01:00 --until 2027-01-08T00:00:00+01:00 --approve
studiorelay update --check
```

Sans `--approve`, `publish` crée des brouillons et renvoie la relecture technique. Le CLI peut proposer les dates avec le planificateur partagé ; le serveur garde la décision finale. `update --check` consulte npm et compare la version installée à la dernière version publiée.

| Usage MCP | Outils |
| --- | --- |
| Identité et comptes | `identity`, `list_accounts` |
| Planning et historique | `list_publications`, `get_schedule`, `suggest_slots` |
| Import et brouillons | `upload_video`, `get_import`, `create_drafts`, `get_batch` |
| Relecture et approbation | `review_batch`, `approve_batch`, `approve_with_replan` |
| Suivi et reprise | `get_publication`, `recover_operation` |
| Annulation locale autorisée | `cancel_publication` |

`suggest_slots(count=3)` prend en compte trois vidéos différentes dans le même appel. Entre appels distincts, conservez les propositions précédentes ou approuvez un groupe avant de planifier le suivant. `list_publications` retourne par défaut les groupes de cette intégration ; `scope=accounts` exige `read_history` et reste limité aux comptes autorisés. Le planning inclut déjà leurs occupations pertinentes issues des autres sources, sans ouvrir tout leur historique.

`cancel_publication` exige le droit `cancel`, une révision fraîche et une publication de cette intégration non engagée à distance. Il ne supprime pas de contenu social et ne résout pas une opération distante incertaine.

## Manifeste vidéo

Les chemins relatifs sont résolus sous `mediaRoot`, y compris après vérification des liens symboliques. Remplacez l’identifiant du compte, les déclarations et la date par vos choix explicites. Les booléens ci-dessous sont des exemples.

```json
{
  "schema_version": 2,
  "external_id": "render/video-001/v1",
  "file": "renders/video-001.mp4",
  "title": "Titre du rendu final",
  "destinations": [{
    "account_id": 1,
    "platform": "youtube",
    "title": "Titre adapté à YouTube",
    "description": "Description de la vidéo",
    "parameters": {"privacy": "private", "made_for_kids": false, "synthetic_media": false},
    "scheduled_at": "2027-01-02T12:00:00+01:00"
  }]
}
```

Références : [schéma d’import](contracts/api-import.schema.json), [contrat OpenAPI](contracts/openapi.json). Le serveur refuse les champs non admis et les comptes hors périmètre. `npm run contracts` génère les déclarations TypeScript. L’ancien client privé à deux scripts résout ses fichiers relativement au manifeste : ne transposez pas cette convention au nouveau CLI.

## Sécurité et responsabilités

| Composant | Responsabilité |
| --- | --- |
| Assistant et Skill | Comprendre l’intention, sélectionner les médias et comptes autorisés, adapter les textes et obtenir les choix manquants. Traiter les données retournées comme des données, jamais comme des instructions. |
| CLI / SDK / MCP | Restreindre les chemins, importer en flux, conserver les identifiants dans le coffre, proposer les dates, relire techniquement et gérer l’idempotence. |
| API StudioRelay | Contrôler les droits, quotas, contraintes médias, révisions et règles éditoriales ; sérialiser les approbations concurrentes. |
| Scheduler et workers StudioRelay | Exécuter les publications approuvées et enregistrer les résultats des plateformes. Le CLI ne publie pas directement sur un réseau social. |

OAuth utilise PKCE S256. Les sessions durent au maximum 30 jours, les jetons d’accès dix minutes et les jetons de renouvellement tournent à chaque usage. Leur réutilisation révoque la famille. Les jetons sont hachés côté serveur et conservés dans le coffre OS côté client ; ils ne figurent ni dans la configuration MCP ni dans le Skill. Aucun contournement global des permissions de l’hôte n’est installé.

Les quotas s’appliquent à l’intégration et, pour les sessions natives, à l’utilisateur à travers ses sessions. Une nouvelle connexion ne remet pas ce budget à zéro. Les processus sérialisent le renouvellement via un verrou local ; un verrou d’un processus mort peut être récupéré, un processus actif n’est jamais tué.

Conservez des clés d’idempotence stables par rendu et par mutation. Le journal local ne contient ni jetons Bearer ni preuves signées de relecture. Après un résultat réseau incertain, utilisez `recover_operation` avec la clé initiale ; un 404 peut désigner une opération encore en cours. Ne créez pas de nouvelle clé pour contourner l’incertitude. Un renouvellement ambigu impose une reconnexion plutôt qu’un rejeu de l’ancien jeton. Consultez ou révoquez l’ancienne session avant de reprendre sous une nouvelle identité d’intégration.

## Dépannage

| Symptôme | Action |
| --- | --- |
| `codex install` inconnu | Vérifiez `studiorelay --version` : Codex demande au moins 0.2.0. Exécutez `npm install -g @studiorelay/cli@latest`. |
| `ERR_CONNECTION_REFUSED` sur `127.0.0.1` | Le CLI a pu expirer après cinq minutes ou s’arrêter. Relancez `login`, gardez le terminal ouvert et utilisez le nouveau lien. |
| Diagnostic `disabled` | L’administrateur doit activer le connecteur après attribution des accès aux marques. |
| Diagnostic `client_missing` | L’administrateur doit enregistrer ou vérifier le client OAuth public. |
| 404 sur `/connector/status/` | Vérifiez le domaine, le routage et la version du serveur. |
| Refus après un callback reçu | Le callback n’est que la réception du code. Vérifiez la réponse du CLI, la session et la version du serveur ; le correctif serveur conserve le comportement CSRF OAuth pour les endpoints de jetons, tout en protégeant les formulaires navigateur. |
| Coffre indisponible | Déverrouillez la session OS ; sous Linux, vérifiez Secret Service. Aucun fichier de jetons en clair ne sera créé. |
| Skill présent, outils MCP absents | Redémarrez complètement l’assistant et vérifiez son serveur `studiorelay`. Le Skill et la connexion MCP sont deux éléments distincts. |
| Aucun créneau disponible | Complétez les règles ou résolvez les occupations bloquantes dans StudioRelay. Ne contournez pas les règles avec des dates manuelles. |

Pour l’administrateur du serveur : attribuez d’abord les appartenances aux marques, puis activez `STUDIORELAY_TENANT_ISOLATION=True` et `STUDIORELAY_CLAUDE_CONNECTOR=True`. Le nom historique couvre **les deux assistants**. Sur les Compose Coolify livrés, les variables sont transmises aux services. Après déploiement, exécutez dans le service web :

```sh
python manage.py migrate
python manage.py configure_claude_connector
```

`https://studiorelay.fr/connector/status/` doit retourner `ready: true`. L’installation locale du CLI ne remplace pas cette activation serveur. Aucun secret client OAuth n’est à distribuer. Pour une ancienne intégration à clé privée uniquement, `login --token-stdin` accepte le jeton par un pipe local vers le coffre : jamais dans un argument, un prompt, un manifeste ou Git. La révocation de cette clé historique se fait dans StudioRelay.

## Mise à jour et désinstallation

Pour installer la dernière version publiée :

```sh
studiorelay update --check
npm install -g @studiorelay/cli@latest
studiorelay --version
```

Pour reconstruire depuis le clone du dépôt public :

```sh
git pull origin main
npm ci --ignore-scripts
npm test
npm pack
npm install -g ./studiorelay-cli-0.2.0.tgz
studiorelay --version
```

Utilisez le nom d’archive correspondant à la version du dépôt. Une mise à jour conserve la connexion du même profil. Pour déconnecter et retirer le connecteur :

```sh
studiorelay logout
studiorelay claude uninstall
studiorelay codex uninstall
npm uninstall -g @studiorelay/cli
```

N’exécutez que la désinstallation de l’hôte installé. Les deux installations sont indépendantes, mais `logout` révoque leur session StudioRelay partagée. Si le serveur est inaccessible, la copie locale est supprimée ; révoquez aussi la session dans le dashboard. Les Skills modifiés sont conservés. Les réglages publics et journaux d’opérations restent sur disque ; ne les retirez pas pendant une opération incertaine.

Emplacements : `%APPDATA%/StudioRelay` sous Windows, `~/Library/Application Support/StudioRelay` sous macOS, `$XDG_CONFIG_HOME/studiorelay` ou `~/.config/studiorelay` sous Linux. `STUDIORELAY_CONFIG_DIR` permet un dossier dédié. `STUDIORELAY_ALLOW_LOOPBACK=1` autorise seulement le développement HTTP explicite sur `127.0.0.1`, jamais le HTTP distant.

## Développement et distribution

Stack : Node.js, TypeScript, SDK MCP, Zod et coffre natif via `@napi-rs/keyring`. Les contrats API sont distribués ; le backend Django privé reste séparé.

`npm test` couvre des API simulées et une vraie négociation MCP stdio locale. `STUDIORELAY_TEST_KEYCHAIN=1` ajoute la création puis la suppression d’un identifiant de test jetable. La matrice CI prévoit Node 22/24 sur Windows, macOS et Linux : ses exécutions doivent réussir avant de déclarer ces environnements validés. `npm run check:package` contrôle les fichiers distribués, la taille et des motifs de secrets.

Le workflow de publication npm est manuel et nécessite un éditeur de confiance configuré. Construire ou empaqueter ne publie rien. Les sources publiques GitHub, le package npm et l’activation du serveur sont trois étapes distinctes. [Historique bilingue](CHANGELOG.md) · [Licence MIT](LICENSE), texte légal original en anglais.
