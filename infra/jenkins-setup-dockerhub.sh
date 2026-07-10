#!/usr/bin/env bash
# =============================================================================
# infra/jenkins-setup-dockerhub.sh
#
# Idempotently creates (or updates) the pixxel-dockerhub Jenkins job as
# "Pipeline script from SCM", pointing at this repo's Jenkinsfile.dockerhub
# on GitHub. Run this any time Jenkinsfile.dockerhub changes shape in a way
# that needs the job definition itself to change (branch, script path, repo
# URL) — day-to-day pipeline edits just need a normal git push, since the
# job reads the script from SCM on every build.
#
# This does NOT create the DOCKERHUB_CREDENTIALS credential — it must
# already exist in Jenkins (Manage Jenkins -> Credentials) as a
# "Username with password" credential, username = your Docker Hub username,
# password = a Docker Hub access token. The script checks it exists and
# warns (but does not fail) if it can't find it, since credential
# existence isn't always visible to a non-admin API token.
#
# Usage:
#   source infra/jenkins.env && bash infra/jenkins-setup-dockerhub.sh
#
# Requires the same JENKINS_URL / JENKINS_USER / JENKINS_TOKEN used by
# infra/jenkins-setup.sh (infra/jenkins.env).
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $*"; }
warn()    { echo -e "${YELLOW}[!]${NC} $*"; }
die()     { echo -e "${RED}[✗]${NC} $*" >&2; exit 1; }
section() { echo -e "\n${YELLOW}━━━ $* ━━━${NC}"; }

for v in JENKINS_URL JENKINS_USER JENKINS_TOKEN; do
  [[ -z "${!v:-}" ]] && die "Required variable \$$v is not set. See infra/jenkins.env.example"
done

GITHUB_REPO_URL="${GITHUB_REPO_URL:-https://github.com/terencelegrange/pixxel.git}"
DOCKERHUB_JOB_NAME="${DOCKERHUB_JOB_NAME:-pixxel-dockerhub}"
DOCKERHUB_CREDENTIALS_ID="${DOCKERHUB_CREDENTIALS_ID:-DOCKERHUB_CREDENTIALS}"

AUTH="$JENKINS_USER:$JENKINS_TOKEN"
JURL="${JENKINS_URL%/}"

section "Preflight checks"
command -v curl &>/dev/null || die "curl is required but not installed"

curl -sf -u "$AUTH" "$JURL/api/json" > /dev/null \
  || die "Cannot reach Jenkins at $JURL — check URL and credentials"
info "Jenkins reachable at $JURL"

get_crumb() {
  curl -sf -u "$AUTH" "$JURL/crumbIssuer/api/json" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['crumbRequestField']+':'+d['crumb'])"
}
CRUMB="$(get_crumb)"
info "Got CSRF crumb"

jpost() {
  local path="$1"; shift
  curl -sf -u "$AUTH" -H "$CRUMB" "$JURL$path" "$@"
}

section "Checking DOCKERHUB_CREDENTIALS credential"
if curl -sf -u "$AUTH" "$JURL/credentials/store/system/domain/_/credential/${DOCKERHUB_CREDENTIALS_ID}/api/json" > /dev/null 2>&1; then
  info "Found credential: $DOCKERHUB_CREDENTIALS_ID"
else
  warn "Could not confirm credential '$DOCKERHUB_CREDENTIALS_ID' exists (this check needs admin rights and may false-negative)."
  warn "If the pipeline fails at the 'Push to Docker Hub' stage, verify it in Manage Jenkins -> Credentials."
fi

section "Creating/updating pipeline job: $DOCKERHUB_JOB_NAME"

JOB_EXISTS=$(curl -sf -u "$AUTH" "$JURL/job/$DOCKERHUB_JOB_NAME/api/json" > /dev/null 2>&1 && echo "yes" || echo "no")

JOB_CONFIG="<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin=\"workflow-job\">
  <description>Pixxel — build and push a versioned image + latest to Docker Hub</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <definition class=\"org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition\" plugin=\"workflow-cps\">
    <scm class=\"hudson.plugins.git.GitSCM\" plugin=\"git\">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${GITHUB_REPO_URL}</url>
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
    <scriptPath>Jenkinsfile.dockerhub</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>"

if [[ "$JOB_EXISTS" == "yes" ]]; then
  warn "Job '$DOCKERHUB_JOB_NAME' already exists — updating config..."
  jpost "/job/$DOCKERHUB_JOB_NAME/config.xml" \
    -X POST \
    -H "Content-Type: application/xml" \
    -d "$JOB_CONFIG" > /dev/null
  info "Updated job: $DOCKERHUB_JOB_NAME"
else
  jpost "/createItem?name=$DOCKERHUB_JOB_NAME" \
    -H "Content-Type: application/xml" \
    -d "$JOB_CONFIG" > /dev/null
  info "Created job: $DOCKERHUB_JOB_NAME"
fi

section "Setup complete"
echo ""
echo -e "${GREEN}'$DOCKERHUB_JOB_NAME' now builds from:${NC}"
echo -e "  Repo:        ${YELLOW}${GITHUB_REPO_URL}${NC}"
echo -e "  Branch:      main"
echo -e "  Script path: Jenkinsfile.dockerhub"
echo ""
echo -e "  Trigger a build:  ${JURL}/job/${DOCKERHUB_JOB_NAME}/build"
echo ""
