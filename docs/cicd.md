# CI/CD Pipeline

## Overview

Pushing to the `main` branch on Gitea automatically triggers a Jenkins build that compiles the app inside Docker and deploys the container to the production host.

```
git push → Gitea → webhook → Jenkins → Docker build → running container
```

**Infrastructure**

Internal hostnames/IPs and the webhook token are intentionally not listed here —
this is a public repo. See the internal wiki / password manager for actual
values. Placeholders used below: `<GITEA_HOST>`, `<JENKINS_HOST>`, `<DOCKER_HOST>`.

---

## How a deploy works

### 1. Push to Gitea

```bash
git push origin main
```

Gitea fires a webhook to Jenkins on every push to `main`. The webhook URL is:

```
http://<JENKINS_HOST>/generic-webhook-trigger/invoke?token=<WEBHOOK_TOKEN>
```

The token is stored as the `PIXXEL_WEBHOOK_TOKEN` credential in Jenkins
(referenced via `tokenCredentialId` in the Jenkinsfile) and configured on the
matching Gitea webhook — never committed to source.

You can also trigger a build manually from the Jenkins UI at **pixxel → Build Now**, or via the API:

```powershell
# From PowerShell (requires a Jenkins API token)
. "infra/jenkins.config.ps1"
$base64 = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("$JENKINS_USER:$JENKINS_TOKEN"))
$headers = @{ Authorization = "Basic $base64" }
$crumb = Invoke-RestMethod -Uri "$JENKINS_URL/crumbIssuer/api/json" -Headers $headers
$headers[$crumb.crumbRequestField] = $crumb.crumb
Invoke-WebRequest -Uri "$JENKINS_URL/generic-webhook-trigger/invoke?token=$WEBHOOK_TOKEN" -Method Post -Headers $headers
```

### 2. Jenkins pipeline stages

The pipeline is defined in `Jenkinsfile` and runs these stages in order:

| Stage | What it does |
|-------|-------------|
| **Checkout** | Clones the repo from Gitea |
| **Write .env** | Reads secrets from Jenkins credentials store and writes `.env.production` to the deploy directory on the Docker host via SSH |
| **Transfer Code** | `rsync`s the source tree to `/home/pixxel` on the Docker host (excludes `.git`, `node_modules`, `.next`, `.env*`, `infra`) |
| **Build & Deploy** | SSH into the Docker host, runs `docker compose down`, `build --no-cache`, then `up -d` |
| **Health Check** | Polls `http://localhost:3000/api/health` every 5 s for up to 90 s; fails the build if the app doesn't respond |

### 3. Docker build

The `Dockerfile` uses a three-stage build:

1. **deps** — runs `npm ci` to install all dependencies
2. **builder** — copies source + node_modules, runs `npm run build` (Next.js standalone output)
3. **runner** — minimal Alpine image; copies only the standalone bundle, static assets, and public directory; runs as non-root `nextjs` user

The app runs on port 3000 inside the container, mapped to port 3000 on the host via `docker-compose.prod.yml`.

---

## Jenkins credentials

These secrets must exist in the Jenkins credentials store before the pipeline can run:

| Credential ID | Type | Description |
|---------------|------|-------------|
| `PIXXEL_SSH_KEY` | SSH private key | Used for all SSH/rsync operations to the Docker host |
| `PIXXEL_DB_HOST` | Secret text | Database host |
| `PIXXEL_DB_PORT` | Secret text | Database port |
| `PIXXEL_DB_USER` | Secret text | Database user |
| `PIXXEL_DB_PASSWORD` | Secret text | Database password |
| `PIXXEL_DB_NAME` | Secret text | Database name |
| `PIXXEL_NEXTAUTH_SECRET` | Secret text | NextAuth secret |
| `PIXXEL_NEXTAUTH_URL` | Secret text | NextAuth URL (e.g. `http://<DOCKER_HOST>:3000`) |
| `PIXXEL_WEBHOOK_TOKEN` | Secret text | Gitea → Jenkins webhook trigger token |

To add or update a credential: Jenkins → Manage Jenkins → Credentials → (global).

---

## Environment file

Jenkins writes `.env.production` to `/home/pixxel/` on the Docker host during every deploy. The file is not stored in git. It contains:

```
DATABASE_URL=mysql://user:password@host:port/dbname
DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=...
NODE_ENV=production
```

`docker-compose.prod.yml` loads this file via `env_file: .env.production`.

---

## Checking on a deployment

**View build logs** — Jenkins UI → pixxel → last build → Console Output

**Check the running container** (SSH to Docker host):

```bash
ssh terence@<DOCKER_HOST>
docker ps                                      # confirm container is running
docker logs $(docker ps -qf name=pixxel)       # tail app logs
docker compose -f /home/pixxel/docker-compose.prod.yml logs -f
```

**Health endpoint:**

```bash
curl http://<DOCKER_HOST>:3000/api/health
# → {"status":"ok"}
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Webhook doesn't trigger build | Gitea webhook not configured or wrong token | Check Gitea repo → Settings → Webhooks |
| Build fails at Transfer Code | SSH key not in Jenkins or `terence` not in `docker` group on host | Verify `PIXXEL_SSH_KEY` credential; check host SSH access |
| Build fails at Health Check | App crashed on startup or took > 90 s | Check container logs on Docker host |
| `EACCES: permission denied` on `/app/...` | File written at runtime owned by root | Dockerfile includes `RUN chown nextjs:nodejs /app` — rebuild |
| Port conflict | Another container on port 3000 | `docker ps` on Docker host to identify conflict |
