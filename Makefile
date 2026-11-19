.PHONY: dev up down logs test build ssl backup
up:        ## sobe stack de produção
	docker compose up -d --build
down:
	docker compose down
logs:
	docker compose logs -f --tail=200
test:      ## testes do motor musical + build web
	cd ai-worker && python -m pytest -q tests
	cd frontend && npm run build
dev:       ## frontend local com proxy p/ API em localhost:8000
	cd frontend && npm run dev
backup:
	bash infra/scripts/backup.sh
