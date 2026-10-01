# Docker Deployment

This stack packages the existing FastAPI backend with MySQL 8.0, Qdrant 1.19.1,
and local Tesseract OCR. It does not include a frontend because no frontend source
is currently available.

## Files

- `Dockerfile`: non-root API image with Tesseract, `chi_sim`, and `eng`.
- `docker-compose.deploy.yml`: isolated deployment stack.
- `.env.deploy.example`: safe deployment configuration template.
- `scripts/docker-entrypoint.sh`: MySQL wait, Alembic migration, then Uvicorn.

The existing `docker-compose.yml` remains the local development definition and is
not used by this deployment stack.

The deployment Compose project is explicitly named `financial-office-deploy`, so
its generated container names do not overlap the development project named
`financial-office-platform`.

## Security model

1. Copy `.env.deploy.example` to `.env.deploy` locally.
2. Replace every `CHANGE_ME` value with a deployment secret.
3. Keep `.env.deploy` outside Git. The repository ignore rules already exclude it.
4. Do not bake secrets into the image or pass them as Docker build arguments.
5. MySQL and Qdrant have no host port mappings. Only the API is published, and it
   binds to `127.0.0.1` by default.

The deployment network is a regular bridge network because the API needs outbound
access to the configured model providers. A future Nginx service can join
`financial-office-deploy-backend` and proxy to `api:8000`; no placeholder frontend
service is included.

## Services and persistence

| Service | Image or build | Host port | Persistent volume |
| --- | --- | --- | --- |
| `api` | Local `Dockerfile` | `127.0.0.1:8000` by default | `financial-office-deploy-api-uploads` |
| `mysql` | `mysql:8.0.43` | None | `financial-office-deploy-mysql-data` |
| `qdrant` | `qdrant/qdrant:v1.19.1` | None | `financial-office-deploy-qdrant-data` |

MySQL uses `utf8mb4` and `utf8mb4_unicode_ci`. Qdrant is reached by the API at
`http://qdrant:6333`. Existing host MySQL data, host Qdrant data, uploads, logs, and
backups are not copied into the image or the named volumes.

The deployment network is `financial-office-deploy-backend`. All model retry
controls are explicitly disabled with `AI_MAX_RETRIES=0`, `AI_SDK_MAX_RETRIES=0`,
and `EMBEDDING_MAX_RETRIES=0`, matching the validated single-attempt behavior.

Never run `docker compose down -v` against this stack unless permanent deletion of
all three named data volumes is explicitly intended and independently backed up.

## OCR

The API image installs the Debian packages `tesseract-ocr`,
`tesseract-ocr-chi-sim`, and `tesseract-ocr-eng`. Runtime configuration enables OCR
with `PDF_OCR_EXECUTABLE=tesseract` and `PDF_OCR_LANGUAGES=chi_sim+eng`. Existing
page, document timeout, page-count, and concurrency limits remain configurable in
`.env.deploy`.

## Startup and migrations

Compose waits for MySQL and Qdrant health checks. The API entrypoint then performs
an independent MySQL readiness loop without printing the database URL. After MySQL
is reachable, it runs:

```sh
alembic upgrade head
```

Uvicorn starts only when migration succeeds. A migration failure exits the
container, so the API is never marked ready on a partially migrated schema. This
phase only defines that behavior; no migration is executed while creating these
files.

The entrypoint is appropriate for a single API replica. Before scaling to multiple
replicas, move migrations to a single controlled release job to avoid concurrent
migration attempts.

## Static validation

Create a local deployment environment file first:

```powershell
Copy-Item .env.deploy.example .env.deploy
```

Replace every `CHANGE_ME`, then validate interpolation without starting containers:

```powershell
docker compose --env-file .env.deploy -f docker-compose.deploy.yml config
```

## Next-stage build and startup

These commands are for the later build and runtime acceptance phase; they are not
run during the static deployment-file phase:

```powershell
docker compose --env-file .env.deploy -f docker-compose.deploy.yml build api
docker compose --env-file .env.deploy -f docker-compose.deploy.yml up -d
docker compose --env-file .env.deploy -f docker-compose.deploy.yml ps
Invoke-WebRequest http://127.0.0.1:8000/api/v1/system/health/ready
```

Inspect startup and migration logs without exposing environment variables:

```powershell
docker compose --env-file .env.deploy -f docker-compose.deploy.yml logs api
```
