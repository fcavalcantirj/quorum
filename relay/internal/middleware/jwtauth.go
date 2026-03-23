package middleware

import (
	"context"

	"github.com/go-chi/jwtauth/v5"
)

// NewJWTAuth creates a jwtauth.JWTAuth instance for the given HMAC secret.
// Uses HS256 signing algorithm (symmetric — server validates with same secret).
func NewJWTAuth(secret string) *jwtauth.JWTAuth {
	return jwtauth.New("HS256", []byte(secret), nil)
}

// UserIDFromContext extracts the user ID string from the JWT claims stored in context
// by the jwtauth.Verifier middleware. Returns the sub claim value and true if found.
func UserIDFromContext(ctx context.Context) (string, bool) {
	_, claims, err := jwtauth.FromContext(ctx)
	if err != nil {
		return "", false
	}
	sub, ok := claims["sub"].(string)
	return sub, ok
}
