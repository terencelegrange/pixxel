#!/usr/bin/env bash
# =============================================================================
# infra/jenkins-setup.sh
#
# One-shot script that configures Jenkins for the Pixxel deployment pipeline:
#   1. Installs required plugins
#   2. Generates (or uses existing) SSH key pair for the deploy user
#   3. Creates all credentials in Jenkins
#   4. Creates the Pixxel pipeline job
#
# Usage:
#   Fill in the variables in infra/jenkins.env (copy from jenkins.env.example),
#   then run:
#       source infra/jenkins.env && bash infra/jenkins-setup.sh
#
# Requirements on the machine running this script:
#   curl, ssh-keygen, python3 (for JSON parsing — ships with macOS/Linux)
# =============================================================================
set -euo pipefail

# ── Colour helpers ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
section() { echo -e "\n${YELLOW}━━━ $* ━━━${NC}"; }

# ── Required variables check ──────────────────────────────────────────────────
required_vars=(
  JENKINS_URL JENKINS_USER JENKINS_TOKEN
  GITEA_URL GITEA_REPO GITEA_USER GITEA_TOKEN
  DOCKER_HOST_IP
  DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME
  NEXTAUTH_SECRET NEXTAUTH_URL
)
for v in "${required_vars[@]}"; do
  [[ -z "${!v:-}" ]] && die "Required variable \$$v is not set. See infra/jenkins.env.example"
done

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/pixxel}"
SSH_KEY_FILE="${SSH_KEY_FILE:-$HOME/.ssh/pixxel_jenkins_deploy}"
JOB_NAME="${JOB_NAME:-pixxel}"
WEBHOOK_TOKEN="${WEBHOOK_TOKEN:-$(openssl rand -hex 16)}"

AUTH="$JENKINS_USER:$JENKINS_TOKEN"
JURL="${JENKINS_URL%/}"   # strip trailing slash

# ── Dependency check ──────────────────────────────────────────────────────────
section "Preflight checks"
for cmd in curl ssh-keygen python3; do
  command -v "$cmd" &>/dev/null || die "$cmd is required but not installed"
done

# Verify Jenkins is reachable
curl -sf -u "$AUTH" "$JURL/api/json" > /dev/null \
  || die "Cannot reach Jenkins at $JURL — check URL and credentials"
info "Jenkins reachable at $JURL"

# ── CSRF crumb ────────────────────────────────────────────────────────────────
get_crumb() {
  curl -sf -u "$AUTH" "$JURL/crumbIssuer/api/json" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['crumbRequestField']+':'+d['crumb'])"
}
CRUMB="$(get_crumb)"
info "Got CSRF crumb"

# ── Helper: Jenkins POST ──────────────────────────────────────────────────────
jpost() {
  local path="$1"; shift
  curl -sf -u "$AUTH" -H "$CRUMB" "$JURL$path" "$@"
}

# ── 1. Install plugins ────────────────────────────────────────────────────────
section "Installing plugins"

PLUGINS=(
  "generic-webhook-trigger"   # Gitea webhook → pipeline trigger
  "ssh-agent"                 # sshagent{} block in pipeline
  "credentials-binding"       # withCredentials{} block
  "workflow-aggregator"       # Pipeline / Declarative Pipeline
  "git"                       # Git SCM
  "gitea"                     # Native Gitea integration (optional but nice)
  "ws-cleanup"                # cleanWs() in post {}
)

PLUGIN_XML="<jenkins>"
for p in "${PLUGINS[@]}"; do
  PLUGIN_XML+="<install plugin=\"${p}@latest\" />"
done
PLUGIN_XML+="</jenkins>"

jpost "/pluginManager/installNecessaryPlugins" \
  -H "Content-Type: application/xml" \
  -d "$PLUGIN_XML" > /dev/null

info "Plugin install requested — waiting for Jenkins to finish installing..."

