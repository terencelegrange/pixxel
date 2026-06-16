# Database Setup

This directory contains a full export of the `saas_app` MariaDB database (schema + data).

## Files

| File | Description |
|---|---|
| `saas_app_dump.sql` | Full dump — all tables, indexes, and data |

## Restore

### Into a running MariaDB Docker container

```bash
# Copy the dump into the container, then import
docker exec -i <container-name> mariadb -u root -p<password> saas_app < saas_app_dump.sql
```

Or create the database first if it doesn't exist:

```bash
docker exec -i <container-name> mariadb -u root -p<password> \
  -e "CREATE DATABASE IF NOT EXISTS saas_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

docker exec -i <container-name> mariadb -u root -p<password> saas_app < saas_app_dump.sql
```

### Locally (if mariadb client is installed)

```bash
mariadb -h 127.0.0.1 -P 3306 -u root -p saas_app < saas_app_dump.sql
```

## Re-export

To regenerate this dump from the running Docker container:

```bash
docker exec mariadb-db-1 mariadb-dump -u root -p<password> \
  --single-transaction --routines --triggers saas_app \
  > database-setup/saas_app_dump.sql
```

## Connection details

Configured via `.env.local` (gitignored):

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=<see .env.local>
DB_NAME=saas_app
```
