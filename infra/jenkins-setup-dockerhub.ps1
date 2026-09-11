#Requires -Version 5.1
# =============================================================================
# infra/jenkins-setup-dockerhub.ps1
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
# Usage (from repo root):
#   . .\infra\jenkins.config.ps1
#   .\infra\jenkins-setup-dockerhub.ps1
#
# Requires the same $JENKINS_URL / $JENKINS_USER / $JENKINS_TOKEN used by
# infra/jenkins-setup.ps1 (infra/jenkins.config.ps1).
# =============================================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Info    { param($m) Write-Host "[+] $m" -ForegroundColor Green }
function Warn    { param($m) Write-Host "[!] $m" -ForegroundColor Yellow }
function Section { param($m) Write-Host "`n--- $m ---" -ForegroundColor Cyan }
function Die     { param($m) Write-Host "[x] $m" -ForegroundColor Red; exit 1 }

$XML_JOB = @'
<?xml version="1.1" encoding="UTF-8"?>
<flow-definition plugin="workflow-job">
  <description>Pixxel - build and push a versioned image + latest to Docker Hub</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>%%GITHUB_REPO_URL%%</url>
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
    <scriptPath>Jenkinsfile.dockerhub</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
'@

foreach ($v in @('JENKINS_URL','JENKINS_USER','JENKINS_TOKEN')) {
    $val = Get-Variable -Name $v -ValueOnly -ErrorAction SilentlyContinue
    if ([string]::IsNullOrEmpty($val)) {
        Die "Required variable `$$v is not set. Dot-source infra\jenkins.config.ps1 first."
    }
}

if ([string]::IsNullOrEmpty((Get-Variable -Name 'GITHUB_REPO_URL' -ValueOnly -ErrorAction SilentlyContinue))) {
    $GITHUB_REPO_URL = 'https://github.com/terencelegrange/pixxel.git'
}
if ([string]::IsNullOrEmpty((Get-Variable -Name 'DOCKERHUB_JOB_NAME' -ValueOnly -ErrorAction SilentlyContinue))) {
    $DOCKERHUB_JOB_NAME = 'pixxel-dockerhub'
}
if ([string]::IsNullOrEmpty((Get-Variable -Name 'DOCKERHUB_CREDENTIALS_ID' -ValueOnly -ErrorAction SilentlyContinue))) {
    $DOCKERHUB_CREDENTIALS_ID = 'DOCKERHUB_CREDENTIALS'
}

$JURL = $JENKINS_URL.TrimEnd('/')

$authBytes   = [System.Text.Encoding]::ASCII.GetBytes(("{0}:{1}" -f $JENKINS_USER, $JENKINS_TOKEN))
$encodedAuth = [Convert]::ToBase64String($authBytes)
$authHeader  = @{ Authorization = "Basic $encodedAuth" }
$script:JenkinsSession = $null

Add-Type -ErrorAction SilentlyContinue @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllDockerhub : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int p) { return true; }
}
"@
try { [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllDockerhub } catch {}
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

function Get-JenkinsCrumb {
    $params = @{ Uri = "$JURL/crumbIssuer/api/json"; Headers = $authHeader; ErrorAction = 'Stop' }
    if ($script:JenkinsSession) { $params.WebSession = $script:JenkinsSession }
    $r = Invoke-RestMethod @params
    return @{ ($r.crumbRequestField) = $r.crumb }
}

function Invoke-Jenkins {
    param([string]$Path, [string]$Body = '', [string]$ContentType = 'application/xml', [string]$Method = 'POST')
    $headers = $authHeader.Clone()
    (Get-JenkinsCrumb).GetEnumerator() | ForEach-Object { $headers[$_.Key] = $_.Value }
    $params = @{ Uri = "$JURL$Path"; Method = $Method; Headers = $headers; ContentType = $ContentType; ErrorAction = 'Stop' }
    if ($Body) { $params.Body = [System.Text.Encoding]::UTF8.GetBytes($Body) }
    if ($script:JenkinsSession) { $params.WebSession = $script:JenkinsSession }
    try {
        Invoke-RestMethod @params | Out-Null
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -ne 409) { throw }
    }
}

Section "Preflight checks"
try {
    Invoke-RestMethod -Uri "$JURL/api/json" -Headers $authHeader -SessionVariable 'sv' | Out-Null
    $script:JenkinsSession = $sv
    Info "Jenkins reachable at $JURL"
} catch {
    Die "Cannot reach Jenkins at $JURL`nCheck JENKINS_URL and JENKINS_TOKEN.`nError: $_"
}

Section "Checking DOCKERHUB_CREDENTIALS credential"
try {
    Invoke-RestMethod -Uri "$JURL/credentials/store/system/domain/_/credential/$DOCKERHUB_CREDENTIALS_ID/api/json" -Headers $authHeader -WebSession $script:JenkinsSession | Out-Null
    Info "Found credential: $DOCKERHUB_CREDENTIALS_ID"
} catch {
    Warn "Could not confirm credential '$DOCKERHUB_CREDENTIALS_ID' exists (this check needs admin rights and may false-negative)."
    Warn "If the pipeline fails at the 'Push to Docker Hub' stage, verify it in Manage Jenkins -> Credentials."
}

Section "Creating/updating pipeline job: $DOCKERHUB_JOB_NAME"

$jobExists = try { Invoke-RestMethod -Uri "$JURL/job/$DOCKERHUB_JOB_NAME/api/json" -Headers $authHeader | Out-Null; $true } catch { $false }
$jobConfig = $XML_JOB -replace '%%GITHUB_REPO_URL%%', $GITHUB_REPO_URL

if ($jobExists) {
    Warn "Job '$DOCKERHUB_JOB_NAME' already exists - updating config..."
    Invoke-Jenkins -Path "/job/$DOCKERHUB_JOB_NAME/config.xml" -Body $jobConfig
    Info "Updated job: $DOCKERHUB_JOB_NAME"
} else {
    Invoke-Jenkins -Path "/createItem?name=$DOCKERHUB_JOB_NAME" -Body $jobConfig
    Info "Created job: $DOCKERHUB_JOB_NAME"
}

Section "Setup complete"
Write-Host ''
Write-Host "'$DOCKERHUB_JOB_NAME' now builds from:" -ForegroundColor Green
Write-Host "  Repo:        $GITHUB_REPO_URL" -ForegroundColor Yellow
Write-Host "  Branch:      main"
Write-Host "  Script path: Jenkinsfile.dockerhub"
Write-Host ''
Write-Host "  Trigger a build:  $JURL/job/$DOCKERHUB_JOB_NAME/build"
Write-Host ''
