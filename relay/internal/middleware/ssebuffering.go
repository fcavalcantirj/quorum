package middleware

import "net/http"

// SSENoBuffering sets the X-Accel-Buffering header to "no" on all responses
// served by the wrapped handler. This is CRITICAL for SSE to work through
// Easypanel's Traefik reverse proxy (per D-04).
//
// Without this header, Traefik buffers SSE frames for ~30 seconds and delivers
// them in a batch, breaking real-time streaming. The header is safe to set on
// non-SSE responses because Traefik (and nginx) only honour it when the
// response Content-Type is text/event-stream.
//
// Apply this middleware to any route group that serves SSE responses, including
// the A2A JSON-RPC handler which uses SSE for message/stream.
func SSENoBuffering(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set unconditionally on the route group — only SSE responses will be
		// affected in practice since Traefik ignores this header on non-SSE.
		w.Header().Set("X-Accel-Buffering", "no")
		next.ServeHTTP(w, r)
	})
}
