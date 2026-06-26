# First Commit Checklist

Use this checklist before the first Git commit for this monorepo.

## Commit These

- `.gitignore`
- `.github/workflows/deploy-server.yml`
- `docs/`
- `deploy/`
- `server/server.js`
- `server/wechat-pay.js`
- `server/package.json`
- `server/package-lock.json`
- `server/.env.example`
- `server/.gitignore`
- `server/scripts/health-check.js`
- `miniprogram/` source files except local/private config
- `flutter_app/` source files and platform project files needed for builds
- small `data/` metadata and scripts, if needed
- root project documents such as `README.md`, `DEPLOY.md`, and launch checklists

## Do Not Commit

- `.env`
- `.env.*` except `.env.example`
- `deepseek.txt`
- `*.pem`
- `*.key`
- `*.p12`
- certificate directories
- `node_modules/`
- Flutter `build/`
- Flutter `.dart_tool/`
- WeChat `project.private.config.json`
- zip, tar, tar.gz, tgz, rar artifacts
- local virtual environments such as `.venv/`
- local temp files and logs
- large generated question exports under `data/parsed/questions*.json`
- generated Excel exports under `data/parsed/*.xlsx`
- generated AI explanation caches under `data/analysis/ai_explanations*.json`

## Required Checks

Run these before committing:

```bash
node --check server/server.js
node --check server/scripts/health-check.js
cd server && npm run check:health
cd ../flutter_app && flutter analyze
```

For production health checks, use:

```bash
API_BASE_URL=https://api.synexa.cc npm run check:health
```

## Deployment Directory

The standard production server directory is fixed as:

```text
/var/www/sgcc-exam-miniapp/server
```

Do not deploy to the legacy directory:

```text
/home/ubuntu/sgcc-exam-api/server
```

The legacy directory currently exists only as a rollback reference.

## Large Data Policy

The parsed question exports are larger than GitHub's normal 100 MB file limit.
Keep them out of the first normal Git commit unless Git LFS or an external artifact store is configured.

Current generated files that should stay out of normal Git:

- `data/parsed/questions.json`
- `data/parsed/questions.jsonl`
- `data/parsed/questions_grouped.json`
- `data/parsed/*.xlsx`
- `data/analysis/ai_explanations*.json`

Runtime deployments currently rely on the server copy at:

```text
/var/www/sgcc-exam-miniapp/data
```
