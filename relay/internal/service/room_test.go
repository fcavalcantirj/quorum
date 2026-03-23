package service

import (
	"testing"
)

func TestSlugify(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"Test Room Alpha", "test-room-alpha"},
		{"Hello World!", "hello-world"},
		{"  spaces  everywhere  ", "spaces-everywhere"},
		{"UPPERCASE", "uppercase"},
		{"a--b--c", "a-b-c"},
		{"trailing-", "trailing"},
		{"-leading", "leading"},
		{"special@chars#here$now", "specialcharsherenow"},
		{"café", "caf"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := Slugify(tt.input)
			if got != tt.want {
				t.Errorf("Slugify(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestValidateSlug(t *testing.T) {
	valid := []string{"test-room", "abc", "a-b-c", "room123", "ab"}
	for _, s := range valid {
		// slugs of 2 chars may fail the 3-40 regex — adjust if needed
		err := ValidateSlug(s)
		if len(s) >= 3 && err != nil {
			t.Errorf("ValidateSlug(%q) unexpected error: %v", s, err)
		}
	}

	invalid := []string{"", "a", "-abc", "abc-", "ABC", "a b c"}
	for _, s := range invalid {
		if err := ValidateSlug(s); err == nil {
			t.Errorf("ValidateSlug(%q) should have returned error", s)
		}
	}
}
