package middleware

import (
	"encoding/json"
	"net/http"
)

// BearerTokenQueryStringGuard rejects requests that put bearer tokens in URL query params.
// Per STATE.md: reject with 400 from day one, no recovery path.
func BearerTokenQueryStringGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("token") != "" || q.Get("bearer") != "" || q.Get("access_token") != "" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{
				"error":   "invalid_request",
				"message": "Bearer tokens must be sent in the Authorization header, not as query parameters.",
			})
			return
		}
		next.ServeHTTP(w, r)
	})
}