# Poll until all requested plugins are active
MAX_WAIT=180
elapsed=0
while true; do
  sleep 10; elapsed=$((elapsed + 10))
  restart_needed=$(curl -sf -u "$AUTH" "$JURL/updateCenter/api/json?depth=1" \
    | python3 -c "
import sys, json
d = json.load(sys.stdin)
jobs = d.get('jobs', [])
pending = [j for j in jobs if j.get('type','') in ('InstallationJob','PluginInstallationJob') and j.get('status',{}).get('success') is not True and not j.get('status',{}).get('failed')]
print('pending' if pending else 'done')
" 2>/dev/null || echo "pending")
  [[ "$restart_needed" == "done" ]] && break
  [[ $elapsed -ge $MAX_WAIT ]] && { warn "Timed out waiting for plugins — they may still be installing. Continuing..."; break; }
  echo -n "."
done
echo ""
info "Plugins installed"

# Restart Jenkins if needed to activate plugins
NEEDS_RESTART=$(curl -sf -u "$AUTH" "$JURL/updateCenter/api/json?depth=1" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('yes' if any(j.get('requiresRestart') for j in d.get('jobs',[])) else 'no')
" 2>/dev/null || echo "no")

if [[ "$NEEDS_RESTART" == "yes" ]]; then
  warn "Restarting Jenkins to activate plugins (will wait for quiet)..."
  jpost "/safeRestart" > /dev/null || true
  sleep 15
  # Wait for Jenkins to come back
  for i in $(seq 1 24); do
    sleep 5
    curl -sf -u "$AUTH" "$JURL/api/json" > /dev/null 2>&1 && break
    echo -n "."
  done
  echo ""
  CRUMB="$(get_crumb)"   # refresh crumb after restart
  info "Jenkins back online"
fi

# ── 2. SSH key pair ───────────────────────────────────────────────────────────
section "SSH key pair for deploy user"

if [[ -f "$SSH_KEY_FILE" ]]; then
  warn "Using existing private key: $SSH_KEY_FILE"
else
  ssh-keygen -t ed25519 -C "jenkins-pixxel-deploy" -f "$SSH_KEY_FILE" -N ""
  info "Generated new key pair at $SSH_KEY_FILE"
fi

PUBLIC_KEY="$(cat "${SSH_KEY_FILE}.pub")"
PRIVATE_KEY="$(cat "$SSH_KEY_FILE")"

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  Add this public key to ${DOCKER_HOST_IP} for user '${DEPLOY_USER}':"
echo ""
echo "  $PUBLIC_KEY"
echo ""
echo -e "  Run on the Docker host (as root):"
echo "    mkdir -p /home/${DEPLOY_USER}/.ssh"
echo "    echo '$PUBLIC_KEY' >> /home/${DEPLOY_USER}/.ssh/authorized_keys"
echo "    chmod 700 /home/${DEPLOY_USER}/.ssh"
echo "    chmod 600 /home/${DEPLOY_USER}/.ssh/authorized_keys"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
read -rp "Press Enter once you have added the public key to the Docker host..."

# ── 3. Create credentials ─────────────────────────────────────────────────────
section "Creating Jenkins credentials"

create_secret_text() {
  local id="$1" secret="$2" desc="$3"
  jpost "/credentials/store/system/domain/_/createCredentials" \
    -H "Content-Type: application/xml" \
    -d "
<org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl>
  <scope>GLOBAL</scope>
  <id>${id}</id>
  <description>${desc}</description>
  <secret>${secret}</secret>
</org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl>" > /dev/null
  info "Created secret: $id"
}

create_ssh_credential() {
  local id="$1" username="$2" key="$3" desc="$4"
  # Escape newlines for XML
  local key_escaped
  key_escaped="$(echo "$key" | python3 -c "import sys; print(sys.stdin.read().replace('\n','&#10;'))")"
  jpost "/credentials/store/system/domain/_/createCredentials" \
    -H "Content-Type: application/xml" \
    -d "
<com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey>
  <scope>GLOBAL</scope>
  <id>${id}</id>
  <description>${desc}</description>
  <username>${username}</username>
  <privateKeySource class=\"com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey\$DirectEntryPrivateKeySource\">
    <privateKey>${key_escaped}</privateKey>
  </privateKeySource>
</com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey>" > /dev/null
  info "Created SSH credential: $id"
}

create_username_password() {
  local id="$1" username="$2" password="$3" desc="$4"
  jpost "/credentials/store/system/domain/_/createCredentials" \
    -H "Content-Type: application/xml" \
    -d "
<com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>
  <scope>GLOBAL</scope>
  <id>${id}</id>
  <description>${desc}</description>
  <username>${username}</username>
  <password>${password}</password>
</com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>" > /dev/null
  info "Created username/password: $id"
}

# SSH deploy key -- PROXMOX_APPS_KEY is shared across every app deployed to
# this Docker host (mysql-gui, finance-web, calendar, pixxel, ...), not
# per-app despite the app-specific description below.
create_ssh_credential \
  "PROXMOX_APPS_KEY" \
  "$DEPLOY_USER" \
  "$PRIVATE_KEY" \
  "Proxmox apps -- SSH key for deploy user on Docker host"

# Gitea pull credential
create_username_password \
  "PIXXEL_GITEA_CRED" \
  "$GITEA_USER" \
  "$GITEA_TOKEN" \
  "Pixxel — Gitea read credential"

# App secrets
create_secret_text "PIXXEL_DB_HOST"         "$DB_HOST"         "Pixxel — DB host"
create_secret_text "PIXXEL_DB_PORT"         "$DB_PORT"         "Pixxel — DB port"
create_secret_text "PIXXEL_DB_USER"         "$DB_USER"         "Pixxel — DB user"
create_secret_text "PIXXEL_DB_PASSWORD"     "$DB_PASSWORD"     "Pixxel — DB password"
create_secret_text "PIXXEL_DB_NAME"         "$DB_NAME"         "Pixxel — DB name"
create_secret_text "PIXXEL_NEXTAUTH_SECRET" "$NEXTAUTH_SECRET" "Pixxel — NextAuth secret"
create_secret_text "PIXXEL_NEXTAUTH_URL"    "$NEXTAUTH_URL"    "Pixxel — NextAuth URL"
create_secret_text "PIXXEL_WEBHOOK_TOKEN"   "$WEBHOOK_TOKEN"   "Pixxel — webhook trigger token"

# ── 4. Create pipeline job ────────────────────────────────────────────────────
section "Creating pipeline job"

# Check if job already exists
JOB_EXISTS=$(curl -sf -u "$AUTH" "$JURL/job/$JOB_NAME/api/json" > /dev/null 2>&1 && echo "yes" || echo "no")

JOB_CONFIG="<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin=\"workflow-job\">
  <description>Pixxel EA Repository — deploy to Docker host on push to main</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <org.jenkinsci.plugins.generictrigger.GenericTrigger plugin=\"generic-webhook-trigger\">
      <spec></spec>
      <regexpFilterText></regexpFilterText>
      <regexpFilterExpression></regexpFilterExpression>
      <printContributedVariables>false</printContributedVariables>
      <printPostContent>false</printPostContent>
      <silentResponse>false</silentResponse>
      <overrideQuietPeriod>false</overrideQuietPeriod>
      <token>${WEBHOOK_TOKEN}</token>
    </org.jenkinsci.plugins.generictrigger.GenericTrigger>
  </properties>
  <definition class=\"org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition\" plugin=\"workflow-cps\">
    <scm class=\"hudson.plugins.git.GitSCM\" plugin=\"git\">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${GITEA_URL}/${GITEA_REPO}.git</url>
          <credentialsId>PIXXEL_GITEA_CRED</credentialsId>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class=\"empty-list\"/>
      <extensions/>
    </scm>
    <scriptPath>Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>"

if [[ "$JOB_EXISTS" == "yes" ]]; then
  warn "Job '$JOB_NAME' already exists — updating config..."
  jpost "/job/$JOB_NAME/config.xml" \
    -X POST \
    -H "Content-Type: application/xml" \
    -d "$JOB_CONFIG" > /dev/null
  info "Updated job: $JOB_NAME"
else
  jpost "/createItem?name=$JOB_NAME" \
    -H "Content-Type: application/xml" \
    -d "$JOB_CONFIG" > /dev/null
  info "Created job: $JOB_NAME"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
section "Setup complete"

echo ""
echo -e "${GREEN}Everything is configured. Next steps:${NC}"
echo ""
echo -e "  1. Add the Gitea webhook:"
echo -e "     URL:          ${YELLOW}${JURL}/generic-webhook-trigger/invoke?token=${WEBHOOK_TOKEN}${NC}"
echo -e "     Content type: application/json"
echo -e "     Trigger:      Push events → branch filter: main"
echo ""
echo -e "  2. Update Jenkinsfile with your Docker host details:"
echo -e "     REMOTE_HOST = '${DOCKER_HOST_IP}'"
echo -e "     REMOTE_USER = '${DEPLOY_USER}'"
echo -e "     DEPLOY_DIR  = '${DEPLOY_DIR}'"
echo ""
echo -e "  3. Trigger a first build manually:"
echo -e "     ${JURL}/job/${JOB_NAME}/build"
echo ""
echo -e "  Webhook token (save this): ${YELLOW}${WEBHOOK_TOKEN}${NC}"
echo ""
