#Requires -Version 5.1
# =============================================================================
# infra/jenkins-setup.ps1
#
# One-shot script that configures Jenkins for the Pixxel deployment pipeline.
#
# Usage (from repo root):
#   . .\infra\jenkins.config.ps1
#   .\infra\jenkins-setup.ps1
# =============================================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# -- Helpers --------------------------------------------------------------------
function Info    { param($m) Write-Host "[+] $m" -ForegroundColor Green }
function Warn    { param($m) Write-Host "[!] $m" -ForegroundColor Yellow }
function Section { param($m) Write-Host "`n--- $m ---" -ForegroundColor Cyan }
function Die     { param($m) Write-Host "[x] $m" -ForegroundColor Red; exit 1 }

# -- XML templates (single-quoted = no interpolation; substituted via -replace) -
$XML_SECRET_TEXT = @'
<org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl>
  <scope>GLOBAL</scope>
  <id>%%ID%%</id>
  <description>%%DESC%%</description>
  <secret>%%SECRET%%</secret>
</org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl>
'@

$XML_SSH_CRED = @'
<com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey>
  <scope>GLOBAL</scope>
  <id>%%ID%%</id>
  <description>%%DESC%%</description>
  <username>%%USERNAME%%</username>
  <privateKeySource class="com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey$DirectEntryPrivateKeySource">
    <privateKey>%%KEY%%</privateKey>
  </privateKeySource>
</com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey>
'@

$XML_USER_PASS = @'
<com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>
  <scope>GLOBAL</scope>
  <id>%%ID%%</id>
  <description>%%DESC%%</description>
  <username>%%USERNAME%%</username>
  <password>%%PASSWORD%%</password>
</com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl>
'@

$XML_JOB = @'
<?xml version="1.1" encoding="UTF-8"?>
<flow-definition plugin="workflow-job">
  <description>Pixxel EA Repository - deploy to Docker host on push to main</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <org.jenkinsci.plugins.generictrigger.GenericTrigger plugin="generic-webhook-trigger">
      <spec></spec>
      <regexpFilterText></regexpFilterText>
      <regexpFilterExpression></regexpFilterExpression>
      <printContributedVariables>false</printContributedVariables>
      <printPostContent>false</printPostContent>
      <silentResponse>false</silentResponse>
      <overrideQuietPeriod>false</overrideQuietPeriod>
      <token>%%WEBHOOK_TOKEN%%</token>
    </org.jenkinsci.plugins.generictrigger.GenericTrigger>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>%%GITEA_REPO_URL%%</url>
          <credentialsId>PIXXEL_GITEA_CRED</credentialsId>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="empty-list"/>
      <extensions/>
    </scm>
    <scriptPath>Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
'@

# -- Required variable check ----------------------------------------------------
$required = @(
    'JENKINS_URL','JENKINS_USER','JENKINS_TOKEN',
    'GITEA_URL','GITEA_REPO','GITEA_USER','GITEA_TOKEN',
    'DOCKER_HOST_IP',
    'DB_HOST','DB_PORT','DB_USER','DB_PASSWORD','DB_NAME',
    'NEXTAUTH_SECRET','NEXTAUTH_URL'
)
foreach ($v in $required) {
    $val = Get-Variable -Name $v -ValueOnly -ErrorAction SilentlyContinue
    if ([string]::IsNullOrEmpty($val)) {
        Die "Required variable `$$v is not set. Dot-source infra\jenkins.config.ps1 first."
    }
}

# Defaults for optional vars
if ([string]::IsNullOrEmpty((Get-Variable -Name 'DEPLOY_USER'  -ValueOnly -ErrorAction SilentlyContinue))) { $DEPLOY_USER  = 'deploy' }
if ([string]::IsNullOrEmpty((Get-Variable -Name 'DEPLOY_DIR'   -ValueOnly -ErrorAction SilentlyContinue))) { $DEPLOY_DIR   = '/opt/pixxel' }
if ([string]::IsNullOrEmpty((Get-Variable -Name 'JOB_NAME'     -ValueOnly -ErrorAction SilentlyContinue))) { $JOB_NAME     = 'pixxel' }
if ([string]::IsNullOrEmpty((Get-Variable -Name 'SSH_KEY_FILE' -ValueOnly -ErrorAction SilentlyContinue))) { $SSH_KEY_FILE = "$env:USERPROFILE\.ssh\pixxel_jenkins_deploy" }
if ([string]::IsNullOrEmpty((Get-Variable -Name 'WEBHOOK_TOKEN' -ValueOnly -ErrorAction SilentlyContinue))) {
    $WEBHOOK_TOKEN = -join ((1..32) | ForEach-Object { [char](Get-Random -Min 97 -Max 122) })
}

