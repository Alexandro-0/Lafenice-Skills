---
name: deploy-lafenice-instances
description: Configure, verify, back up, restore, and upgrade one or multiple LaFenice full-export deployments on the same Docker host. Use when a customer installs a single LaFenice dist, installs several isolated instances side by side, must preserve a separate .env for every instance, restores instance settings into a newer dist, avoids Compose/container/network/volume/host-port conflicts, or diagnoses incorrect MQTT and Valkey ports.
---

# Deploy LaFenice Instances

## Choose the workflow

- For one installation, follow **Install one instance**.
- For two or more installations, configure the first normally, then follow
  **Install additional instances** for each extra copy.
- After every accepted `.env` change, follow **Back up and restore `.env`**.

Keep container-internal ports unchanged in every workflow:

```env
FASTAPI_PORT=11702
MQTT_PORT=1883
VALKEY_URL=redis://<instance-valkey-container>:6379/0
```

Only host-published ports, especially `FRONTEND_PORT`, must differ. Containers
may reuse internal ports because each instance has its own Docker network.

## Install one instance

1. Extract the pristine full-export ZIP.
2. In `.env`, set a stable absolute data directory outside the release folder:

```env
HOST_DATA_ROOT=D:/LaFeniceData/full1
FRONTEND_PORT=11701
```

3. Replace placeholder/default secrets before production use. At minimum review
   `MONGO_ROOT_PASSWORD`, `MQTT_PASSWORD`, `JWT_SECRET`, and enabled
   default-account passwords.
4. Run `start-with-host-volumes.bat`.
5. Back up this instance's `.env` as `lafenice-full1` using the backup workflow.

Do not rename Compose, containers, network, or volumes when only one instance is
installed.

## Install additional instances

For each additional instance:

1. Extract the same pristine ZIP into a different folder. Never copy a running
   instance's `volumes/` directory.
2. Before first startup, run:

```powershell
powershell -ExecutionPolicy Bypass -File `
  .\plugin_skills\deploy-lafenice-instances\scripts\configure_second_instance.ps1 `
  -InstanceDir "C:\LaFenice\full2\LaFenice_full_export_..." `
  -InstanceName "lafenice-full2" `
  -FrontendPort 11801 `
  -HostDataRoot "D:\LaFeniceData\full2"
```

3. Replace production secrets, then run `start-with-host-volumes.bat`.
4. Back up `.env` using the exact same `InstanceName`.

Repeat with `lafenice-full3`, another free frontend port, and another data root
for a third instance. The configuration script gives Compose, network,
containers, named volumes, frontend image, and host data unique names while
keeping MQTT at `1883`, Valkey at `6379`, and FastAPI at `11702` internally.

## Back up and restore `.env`

Treat `.env` as secret material. Store backups outside the dist and outside
`HOST_DATA_ROOT`, restrict the backup directory to authorized administrators,
and never commit or email it.

Back up each instance after installation and after every accepted change:

```powershell
powershell -ExecutionPolicy Bypass -File `
  .\plugin_skills\deploy-lafenice-instances\scripts\manage_instance_env.ps1 `
  -Action Backup `
  -InstanceDir "C:\LaFenice\full2\LaFenice_full_export_..." `
  -InstanceName "lafenice-full2" `
  -BackupRoot "D:\LaFeniceConfigBackups"
```

This creates separate files for every instance:

```text
D:/LaFeniceConfigBackups/
  lafenice-full1/current.env
  lafenice-full1/compose-name.txt
  lafenice-full1/history/20260817-190000-000.env
  lafenice-full2/current.env
  lafenice-full2/compose-name.txt
  lafenice-full2/history/20260817-191000-000.env
```

To upgrade, extract the new dist into a new folder and restore before startup:

```powershell
powershell -ExecutionPolicy Bypass -File `
  .\plugin_skills\deploy-lafenice-instances\scripts\manage_instance_env.ps1 `
  -Action Restore `
  -InstanceDir "C:\LaFenice\full2\LaFenice_full_export_NEW" `
  -InstanceName "lafenice-full2" `
  -BackupRoot "D:\LaFeniceConfigBackups"
```

Restore merges customer settings and secrets into the new `.env`, restores that
instance's Compose project name, and does not overwrite new package-managed versions (`APP_VERSION`, `MONGO_VERSION`,
`MQTT_VERSION`, `VALKEY_VERSION`, `SEAWEEDFS_VERSION`). This prevents an old
backup from restoring an incompatible image version. Validate, start the new
release, then back up its accepted `.env` again.

## Verify every instance

From each instance folder, run:

```powershell
docker compose --env-file .env -f docker-compose.yml -f docker-compose.host-volumes.yml config --quiet
docker compose --env-file .env -f docker-compose.yml -f docker-compose.host-volumes.yml ps
```

Confirm the expected frontend URL and healthy containers. When multiple
instances exist, confirm the other instances remain running.

If `/api/admin-mqtt-credentials` reports `connection refused`, confirm
`MQTT_PORT=1883`. If Valkey operations fail, confirm the URL ends in `:6379/0`.

## Handle optional external MQTT separately

The packaged Compose does not publish Mosquitto to the host, so multiple
instances have no MQTT host-port conflict by default. If external MQTT clients
are required, map a unique host port such as `1983:1883` for the second instance
while keeping API `MQTT_PORT=1883`. Do not expose the current unencrypted MQTT
listener to a LAN or the Internet without TLS and firewall controls.

## Safety rules

- Never reuse `HOST_DATA_ROOT`, Compose project, network, container names,
  volume names, or `FRONTEND_PORT` across instances.
- Never overwrite a newer release's `.env` with an old file; use the merge-based
  restore script.
- Never store `.env` backups inside a release directory, source repository, or
  data volume directory.
- Never print or include `.env` values in reports.
- Never run `docker compose down -v` during an ordinary update.
- Never reconfigure an instance identity after it contains production data;
  perform an explicit migration instead.
