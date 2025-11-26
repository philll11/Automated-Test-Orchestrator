// automated-test-orchestrator-cli/internal/errors/handler.go
package errors

import (
	"errors"
	"fmt"
	"os"

	"github.com/automated-test-orchestrator/cli-go/internal/client"
	"github.com/automated-test-orchestrator/cli-go/internal/style"
	"github.com/briandowns/spinner"
)

// FormatError inspects an error and creates a user-friendly, formatted string.
func FormatError(err error) string {
	var apiErr *client.APIError
	var netErr *client.NetworkError

	if errors.As(err, &apiErr) {
		// This is a structured error from the API (4xx, 5xx).
		return fmt.Sprintf("API Error (Status %d): %s", apiErr.StatusCode, apiErr.Message)
	} else if errors.As(err, &netErr) {
		// This is a client-side network error.
		return fmt.Sprintf("%s", netErr.Error())
	} else {
		// This is a generic, unexpected error (e.g., file not found).
		return fmt.Sprintf("An unexpected error occurred: %v", err)
	}
}

// HandleCLIError is a centralized, TERMINATING error handler.
// It formats the error message and exits the process.
func HandleCLIError(s *spinner.Spinner, err error) {
	if s != nil && s.Active() {
		s.Stop()
	}

	errorMessage := FormatError(err)
	fmt.Fprintln(os.Stderr) // Add a newline before the error for better visibility
	style.Error(errorMessage)
	os.Exit(1)
}