$JURL = $JENKINS_URL.TrimEnd('/')

# -- Auth header ----------------------------------------------------------------
$authBytes   = [System.Text.Encoding]::ASCII.GetBytes(("{0}:{1}" -f $JENKINS_USER, $JENKINS_TOKEN))
$encodedAuth = [Convert]::ToBase64String($authBytes)
$authHeader  = @{ Authorization = "Basic $encodedAuth" }

# Persistent web session -- crumb must travel with the session cookie that was
# live when the crumb was issued; without -WebSession the cookie is lost between
# Invoke-RestMethod calls and Jenkins rejects the orphaned crumb with 403.
$script:JenkinsSession = $null

# Allow self-signed certs on local network
Add-Type -ErrorAction SilentlyContinue @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAll : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int p) { return true; }
}
"@
try { [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAll } catch {}
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

# -- CSRF crumb -----------------------------------------------------------------
function Get-JenkinsCrumb {
    $params = @{
        Uri         = "$JURL/crumbIssuer/api/json"
        Headers     = $authHeader
        ErrorAction = 'Stop'
    }
    if ($script:JenkinsSession) { $params.WebSession = $script:JenkinsSession }
    $r = Invoke-RestMethod @params
    return @{ ($r.crumbRequestField) = $r.crumb }
}

# -- Jenkins POST helper --------------------------------------------------------
function Invoke-Jenkins {
    param(
        [string]$Path,
        [string]$Body        = '',
        [string]$ContentType = 'application/xml',
        [string]$Method      = 'POST'
    )
    $headers = $authHeader.Clone()
    (Get-JenkinsCrumb).GetEnumerator() | ForEach-Object { $headers[$_.Key] = $_.Value }
    $params = @{
        Uri         = "$JURL$Path"
        Method      = $Method
        Headers     = $headers
        ContentType = $ContentType
        ErrorAction = 'Stop'
    }
    if ($Body) { $params.Body = [System.Text.Encoding]::UTF8.GetBytes($Body) }
    if ($script:JenkinsSession) { $params.WebSession = $script:JenkinsSession }
    try {
        Invoke-RestMethod @params | Out-Null
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -ne 409) { throw }   # 409 = already exists, treat as OK
    }
}

# -- Credential helpers ---------------------------------------------------------
function New-JenkinsSecret {
    param([string]$Id, [string]$Secret, [string]$Desc)
    $xml = $XML_SECRET_TEXT -replace '%%ID%%',$Id -replace '%%DESC%%',$Desc -replace '%%SECRET%%',$Secret
    Invoke-Jenkins -Path '/credentials/store/system/domain/_/createCredentials' -Body $xml
    Info "Created secret: $Id"
}

function New-JenkinsSshKey {
    param([string]$Id, [string]$Username, [string]$Key, [string]$Desc)
    $nl         = '&#10;'
    $keyEscaped = $Key -replace "`r`n", $nl -replace "`n", $nl
    $xml = $XML_SSH_CRED `
        -replace '%%ID%%',$Id `
        -replace '%%DESC%%',$Desc `
        -replace '%%USERNAME%%',$Username `
        -replace '%%KEY%%',$keyEscaped
    Invoke-Jenkins -Path '/credentials/store/system/domain/_/createCredentials' -Body $xml
    Info "Created SSH credential: $Id"
}

function New-JenkinsUserPass {
    param([string]$Id, [string]$Username, [string]$Password, [string]$Desc)
    $xml = $XML_USER_PASS `
        -replace '%%ID%%',$Id `
        -replace '%%DESC%%',$Desc `
        -replace '%%USERNAME%%',$Username `
        -replace '%%PASSWORD%%',$Password
    Invoke-Jenkins -Path '/credentials/store/system/domain/_/createCredentials' -Body $xml
    Info "Created username/password: $Id"
}

# ==============================================================================
# STEP 1 -- Preflight
# ==============================================================================
Section "Preflight checks"

if (-not (Get-Command ssh-keygen -ErrorAction SilentlyContinue)) {
    Die "ssh-keygen not found.`nEnable it via: Settings -> Optional Features -> OpenSSH Client"
}

