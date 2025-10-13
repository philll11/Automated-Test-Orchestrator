// cli-go/internal/model/mapping.go
package model

import "time"

// CliMapping represents a single mapping record returned by the API.
type CliMapping struct {
	ID                string    `json:"id"`
	MainComponentID   string    `json:"mainComponentId"`
	TestComponentID   string    `json:"testComponentId"`
	TestComponentName *string   `json:"testComponentName,omitempty"` // Use a pointer for optional fields
	IsDeployed        *bool     `json:"isDeployed,omitempty"`
	IsPackaged        *bool     `json:"isPackaged,omitempty"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// CreateMappingRequest is the structure for the POST /mappings request body.
type CreateMappingRequest struct {
	MainComponentID   string  `json:"mainComponentId"`
	TestComponentID   string  `json:"testComponentId"`
	TestComponentName *string `json:"testComponentName,omitempty"`
	IsDeployed        *bool   `json:"isDeployed,omitempty"`
	IsPackaged        *bool   `json:"isPackaged,omitempty"`
}