// cli-go/internal/model/api_error.go
package model

// APIErrorResponse represents the structured error message from the API.
type APIErrorResponse struct {
	Metadata struct {
		Message string `json:"message"`
	} `json:"metadata"`
}