try {
    # -SessionVariable captures the Set-Cookie response so subsequent POSTs
    # carry the same session that issued the crumb (required by Jenkins CSRF).
    Invoke-RestMethod -Uri "$JURL/api/json" -Headers $authHeader -SessionVariable 'sv' | Out-Null
    $script:JenkinsSession = $sv
    Info "Jenkins reachable at $JURL"
} catch {
    Die "Cannot reach Jenkins at $JURL`nCheck JENKINS_URL and JENKINS_TOKEN.`nError: $_"
}

# ==============================================================================
# STEP 2 -- Install plugins via Script Console
# (installNecessaryPlugins is an internal UI endpoint; /script is the correct
#  admin API and works with API-token auth on all Jenkins 2.x versions.)
# ==============================================================================
Section "Installing plugins"

$groovy = @'
["generic-webhook-trigger","ssh-agent","credentials-binding","workflow-aggregator","git","gitea","ws-cleanup"].each { id ->
    if (!Jenkins.instance.pluginManager.getPlugin(id)) {
        def p = Jenkins.instance.updateCenter.getPlugin(id)
        if (p) { p.deploy(true).get() } else { println "WARNING: plugin not found in update center: $id" }
    }
}
println "ok"
'@
$body = "script=" + [Uri]::EscapeDataString($groovy)
Invoke-Jenkins -Path '/script' -Body $body -ContentType 'application/x-www-form-urlencoded'
Info "Plugin install requested -- polling until complete..."

$maxWait = 180; $elapsed = 0
do {
    Start-Sleep -Seconds 10
    $elapsed += 10
    Write-Host -NoNewline '.'
    $uc      = Invoke-RestMethod -Uri "$JURL/updateCenter/api/json?depth=1" -Headers $authHeader -WebSession $script:JenkinsSession
    Set-StrictMode -Off
    $pending = @($uc.jobs | Where-Object {
        $_.type -in 'InstallationJob','PluginInstallationJob' -and
        (-not $_.status.success) -and (-not $_.status.failed)
    })
    Set-StrictMode -Version Latest
} while ($pending.Count -gt 0 -and $elapsed -lt $maxWait)
Write-Host ''
Info "Plugins installed"

$uc           = Invoke-RestMethod -Uri "$JURL/updateCenter/api/json?depth=1" -Headers $authHeader -WebSession $script:JenkinsSession
Set-StrictMode -Off
$needsRestart = @($uc.jobs | Where-Object { $_.requiresRestart }).Count -gt 0
Set-StrictMode -Version Latest
if ($needsRestart) {
    Warn "Restarting Jenkins to activate plugins..."
    Invoke-Jenkins -Path '/safeRestart'
    Start-Sleep -Seconds 15
    $elapsed = 0
    do {
        Start-Sleep -Seconds 5; $elapsed += 5
        Write-Host -NoNewline '.'
        # Re-capture session after restart -- old session cookie is now invalid.
        $up = $false
        try {
            Invoke-RestMethod -Uri "$JURL/api/json" -Headers $authHeader -SessionVariable 'sv' | Out-Null
            $script:JenkinsSession = $sv
            $up = $true
        } catch {}
    } while (-not $up -and $elapsed -lt 120)
    Write-Host ''
    Info "Jenkins back online"
}

# ==============================================================================
# STEP 3 -- SSH key pair
# ==============================================================================
Section "SSH key pair for deploy user"

$sshDir = Split-Path $SSH_KEY_FILE -Parent
if (-not (Test-Path $sshDir)) { New-Item -ItemType Directory -Force -Path $sshDir | Out-Null }

if (Test-Path $SSH_KEY_FILE) {
    Warn "Using existing private key: $SSH_KEY_FILE"
} else {
    & ssh-keygen -t ed25519 -C "jenkins-pixxel-deploy" -f $SSH_KEY_FILE -N '""'
    if ($LASTEXITCODE -ne 0) { Die "ssh-keygen failed" }
    Info "Generated key pair at $SSH_KEY_FILE"
}

$publicKey  = (Get-Content "${SSH_KEY_FILE}.pub" -Raw).Trim()
$privateKey = Get-Content $SSH_KEY_FILE -Raw

