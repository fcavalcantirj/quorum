.PHONY: dev-db dev-db-stop dev build migrate generate clean

# Start local Postgres
dev-db:
	docker compose up -d postgres

# Stop local Postgres
dev-db-stop:
	docker compose down

# Build relay server
build:
	cd relay && go build -o bin/server ./cmd/server/

# Run relay server (requires .env loaded)
dev:
	cd relay && go run ./cmd/server/

# Generate sqlc code
generate:
	cd relay && sqlc generate

# Clean build artifacts
clean:
	rm -rf relay/bin/
