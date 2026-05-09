# DIU Lens Production Guide

## Deployment Checklist
- [ ] Configure environment variables in `/etc/diu-lens/api.env` (or via Docker Secrets/ENV).
- [ ] Set `APP_ENV=production`.
- [ ] Set a strong `JWT_SECRET`.
- [ ] Configure `ALLOWED_ORIGINS` to include the production frontend URL.
- [ ] Ensure `STORAGE_PATH` is writable by the app user.
- [ ] Run database migrations: `alembic upgrade head`.
- [ ] Bootstrap initial super admin via `BOOTSTRAP_ADMIN_*` env vars or `scripts/create_super_admin.py`.
- [ ] Verify Nginx configuration and SSL certificates.
- [ ] Run `scripts/smoke-test.sh` to verify API health and security.

## Production Readiness Checklist
- [ ] **Security**: Rate limiting enabled on auth and enrollment routes.
- [ ] **Security**: Admin routes protected by role-based access control.
- [ ] **Security**: CORS restricted to trusted origins.
- [ ] **Logging**: Structured logging configured (INFO level in production).
- [ ] **Database**: Postgres with pgvector installed and optimized.
- [ ] **Persistence**: Volume backups configured for `api_storage` and `postgres_data`.
- [ ] **Monitoring**: Healthcheck endpoints (`/health`) monitored by external service.
- [ ] **Stability**: Error handling in frontend catches API 500s and auth failures.

## Operational Protections
- [ ] **Log Rotation**: Configure Docker daemon to use local logging driver with size limits (`max-size: "10m"`, `max-file: "3"`).
- [ ] **Disk Monitoring**: Set up alerts for disk usage on the host machine, particularly the volume holding `/app/storage`.
- [ ] **Backups**: Schedule `scripts/backup.sh` via cron (e.g., daily) to backup the database and storage to an off-site location (e.g. S3).
- [ ] **Container Restarts**: Ensure `docker-compose.production.yml` uses `restart: always` for all services.
- [ ] **Healthchecks**: Validate that Docker healthchecks are correctly identifying failure states and restarting dependent containers.

## Known Issues
- Initial face processing is CPU-intensive; consider moving to a background worker if load increases.
- Storage path must be a persistent volume in Docker environments.

## Rollback Plan
1. **Application**: Revert Docker image tag to previous version.
2. **Database**: If migrations were applied, run `alembic downgrade -1` (caution: data loss may occur depending on the migration).
3. **Config**: Revert environment variable changes.

## Roadmap Priorities
1. **Infrastructure**: Migrate to background worker (Celery/Redis) for biometric processing.
2. **Features**: Student dashboard to check enrollment status.
3. **Security**: Multi-factor authentication (MFA) for admin accounts.
4. **Ops**: Automated database backups and off-site storage for processed images.