Write-Host ''
Write-Host ('=' * 68) -ForegroundColor Yellow
Write-Host "  Add this public key to ${DOCKER_HOST_IP} for user '${DEPLOY_USER}':" -ForegroundColor Yellow
Write-Host ''
Write-Host "  $publicKey" -ForegroundColor White
Write-Host ''
Write-Host "  Run on the Docker host (as root):" -ForegroundColor Yellow
Write-Host "    mkdir -p /home/${DEPLOY_USER}/.ssh"
Write-Host "    echo '$publicKey' >> /home/${DEPLOY_USER}/.ssh/authorized_keys"
Write-Host "    chmod 700 /home/${DEPLOY_USER}/.ssh && chmod 600 /home/${DEPLOY_USER}/.ssh/authorized_keys"
Write-Host ('=' * 68) -ForegroundColor Yellow
Write-Host ''
Read-Host "Press Enter once you have added the public key to the Docker host"

# ==============================================================================
# STEP 4 -- Create credentials
# ==============================================================================
Section "Creating Jenkins credentials"

New-JenkinsSshKey  'PROXMOX_APPS_KEY'       $DEPLOY_USER  $privateKey      'Proxmox apps - SSH key for deploy user on Docker host (shared across all apps on this host)'
New-JenkinsUserPass 'PIXXEL_GITEA_CRED'     $GITEA_USER   $GITEA_TOKEN     'Pixxel - Gitea read credential'
New-JenkinsSecret  'PIXXEL_DB_HOST'         $DB_HOST                       'Pixxel - DB host'
New-JenkinsSecret  'PIXXEL_DB_PORT'         $DB_PORT                       'Pixxel - DB port'
New-JenkinsSecret  'PIXXEL_DB_USER'         $DB_USER                       'Pixxel - DB user'
New-JenkinsSecret  'PIXXEL_DB_PASSWORD'     $DB_PASSWORD                   'Pixxel - DB password'
New-JenkinsSecret  'PIXXEL_DB_NAME'         $DB_NAME                       'Pixxel - DB name'
New-JenkinsSecret  'PIXXEL_NEXTAUTH_SECRET' $NEXTAUTH_SECRET               'Pixxel - NextAuth secret'
New-JenkinsSecret  'PIXXEL_NEXTAUTH_URL'    $NEXTAUTH_URL                  'Pixxel - NextAuth URL'
New-JenkinsSecret  'PIXXEL_WEBHOOK_TOKEN'   $WEBHOOK_TOKEN                 'Pixxel - webhook trigger token'

# ==============================================================================
# STEP 5 -- Create pipeline job
# ==============================================================================
Section "Creating pipeline job"

$repoUrl   = "$GITEA_URL/$GITEA_REPO.git"
$jobConfig = $XML_JOB `
    -replace '%%WEBHOOK_TOKEN%%', $WEBHOOK_TOKEN `
    -replace '%%GITEA_REPO_URL%%', $repoUrl

$jobExists = try { Invoke-RestMethod -Uri "$JURL/job/$JOB_NAME/api/json" -Headers $authHeader | Out-Null; $true } catch { $false }

if ($jobExists) {
    Warn "Job '$JOB_NAME' already exists - updating config..."
    Invoke-Jenkins -Path "/job/$JOB_NAME/config.xml" -Body $jobConfig
    Info "Updated job: $JOB_NAME"
} else {
    Invoke-Jenkins -Path "/createItem?name=$JOB_NAME" -Body $jobConfig
    Info "Created job: $JOB_NAME"
}

# ==============================================================================
# Done
# ==============================================================================
Section "Setup complete"

$webhookUrl = "$JURL/generic-webhook-trigger/invoke?token=$WEBHOOK_TOKEN"

Write-Host ''
Write-Host "Everything is configured. Next steps:" -ForegroundColor Green
Write-Host ''
Write-Host "  1. Add the Gitea webhook (Gitea repo -> Settings -> Webhooks -> Add):"
Write-Host "     URL:          $webhookUrl" -ForegroundColor Yellow
Write-Host "     Content type: application/json"
Write-Host "     Trigger:      Push events, branch filter: main"
Write-Host ''
Write-Host "  2. Confirm Jenkinsfile env block matches:"
Write-Host "     REMOTE_HOST = '$DOCKER_HOST_IP'"
Write-Host "     REMOTE_USER = '$DEPLOY_USER'"
Write-Host "     DEPLOY_DIR  = '$DEPLOY_DIR'"
Write-Host ''
Write-Host "  3. Trigger first build manually:"
Write-Host "     $JURL/job/$JOB_NAME/build"
Write-Host ''
Write-Host "  Webhook token: $WEBHOOK_TOKEN" -ForegroundColor Yellow
Write-Host ''
