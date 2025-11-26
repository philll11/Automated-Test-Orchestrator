// automated-test-orchestrator-cli/internal/client/errors.go
package client

import "fmt"

// APIError represents an error returned by the backend API (e.g., 4xx or 5xx).
type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("API Error (Status %d): %s", e.StatusCode, e.Message)
}

// NetworkError represents a client-side network error (e.g., connection refused).
type NetworkError struct {
	Message string
	Err     error
}

func (e *NetworkError) Error() string {
	return fmt.Sprintf("Network Error: %s", e.Message)
}
