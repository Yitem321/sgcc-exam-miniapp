# SGCC Exam Miniapp Monorepo

This repository is a monorepo with one shared backend and two independent clients.

## Structure

| Path | Role | Notes |
| --- | --- | --- |
| `server/` | Shared backend | Node.js API for question data, AI explanation, user records, payment, membership, and operational endpoints. |
| `miniprogram/` | WeChat client | WeChat Mini Program pages, WXML/WXSS/JS, routes, storage, and WeChat APIs. |
| `flutter_app/` | Flutter client | Dart/Flutter pages, routing, state, UI widgets, and platform builds. |
| `data/` | Question/source data | Existing data structure must remain stable. Do not move or rewrite data formats during engineering cleanup. |
| `scripts/` | Local utility scripts | Data generation, checks, or local automation scripts. |
| `docs/` | Engineering documentation | Monorepo contracts, client boundaries, deployment notes, and future architecture records. |
| `deploy/` | Deployment templates | Shell script templates for server deployment, rollback, and health checks. |

## Ownership Rules

- `server/` is the shared API and data-access layer.
- `miniprogram/` and `flutter_app/` are separate clients.
- The two clients share data only through `server` API contracts.
- Do not merge client directories for the sake of reuse.
- Do not copy WeChat WXML/WXSS/page JS into Flutter.
- Do not copy Flutter Dart widgets/routes into the WeChat client.
- Do not change existing public API paths without preserving backward compatibility.
- Do not change existing question JSON data structures without a migration plan.

## Build and Release Direction

- Backend deploys independently through PM2/Nginx.
- WeChat Mini Program uploads and releases through WeChat DevTools / WeChat MP platform.
- Flutter App builds and releases through Flutter platform tooling.
- Shared behavior should be specified in `docs/API_CONTRACT.md`, then implemented separately in each client.

## Current Engineering Notes

- Some generated, secret, archive, and local runtime files exist in the workspace and must stay out of Git.
- The backend can run independently from `server/package.json`.
- Current production PM2 process name is expected to be `sgcc-exam-api`.
- Standard server deployment target is `/var/www/sgcc-exam-miniapp/server`.
- Do not migrate a running production PM2 directory automatically. Prepare the standard directory first, then switch PM2/Nginx during a controlled maintenance window.
