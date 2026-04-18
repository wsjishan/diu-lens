.DEFAULT_GOAL := help

.PHONY: help dev api web migrate db-setup

help:
	@echo "Targets:"
	@echo "  make dev      - setup PostgreSQL, run migrations, start API + web"
	@echo "  make migrate  - setup PostgreSQL and run alembic upgrade head"
	@echo "  make api      - run backend only"
	@echo "  make web      - run frontend only"
	@echo "  make db-setup - detect PostgreSQL and ensure diu_lens exists"

db-setup:
	@./scripts/devctl.sh db-setup

migrate:
	@./scripts/devctl.sh migrate

api:
	@./scripts/devctl.sh api

web:
	@./scripts/devctl.sh web

dev:
	@./scripts/devctl.sh dev
