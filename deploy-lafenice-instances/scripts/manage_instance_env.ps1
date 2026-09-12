[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Backup", "Restore")]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [string]$InstanceDir,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9][a-z0-9_-]*$')]
    [string]$InstanceName,

    [Parameter(Mandatory = $true)]
    [string]$BackupRoot,

    [string]$BackupFile
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$packageManagedKeys = @(
    "APP_VERSION",
    "MONGO_VERSION",
    "MQTT_VERSION",
    "VALKEY_VERSION",
    "SEAWEEDFS_VERSION"
)

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

function Get-DotEnvEntries {
    param([string]$Content)

    $entries = [ordered]@{}
    foreach ($line in ($Content -split "`n")) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }
        if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$") {
            $entries[$Matches[1]] = $Matches[2].Trim()
        }
    }
    return $entries
}

function Get-ComposeProjectName {
    param([string]$Content)

    $match = [regex]::Match($Content, "(?m)^(?:\uFEFF)?name:\s*([^\r\n#]+)")
    if (-not $match.Success) {
        throw "Top-level Compose name was not found."
    }
    return $match.Groups[1].Value.Trim().Trim('"').Trim("'")
}

function Set-ComposeProjectName {
    param(
        [string]$Content,
        [string]$Name
    )

    $pattern = New-Object System.Text.RegularExpressions.Regex("(?m)^(?:\uFEFF)?name:\s*[^\r\n#]+")
    if (-not $pattern.IsMatch($Content)) {
        throw "Top-level Compose name was not found."
    }
    return $pattern.Replace($Content, "name: $Name", 1)
}

$InstanceDir = (Resolve-Path -LiteralPath $InstanceDir).Path
$envPath = Join-Path $InstanceDir ".env"
$composePath = Join-Path $InstanceDir "docker-compose.yml"
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
    throw ".env was not found: $envPath"
}
if (-not (Test-Path -LiteralPath $composePath -PathType Leaf)) {
    throw "docker-compose.yml was not found: $composePath"
}

if (-not [System.IO.Path]::IsPathRooted($BackupRoot)) {
    throw "BackupRoot must be an absolute path outside the dist: $BackupRoot"
}
$BackupRoot = [System.IO.Path]::GetFullPath($BackupRoot)
$instancePrefix = $InstanceDir.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if ($BackupRoot.Equals($InstanceDir, [System.StringComparison]::OrdinalIgnoreCase) -or
    $BackupRoot.StartsWith($instancePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "BackupRoot must not be inside the instance directory: $BackupRoot"
}

$instanceBackupDir = Join-Path $BackupRoot $InstanceName
$currentBackupPath = Join-Path $instanceBackupDir "current.env"
$composeNamePath = Join-Path $instanceBackupDir "compose-name.txt"
$historyDir = Join-Path $instanceBackupDir "history"

if ($Action -eq "Backup") {
    New-Item -ItemType Directory -Path $historyDir -Force | Out-Null
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
    $historyPath = Join-Path $historyDir "$timestamp.env"
    if (Test-Path -LiteralPath $historyPath) {
        throw "A timestamped backup already exists: $historyPath"
    }

    [System.IO.File]::Copy($envPath, $historyPath, $false)
    [System.IO.File]::Copy($envPath, $currentBackupPath, $true)
    $composeName = Get-ComposeProjectName -Content ([System.IO.File]::ReadAllText($composePath))
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($composeNamePath, $composeName + [Environment]::NewLine, $utf8NoBom)

    Write-Host "Environment backup completed." -ForegroundColor Green
    Write-Host "Instance:       $InstanceName"
    Write-Host "Current backup: $currentBackupPath"
    Write-Host "History backup: $historyPath"
    Write-Host "Compose name:   $composeNamePath"
    Write-Warning "The backup contains secrets. Restrict access to authorized administrators."
    return
}

if ($BackupFile) {
    $sourceEnvPath = (Resolve-Path -LiteralPath $BackupFile).Path
} else {
    $sourceEnvPath = $currentBackupPath
}
if (-not (Test-Path -LiteralPath $sourceEnvPath -PathType Leaf)) {
    throw "Environment backup was not found: $sourceEnvPath"
}

$newContent = [System.IO.File]::ReadAllText($envPath)
$backupContent = [System.IO.File]::ReadAllText($sourceEnvPath)
$newLine = if ($newContent.Contains("`r`n")) { "`r`n" } else { "`n" }
$backupEntries = Get-DotEnvEntries -Content $backupContent

foreach ($item in $backupEntries.GetEnumerator()) {
    if ($packageManagedKeys -contains $item.Key) {
        continue
    }
    $newContent = Set-DotEnvValue -Content $newContent -Name $item.Key -Value $item.Value -NewLine $newLine
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($envPath, $newContent, $utf8NoBom)
if (Test-Path -LiteralPath $composeNamePath -PathType Leaf) {
    $composeName = ([System.IO.File]::ReadAllText($composeNamePath)).Trim()
    if (-not $composeName) {
        throw "Saved Compose project name is empty: $composeNamePath"
    }
    $composeContent = [System.IO.File]::ReadAllText($composePath)
    $composeContent = Set-ComposeProjectName -Content $composeContent -Name $composeName
    [System.IO.File]::WriteAllText($composePath, $composeContent, $utf8NoBom)
} else {
    Write-Warning "Compose project-name backup was not found. Verify the top-level name in docker-compose.yml before startup."
}

Write-Host "Environment restore completed." -ForegroundColor Green
Write-Host "Instance: $InstanceName"
Write-Host "Source:   $sourceEnvPath"
Write-Host "Target:   $envPath"
Write-Host "Kept package-managed versions from the new dist: $($packageManagedKeys -join ', ')"
Write-Warning "Validate Docker Compose and review .env before starting the restored instance."
