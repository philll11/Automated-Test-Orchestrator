// automated-test-orchestrator-cli/internal/model/results.go
package model

import "time"

// TestCaseResult represents a single granular assertion result within a test process.
type TestCaseResult struct {
	TestCaseID      *string `json:"testCaseId"`
	TestDescription string  `json:"testDescription"`
	Status          string  `json:"status"` // "PASSED" or "FAILED"
	Details         *string `json:"details,omitempty"`
}

// CliEnrichedTestExecutionResult represents a single, enriched result from the query endpoint.
type CliEnrichedTestExecutionResult struct {
	ID                string           `json:"id"`
	TestPlanID        string           `json:"testPlanId"`
	TestPlanName      *string          `json:"testPlanName,omitempty"`
	PlanComponentID   string           `json:"planComponentId"`
	ComponentName     *string          `json:"componentName,omitempty"`
	TestComponentID   string           `json:"testComponentId"`
	TestComponentName *string          `json:"testComponentName,omitempty"`
	Status            string           `json:"status"` // "SUCCESS" or "FAILURE"
	Message           *string          `json:"message,omitempty"`
	TestCases         []TestCaseResult `json:"testCases,omitempty"`
	ExecutedAt        time.Time        `json:"executedAt"`
}

// GetResultsFilters defines the available query parameters for the results endpoint.
type GetResultsFilters struct {
	TestPlanID      string
	ComponentID     string
	TestComponentID string
	Status          string
}
