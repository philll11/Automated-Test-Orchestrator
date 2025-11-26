// automated-test-orchestrator-cli/internal/client/client.go
package client

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"syscall"
	"time"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
)

// APIClient is responsible for making HTTP requests to the backend service.
type APIClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

// NewAPIClient creates a new client for interacting with the orchestrator API.
func NewAPIClient(baseURL string) *APIClient {
	return &APIClient{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// handleRequestError is a centralized utility to process non-2xx HTTP responses.
func handleRequestError(resp *http.Response) error {
	bodyBytes, _ := io.ReadAll(resp.Body)

	// Attempt to parse the structured API error message from the response body.
	var apiErr model.APIErrorResponse
	if err := json.Unmarshal(bodyBytes, &apiErr); err == nil && apiErr.Metadata.Message != "" {
		return &APIError{
			StatusCode: resp.StatusCode,
			Message:    apiErr.Metadata.Message,
		}
	}

	// Fallback for non-structured or empty error responses.
	message := "No additional details provided by the server."
	if len(bodyBytes) > 0 {
		message = string(bodyBytes)
	}
	return &APIError{
		StatusCode: resp.StatusCode,
		Message:    message,
	}
}

// do is a wrapper around http.Client.Do to inject our custom network error handling.
func (c *APIClient) do(req *http.Request) (*http.Response, error) {
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		// Check for specific network errors like connection refused.
		var urlErr *url.Error
		if errors.As(err, &urlErr) && errors.Is(urlErr.Err, syscall.ECONNREFUSED) {
			return nil, &NetworkError{Message: "Connection refused. Is the backend server running?", Err: err}
		}
		// Return a generic network error for other issues (e.g., DNS resolution failure).
		return nil, &NetworkError{Message: "An unexpected network error occurred.", Err: err}
	}
	return resp, nil
}

// ##############################################################
// Credential Profile Management
// ##############################################################

// ListCredentialProfiles fetches all credential profiles from the backend.
func (c *APIClient) ListCredentialProfiles() ([]model.CliCredentialProfile, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/credentials", c.BaseURL), nil)
	if err != nil {
		return nil, fmt.Errorf("internal error creating request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, handleRequestError(resp)
	}

	var apiResponse struct {
		Data []model.CliCredentialProfile `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode successful API response: %w", err)
	}

	return apiResponse.Data, nil
}

// AddCredentialProfile sends a new credential profile to be stored.
func (c *APIClient) AddCredentialProfile(data model.AddCredentialRequest) error {
	body, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("internal error marshaling request: %w", err)
	}

	req, err := http.NewRequest("POST", fmt.Sprintf("%s/credentials", c.BaseURL), bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("internal error creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return handleRequestError(resp)
	}

	return nil
}

// DeleteCredentialProfile removes a credential profile by its name.
func (c *APIClient) DeleteCredentialProfile(profileName string) error {
	req, err := http.NewRequest("DELETE", fmt.Sprintf("%s/credentials/%s", c.BaseURL, profileName), nil)
	if err != nil {
		return fmt.Errorf("internal error creating request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return handleRequestError(resp)
	}

	return nil
}

// ##############################################################
// Test Mapping Management
// ##############################################################

// GetAllMappings retrieves all existing test mappings from the backend.
func (c *APIClient) GetAllMappings() ([]model.CliMapping, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/mappings", c.BaseURL), nil)
	if err != nil {
		return nil, fmt.Errorf("internal error creating request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, handleRequestError(resp)
	}

	var apiResponse struct {
		Data []model.CliMapping `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode successful API response: %w", err)
	}

	return apiResponse.Data, nil
}

// CreateMapping creates a single new test mapping.
func (c *APIClient) CreateMapping(data model.CreateMappingRequest) (*model.CliMapping, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("internal error marshaling request: %w", err)
	}

	req, err := http.NewRequest("POST", fmt.Sprintf("%s/mappings", c.BaseURL), bytes.NewBuffer(body))
	if err != nil {
		return nil, fmt.Errorf("internal error creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, handleRequestError(resp)
	}

	var apiResponse struct {
		Data model.CliMapping `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode successful API response: %w", err)
	}

	return &apiResponse.Data, nil
}

// DeleteMapping deletes a test mapping by its unique ID.
func (c *APIClient) DeleteMapping(mappingID string) error {
	req, err := http.NewRequest("DELETE", fmt.Sprintf("%s/mappings/%s", c.BaseURL, mappingID), nil)
	if err != nil {
		return fmt.Errorf("internal error creating request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		return handleRequestError(resp)
	}

	return nil
}

// ##############################################################
// Test Plan Management
// ##############################################################

// GetAllPlans retrieves a summary list of all test plans.
func (c *APIClient) GetAllPlans() ([]model.CliTestPlanSummary, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/test-plans", c.BaseURL), nil)
	if err != nil {
		return nil, fmt.Errorf("internal error creating request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, handleRequestError(resp)
	}

	var apiResponse struct {
		Data []model.CliTestPlanSummary `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode successful API response: %w", err)
	}

	return apiResponse.Data, nil
}

// GetPlanStatus fetches the full details of a test plan by its ID.
func (c *APIClient) GetPlanStatus(planID string) (*model.CliTestPlan, error) {
	req, err := http.NewRequest("GET", fmt.Sprintf("%s/test-plans/%s", c.BaseURL, planID), nil)
	if err != nil {
		return nil, fmt.Errorf("internal error creating request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, handleRequestError(resp)
	}

	var apiResponse struct {
		Data model.CliTestPlan `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode successful API response: %w", err)
	}

	return &apiResponse.Data, nil
}

// DeleteTestPlan deletes a test plan by its unique ID.
func (c *APIClient) DeleteTestPlan(planID string) error {
	req, err := http.NewRequest("DELETE", fmt.Sprintf("%s/test-plans/%s", c.BaseURL, planID), nil)
	if err != nil {
		return fmt.Errorf("internal error creating request: %w", err)
	}

	resp, err := c.do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// A successful DELETE returns 204 No Content.
	if resp.StatusCode != http.StatusNoContent {
		return handleRequestError(resp)
	}

	return nil
}

// ###############################################################
// Discovery and Execution
// ###############################################################

var ErrPlanDiscoveryFailed = errors.New("test plan discovery failed on the server")
var ErrPlanExecutionFailed = errors.New("test plan execution failed on the server")

// InitiateDiscovery creates a new test plan on the backend.
func (c *APIClient) InitiateDiscovery(name string, componentIds []string, profile string, dependencies bool) (string, error) {
	payload := model.InitiateDiscoveryRequest{
		Name:                 name,
		ComponentIDs:         componentIds,
		CredentialProfile:    profile,
		DiscoverDependencies: dependencies,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("internal error marshaling request: %w", err)
	}

	req, err := http.NewRequest("POST", fmt.Sprintf("%s/test-plans", c.BaseURL), bytes.NewBuffer(body))
	if err != nil {
		return "", fmt.Errorf("internal error creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusAccepted {
		return "", handleRequestError(resp)
	}

	var apiResponse struct {
		Data struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return "", fmt.Errorf("failed to decode successful API response: %w", err)
	}

	return apiResponse.Data.ID, nil
}

// PollForPlanCompletion polls the API until the discovery phase is complete.
func (c *APIClient) PollForPlanCompletion(planID string) (*model.CliTestPlan, error) {
	for {
		plan, err := c.GetPlanStatus(planID)
		if err != nil {
			return nil, err
		}

		switch plan.Status {
		case "DISCOVERING":
			time.Sleep(2 * time.Second) // Wait before polling again
			continue
		case "DISCOVERY_FAILED":
			return plan, ErrPlanDiscoveryFailed
		default: // AWAITING_SELECTION, COMPLETED, etc. are all success states for discovery.
			return plan, nil
		}
	}
}

// InitiateExecution starts the execution of tests for a given plan.
func (c *APIClient) InitiateExecution(planID string, testsToRun []string, profile string) error {
	payload := model.InitiateExecutionRequest{
		TestsToRun:        testsToRun,
		CredentialProfile: profile,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("internal error marshaling request: %w", err)
	}

	req, err := http.NewRequest("POST", fmt.Sprintf("%s/test-plans/%s/execute", c.BaseURL, planID), bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("internal error creating request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return handleRequestError(resp)
	}

	return nil
}

// PollForExecutionCompletion polls the API until the execution phase is complete.
func (c *APIClient) PollForExecutionCompletion(planID string) (*model.CliTestPlan, error) {
	for {
		plan, err := c.GetPlanStatus(planID)
		if err != nil {
			return nil, err
		}

		switch plan.Status {
		// These are transient states, so we continue polling.
		case "EXECUTING", "AWAITING_SELECTION":
			time.Sleep(3 * time.Second) // Wait before polling again
			continue
		case "EXECUTION_FAILED":
			return plan, ErrPlanExecutionFailed
		case "COMPLETED":
			return plan, nil
		default:
			// Any other status (like DISCOVERING) is unexpected during execution polling.
			return plan, fmt.Errorf("unexpected plan status '%s' during execution", plan.Status)
		}
	}
}

// ###############################################################
// Results Retrieval
// ###############################################################

// GetExecutionResults retrieves enriched test execution results based on filters.
func (c *APIClient) GetExecutionResults(filters model.GetResultsFilters) ([]model.CliEnrichedTestExecutionResult, error) {
	baseURL := fmt.Sprintf("%s/test-execution-results", c.BaseURL)
	req, err := http.NewRequest("GET", baseURL, nil)
	if err != nil {
		return nil, fmt.Errorf("internal error creating request: %w", err)
	}

	// Build query parameters dynamically
	q := url.Values{}
	if filters.TestPlanID != "" {
		q.Add("testPlanId", filters.TestPlanID)
	}
	if filters.ComponentID != "" {
		q.Add("componentId", filters.ComponentID)
	}
	if filters.TestComponentID != "" {
		q.Add("testComponentId", filters.TestComponentID)
	}
	if filters.Status != "" {
		q.Add("status", filters.Status)
	}
	req.URL.RawQuery = q.Encode()

	resp, err := c.do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, handleRequestError(resp)
	}

	var apiResponse struct {
		Data []model.CliEnrichedTestExecutionResult `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode successful API response: %w", err)
	}

	return apiResponse.Data, nil
}
