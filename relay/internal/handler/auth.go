package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/oauth2"

	mw "github.com/fcavalcanti/quorum/relay/internal/middleware"
	"github.com/fcavalcanti/quorum/relay/internal/service"
)

// AuthHandler handles OAuth login/callback, logout, and token refresh.
type AuthHandler struct {
	svc          *service.AuthService
	googleConfig *oauth2.Config
	githubConfig *oauth2.Config
	frontendURL  string
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(
	svc *service.AuthService,
	googleConfig *oauth2.Config,
	githubConfig *oauth2.Config,
	frontendURL string,
) *AuthHandler {
	return &AuthHandler{
		svc:          svc,
		googleConfig: googleConfig,
		githubConfig: githubConfig,
		frontendURL:  frontendURL,
	}
}

// GoogleLogin initiates the Google OAuth flow.
// Generates a CSRF state token, stores it in a short-lived cookie, and redirects to Google.
func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	state, err := generateStateToken()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "internal_error",
			"message": "Failed to initiate login.",
		})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		MaxAge:   300, // 5 minutes — enough time to complete the OAuth flow
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode, // Lax (not Strict) — required for OAuth redirect back (Pitfall 4)
		Path:     "/",
	})

	http.Redirect(w, r, h.googleConfig.AuthCodeURL(state), http.StatusFound)
}

