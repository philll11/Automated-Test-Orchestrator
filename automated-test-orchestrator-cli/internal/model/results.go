// cli-go/internal/model/results.go
package model

import "time"

// CliEnrichedTestExecutionResult represents a single, enriched result from the query endpoint.
type CliEnrichedTestExecutionResult struct {
	ID                string    `json:"id"`
	TestPlanID        string    `json:"testPlanId"`
	PlanComponentID   string    `json:"planComponentId"`
	ComponentName     *string   `json:"componentName,omitempty"`
	TestComponentID   string    `json:"testComponentId"`
	TestComponentName *string   `json:"testComponentName,omitempty"`
	Status            string    `json:"status"` // "SUCCESS" or "FAILURE"
	Message           *string   `json:"message,omitempty"`
	ExecutedAt        time.Time `json:"executedAt"`
}

// GetResultsFilters defines the available query parameters for the results endpoint.
type GetResultsFilters struct {
	TestPlanID            string
	DiscoveredComponentID string
	TestComponentID       string
	Status                string
}
