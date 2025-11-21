// cli-go/internal/model/test_plan.go
package model

import "time"

// CliTestExecutionResult represents a single test execution result.
type CliTestExecutionResult struct {
	ID                string           `json:"id"`
	TestComponentID   string           `json:"testComponentId"`
	TestComponentName *string          `json:"testComponentName,omitempty"`
	Status            string           `json:"status"` // "SUCCESS" or "FAILURE"
	Message           *string          `json:"message,omitempty"`
	TestCases         []TestCaseResult `json:"testCases,omitempty"`
}

// CliAvailableTest holds the ID and Name of a test found during discovery.
type CliAvailableTest struct {
	ID   string  `json:"id"`
	Name *string `json:"name,omitempty"`
}

// CliPlanComponent represents a component within a plan, enriched with its tests and results.
type CliPlanComponent struct {
	ID               string                   `json:"id"`
	TestPlanID       string                   `json:"testPlanId"`
	ComponentID      string                   `json:"componentId"`
	ComponentName    *string                  `json:"componentName,omitempty"`
	ComponentType    *string                  `json:"componentType,omitempty"`
	AvailableTests   []CliAvailableTest       `json:"availableTests"`
	ExecutionResults []CliTestExecutionResult `json:"executionResults"`
}

// CliTestPlan represents the entire Test Plan object returned by the API.
type CliTestPlan struct {
	ID             string             `json:"id"`
	Name           string             `json:"name"`
	Status         string             `json:"status"`
	FailureReason  *string            `json:"failureReason,omitempty"`
	CreatedAt      time.Time          `json:"createdAt"`
	UpdatedAt      time.Time          `json:"updatedAt"`
	PlanComponents []CliPlanComponent `json:"planComponents"`
}

// CliTestPlanSummary represents a summary of a Test Plan for the list view.
type CliTestPlanSummary struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// InitiateDiscoveryRequest is the structure for the POST /test-plans request body.
type InitiateDiscoveryRequest struct {
	Name                 string   `json:"name"`
	ComponentIDs         []string `json:"componentIds"`
	CredentialProfile    string   `json:"credentialProfile"`
	DiscoverDependencies bool     `json:"discoverDependencies"`
}

// InitiateExecutionRequest is the structure for the POST /test-plans/{planId}/execute request body.
type InitiateExecutionRequest struct {
	TestsToRun        []string `json:"testsToRun,omitempty"`
	CredentialProfile string   `json:"credentialProfile"`
}
