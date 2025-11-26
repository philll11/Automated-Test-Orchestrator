// automated-test-orchestrator-cli/internal/model/credentials.go
package model

// Contains credential information that is safe to display.
type CliDisplayCredential struct {
	AccountID           string `json:"accountId"`
	Username            string `json:"username"`
	ExecutionInstanceID string `json:"executionInstanceId"`
}

// Represents a full credential profile as returned by the API.
type CliCredentialProfile struct {
	ProfileName string               `json:"profileName"`
	Credentials CliDisplayCredential `json:"credentials"`
}

// Structure for the POST /credentials request body.
type AddCredentialRequest struct {
	ProfileName         string `json:"profileName"`
	AccountID           string `json:"accountId"`
	Username            string `json:"username"`
	PasswordOrToken     string `json:"passwordOrToken"`
	ExecutionInstanceID string `json:"executionInstanceId"`
}
