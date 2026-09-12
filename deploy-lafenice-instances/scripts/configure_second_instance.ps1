[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InstanceDir,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
    [string]$InstanceName,

    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 65535)]
    [int]$FrontendPort,

    [Parameter(Mandatory = $true)]
    [string]$HostDataRoot
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

function Get-DotEnvValue {
    param(
        [string]$Content,
        [string]$Name
    )

    $match = [regex]::Match($Content, "(?m)^$([regex]::Escape($Name))=(.*)$")
    if ($match.Success) {
        return $match.Groups[1].Value.Trim()
    }
    return ""
}

function Set-DotEnvValue {
    param(
        [string]$Content,
        [string]$Name,
        [string]$Value,
        [string]$NewLine
    )

    $pattern = "(?m)^$([regex]::Escape($Name))=[^\r\n]*"
    $replacement = "$Name=$Value"
    if ([regex]::IsMatch($Content, $pattern)) {
        return [regex]::Replace($Content, $pattern, $replacement)
    }
    return $Content.TrimEnd() + $NewLine + $replacement + $NewLine
}

$InstanceDir = (Resolve-Path -LiteralPath $InstanceDir).Path
$envPath = Join-Path $InstanceDir ".env"
$composePath = Join-Path $InstanceDir "docker-compose.yml"
$startPath = Join-Path $InstanceDir "start-with-host-volumes.bat"

foreach ($requiredPath in @($envPath, $composePath, $startPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
        throw "The selected directory is not a LaFenice full export; missing: $requiredPath"
    }
}

if (-not [System.IO.Path]::IsPathRooted($HostDataRoot)) {
    throw "HostDataRoot must be an absolute path dedicated to this instance: $HostDataRoot"
}
$HostDataRoot = [System.IO.Path]::GetFullPath($HostDataRoot)
$dockerHostDataRoot = $HostDataRoot.Replace("\", "/")

$envContent = [System.IO.File]::ReadAllText($envPath)
$newLine = if ($envContent.Contains("`r`n")) { "`r`n" } else { "`n" }
$currentFrontendPort = Get-DotEnvValue -Content $envContent -Name "FRONTEND_PORT"
if ($currentFrontendPort -eq $FrontendPort.ToString()) {
    Write-Warning "FRONTEND_PORT is unchanged. Confirm that port $FrontendPort is not used by the first instance."
}

$values = [ordered]@{
    "DOCKER_NETWORK_NAME" = "$InstanceName-network"
    "API_CONTAINER_NAME" = "$InstanceName-api"
    "MONGODB_DATA_VOLUME" = "${InstanceName}_mongodb_data"
    "MONGODB_CONFIG_VOLUME" = "${InstanceName}_mongodb_config"
    "MONGODB2_DATA_VOLUME" = "${InstanceName}_mongodb2_data"
    "MOSQUITTO_CONFIG_VOLUME" = "${InstanceName}_mosquitto_config"
    "MOSQUITTO_DATA_VOLUME" = "${InstanceName}_mosquitto_data"
    "MOSQUITTO_LOG_VOLUME" = "${InstanceName}_mosquitto_log"
    "VALKEY_DATA_VOLUME" = "${InstanceName}_valkey_data"
    "SEAWEEDFS_DATA_VOLUME" = "${InstanceName}_seaweedfs_data"
    "API_UPLOADS_VOLUME" = "${InstanceName}_api_uploads"
    "HOST_DATA_ROOT" = $dockerHostDataRoot
    "MONGO_PRIMARY_CONTAINER_NAME" = "$InstanceName-mongodb-1"
    "MONGO_SECONDARY_CONTAINER_NAME" = "$InstanceName-mongodb-2"
    "MONGO_PRIMARY_REPLICA_SET_HOST" = "$InstanceName-mongodb-1"
    "MONGO_SECONDARY_REPLICA_SET_HOST" = "$InstanceName-mongodb-2"
    "MQTT_CONTAINER_NAME" = "$InstanceName-mosquitto"
    "MQTT_HOST" = "$InstanceName-mosquitto"
    "MQTT_PORT" = "1883"
    "VALKEY_CONTAINER_NAME" = "$InstanceName-valkey"
    "VALKEY_URL" = "redis://${InstanceName}-valkey:6379/0"
    "SEAWEEDFS_CONTAINER_NAME" = "$InstanceName-seaweedfs"
    "FASTAPI_PORT" = "11702"
    "API_HOST_PORT" = "11702"
    "FRONTEND_PORT" = $FrontendPort.ToString()
    "FRONTEND_IMAGE_NAME" = "$InstanceName-frontend:packaged"
    "FRONTEND_CONTAINER_NAME" = "$InstanceName-frontend"
}

foreach ($item in $values.GetEnumerator()) {
    $envContent = Set-DotEnvValue -Content $envContent -Name $item.Key -Value $item.Value -NewLine $newLine
}

$composeContent = [System.IO.File]::ReadAllText($composePath)
if ($composeContent -notmatch "(?m)^(?:\uFEFF)?name:\s*[^\r\n]+") {
    throw "Top-level Compose name was not found in: $composePath"
}
$composeNamePattern = New-Object System.Text.RegularExpressions.Regex("(?m)^(?:\uFEFF)?name:\s*[^\r\n]+")
$composeContent = $composeNamePattern.Replace($composeContent, "name: $InstanceName", 1)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, $envContent, $utf8NoBom)
[System.IO.File]::WriteAllText($composePath, $composeContent, $utf8NoBom)
New-Item -ItemType Directory -Path $HostDataRoot -Force | Out-Null

Write-Host ""
Write-Host "Second LaFenice instance configured." -ForegroundColor Green
Write-Host "Instance directory: $InstanceDir"
Write-Host "Compose project:    $InstanceName"
Write-Host "Frontend URL:       https://127.0.0.1:$FrontendPort/"
Write-Host "Host data root:     $HostDataRoot"
Write-Host ""
Write-Warning "Review and replace production secrets in .env before the first startup."
Write-Host "Then run: $startPath"
