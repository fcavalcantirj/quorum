# Stage 1: Build
FROM golang:1.26-alpine AS builder

# CGO disabled: static binary, no C runtime dependency at runtime
ENV CGO_ENABLED=0 GOOS=linux GOARCH=amd64

WORKDIR /build

# Layer cache optimisation: download dependencies before copying source
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build the binary
COPY . .
RUN go build \
    -trimpath \
    -ldflags="-s -w" \
    -o relay \
    ./cmd/server

# Stage 2: Runtime
FROM alpine:3.21

# ca-certificates: required for HTTPS outbound (Postgres TLS, OAuth providers)
# tzdata: required for time.LoadLocation in Go standard library
RUN apk --no-cache add ca-certificates tzdata

# Non-root user: security best practice
RUN addgroup -S relay && adduser -S relay -G relay

WORKDIR /app

# Copy only the compiled binary — goose migrations are embedded via go:embed
COPY --from=builder /build/relay .

USER relay

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/healthz || exit 1

ENTRYPOINT ["./relay"]