// GoogleCallback handles the OAuth callback from Google.
// Validates CSRF state, exchanges code for token, fetches user info, upserts user,
// claims anonymous rooms, and issues session cookies.
func (h *AuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	// CSRF state validation
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_state",
			"message": "OAuth state mismatch. Please try logging in again.",
		})
		return
	}

	// Clear the state cookie immediately
	http.SetCookie(w, &http.Cookie{
		Name:   "oauth_state",
		Value:  "",
		MaxAge: -1,
		Path:   "/",
	})

	code := r.URL.Query().Get("code")
	if code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_code",
			"message": "Authorization code not provided.",
		})
		return
	}

	ctx := r.Context()

	oauthToken, err := h.googleConfig.Exchange(ctx, code)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "token_exchange_failed",
			"message": "Failed to exchange authorization code.",
		})
		return
	}

	// Fetch Google user info
	client := h.googleConfig.Client(ctx, oauthToken)
	resp, err := client.Get("https://www.googleapis.com/oauth2/v2/userinfo")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "userinfo_failed",
			"message": "Failed to retrieve user information from Google.",
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "userinfo_read_failed",
			"message": "Failed to read user information.",
		})
		return
	}

	var googleUser struct {
		ID      string `json:"id"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.Unmarshal(body, &googleUser); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "userinfo_parse_failed",
			"message": "Failed to parse user information from Google.",
		})
		return
	}

	user, err := h.svc.UpsertOAuthUser(ctx, googleUser.Email, googleUser.Name, googleUser.Picture, "google", googleUser.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "user_upsert_failed",
			"message": "Failed to create or update user account.",
		})
		return
	}

	// Claim any anonymous rooms created before login (D-08)
	anonSID := mw.GetAnonSessionID(ctx)
	if anonSID != "" {
		if err := h.svc.ClaimAnonymousRooms(ctx, user.ID, anonSID); err != nil {
			// Non-fatal — log and continue
			_ = err
		}
	}

	// Issue JWT access token
	accessToken, err := h.svc.CreateSession(user.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "session_failed",
			"message": "Failed to create session.",
		})
		return
	}

	// Redirect to frontend callback with token.
	redirectURL := fmt.Sprintf("%s/api/auth/callback?token=%s&expiresAt=%s",
		h.frontendURL,
		accessToken,
		url.QueryEscape(time.Now().Add(30*24*time.Hour).Format(time.RFC3339)),
	)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// GitHubLogin initiates the GitHub OAuth flow.
func (h *AuthHandler) GitHubLogin(w http.ResponseWriter, r *http.Request) {
	state, err := generateStateToken()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "internal_error",
			"message": "Failed to initiate login.",
		})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		MaxAge:   300,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	})

	http.Redirect(w, r, h.githubConfig.AuthCodeURL(state), http.StatusFound)
}

// GitHubCallback handles the OAuth callback from GitHub.
func (h *AuthHandler) GitHubCallback(w http.ResponseWriter, r *http.Request) {
	// CSRF state validation
	stateCookie, err := r.Cookie("oauth_state")
	if err != nil || stateCookie.Value != r.URL.Query().Get("state") {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_state",
			"message": "OAuth state mismatch. Please try logging in again.",
		})
		return
	}

	// Clear the state cookie
	http.SetCookie(w, &http.Cookie{
		Name:   "oauth_state",
		Value:  "",
		MaxAge: -1,
		Path:   "/",
	})

	code := r.URL.Query().Get("code")
	if code == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "missing_code",
			"message": "Authorization code not provided.",
		})
		return
	}

	ctx := r.Context()

	oauthToken, err := h.githubConfig.Exchange(ctx, code)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "token_exchange_failed",
			"message": "Failed to exchange authorization code.",
		})
		return
	}

	// Fetch GitHub user info
	githubUser, err := fetchGitHubUser(oauthToken.AccessToken)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "userinfo_failed",
			"message": "Failed to retrieve user information from GitHub.",
		})
		return
	}

	// GitHub may return empty email from /user — fetch from /user/emails if needed
	email := githubUser.Email
	if email == "" {
		email, err = fetchGitHubPrimaryEmail(oauthToken.AccessToken)
		if err != nil || email == "" {
			// Fall back to a synthetic email using GitHub login
			email = fmt.Sprintf("%s@users.noreply.github.com", githubUser.Login)
		}
	}

	displayName := githubUser.Name
	if displayName == "" {
		displayName = githubUser.Login
	}

	user, err := h.svc.UpsertOAuthUser(ctx, email, displayName, githubUser.AvatarURL, "github", strconv.Itoa(githubUser.ID))
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "user_upsert_failed",
			"message": "Failed to create or update user account.",
		})
		return
	}

	// Claim any anonymous rooms (D-08)
	anonSID := mw.GetAnonSessionID(ctx)
	if anonSID != "" {
		if err := h.svc.ClaimAnonymousRooms(ctx, user.ID, anonSID); err != nil {
			_ = err // Non-fatal
		}
	}

	accessToken, err := h.svc.CreateSession(user.ID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":   "session_failed",
			"message": "Failed to create session.",
		})
		return
	}

	// Redirect to frontend callback with token as query param.
	// The frontend route handler (/api/auth/callback) sets the cookie on the frontend domain.
	redirectURL := fmt.Sprintf("%s/api/auth/callback?token=%s&expiresAt=%s",
		h.frontendURL,
		accessToken,
		url.QueryEscape(time.Now().Add(30*24*time.Hour).Format(time.RFC3339)),
	)
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// Logout revokes the refresh token and clears session cookies.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if c, err := r.Cookie("refresh_token"); err == nil && c.Value != "" {
		// Non-fatal — clear cookies regardless
		_ = h.svc.Logout(ctx, c.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:   "jwt",
		Value:  "",
		MaxAge: -1,
		Path:   "/",
	})
	http.SetCookie(w, &http.Cookie{
		Name:   "refresh_token",
		Value:  "",
		MaxAge: -1,
		Path:   "/auth/refresh",
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// RefreshToken rotates the refresh token and issues a new JWT access token.
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	c, err := r.Cookie("refresh_token")
	if err != nil || c.Value == "" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "no_refresh_token",
			"message": "No refresh token provided.",
		})
		return
	}

	newAccessToken, newRefreshToken, err := h.svc.RefreshSession(ctx, c.Value)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "refresh_failed",
			"message": "Refresh token is invalid or expired. Please log in again.",
		})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     "jwt",
		Value:    newAccessToken,
		MaxAge:   30 * 24 * 3600,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Path:     "/",
	})

	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    newRefreshToken,
		MaxAge:   90 * 24 * 3600,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		Path:     "/auth/refresh",
	})

	writeJSON(w, http.StatusOK, map[string]string{"message": "session refreshed"})
}

// Me returns the authenticated user's profile from JWT claims.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	userIDStr, ok := mw.UserIDFromContext(ctx)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{
			"error":   "unauthorized",
			"message": "Authentication required.",
		})
		return
	}

	// Parse the UUID string into pgtype.UUID.
	// The JWT sub claim carries a standard UUID string (8-4-4-4-12 hex groups).
	var pgUUID pgtype.UUID
	if err := pgUUID.Scan(userIDStr); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error":   "invalid_user_id",
			"message": "Invalid user ID in token.",
		})
		return
	}

	user, err := h.svc.GetUserByID(ctx, pgUUID)
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error":   "user_not_found",
			"message": "User not found.",
		})
		return
	}

	resp := map[string]any{
		"id":           userIDStr,
		"email":        user.Email,
		"display_name": user.DisplayName,
		"provider":     user.Provider,
	}
	if user.AvatarUrl.Valid {
		resp["avatar_url"] = user.AvatarUrl.String
	}

	writeJSON(w, http.StatusOK, resp)
}

// generateStateToken creates a cryptographically random hex string for OAuth CSRF protection.
func generateStateToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// githubUserInfo holds the fields we care about from the GitHub /user API.
type githubUserInfo struct {
	ID        int    `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatar_url"`
}

// fetchGitHubUser calls the GitHub /user endpoint with the access token.
func fetchGitHubUser(accessToken string) (*githubUserInfo, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "token "+accessToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var user githubUserInfo
	if err := json.Unmarshal(body, &user); err != nil {
		return nil, err
	}
	return &user, nil
}

// githubEmail represents one entry from the GitHub /user/emails response.
type githubEmail struct {
	Email   string `json:"email"`
	Primary bool   `json:"primary"`
	Verified bool  `json:"verified"`
}

// fetchGitHubPrimaryEmail fetches the primary verified email from GitHub's /user/emails endpoint.
func fetchGitHubPrimaryEmail(accessToken string) (string, error) {
	req, err := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "token "+accessToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var emails []githubEmail
	if err := json.Unmarshal(body, &emails); err != nil {
		return "", err
	}

	for _, e := range emails {
		if e.Primary && e.Verified {
			return e.Email, nil
		}
	}
	// Fall back to any verified email
	for _, e := range emails {
		if e.Verified {
			return e.Email, nil
		}
	}
	return "", nil
}

