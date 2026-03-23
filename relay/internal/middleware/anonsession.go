package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
)

type contextKey string

const AnonSessionIDKey contextKey = "anon_session_id"

// AnonSession middleware reads or creates an anonymous session ID cookie.
// The session ID is placed in the request context for downstream handlers.
func AnonSession(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var sid string
		if c, err := r.Cookie("anon_sid"); err == nil && c.Value != "" {
			sid = c.Value
		} else {
			b := make([]byte, 16)
			rand.Read(b)
			sid = hex.EncodeToString(b)
			http.SetCookie(w, &http.Cookie{
				Name:     "anon_sid",
				Value:    sid,
				MaxAge:   7 * 24 * 3600, // 7 days
				HttpOnly: true,
				Secure:   true,
				SameSite: http.SameSiteLaxMode,
				Path:     "/",
			})
		}
		ctx := context.WithValue(r.Context(), AnonSessionIDKey, sid)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetAnonSessionID extracts the anonymous session ID from context.
func GetAnonSessionID(ctx context.Context) string {
	if v, ok := ctx.Value(AnonSessionIDKey).(string); ok {
		return v
	}
	return ""
}
