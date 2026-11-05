.PHONY: demo tiles test up down
up:
	docker compose up -d --build
down:
	docker compose down
demo: up
	docker compose exec api npx prisma migrate deploy
	docker compose exec api npx prisma db seed
	@echo "BaseForte em http://localhost:3006"
tiles:
	@echo "Baixa PMTiles de Teresina (requer rede, 1 vez). Requer o CLI 'pmtiles'."
	pmtiles extract https://build.protomaps.com/$$(date -v-1d +%Y%m%d).pmtiles web/public/map/teresina.pmtiles --bbox=-42.90,-5.20,-42.70,-4.99
test:
	npm test
