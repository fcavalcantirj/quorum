package middleware

import (
	"encoding/json"
	"net/http"
)

// A2AVersionGuard rejects requests without a valid A2A-Version: 1.0 header.
// Returns a JSON-RPC 2.0 error response with A2A VersionNotSupportedError code -32001.
// Per A2A-05 requirement.
func A2AVersionGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		v := r.Header.Get("A2A-Version")
		if v != "1.0" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{
				"jsonrpc": "2.0",
				"error": map[string]any{
					"code":    -32001,
					"message": "version not supported",
				},
				"id": nil,
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}
