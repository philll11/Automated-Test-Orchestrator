// cli-go/internal/csv/parser.go
package csv

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
)

// ParseMappingCsv reads and parses CSV content for bulk-importing mappings.
// It requires 'mainComponentId' and 'testComponentId' headers and supports
// optional 'testComponentName', 'isDeployed', and 'isPackage' columns.
func ParseMappingCsv(reader io.Reader) ([]model.CreateMappingRequest, error) {
	r := csv.NewReader(reader)
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV data: %w", err)
	}

	if len(records) < 2 { // Must have a header and at least one data row
		return []model.CreateMappingRequest{}, nil
	}

	header := records[0]
	headerMap := make(map[string]int)
	for i, h := range header {
		headerMap[strings.TrimSpace(h)] = i
	}

	// Validate required headers
	requiredHeaders := []string{"mainComponentId", "testComponentId"}
	for _, reqHeader := range requiredHeaders {
		if _, ok := headerMap[reqHeader]; !ok {
			return nil, fmt.Errorf("CSV file is missing required header: %s", reqHeader)
		}
	}

	var mappings []model.CreateMappingRequest
	for i, row := range records[1:] {
		mainID := row[headerMap["mainComponentId"]]
		testID := row[headerMap["testComponentId"]]

		if strings.TrimSpace(mainID) == "" || strings.TrimSpace(testID) == "" {
			fmt.Printf("Skipping row %d: missing required ID\n", i+2)
			continue
		}

		mapping := model.CreateMappingRequest{
			MainComponentID: mainID,
			TestComponentID: testID,
		}

		// Handle optional fields
		if idx, ok := headerMap["mainComponentName"]; ok && idx < len(row) {
			name := row[idx]
			if name != "" {
				mapping.MainComponentName = &name
			}
		}

		if idx, ok := headerMap["testComponentName"]; ok && idx < len(row) {
			name := row[idx]
			if name != "" {
				mapping.TestComponentName = &name
			}
		}

		if idx, ok := headerMap["isDeployed"]; ok && idx < len(row) {
			val, err := strconv.ParseBool(strings.ToLower(row[idx]))
			if err == nil {
				mapping.IsDeployed = &val
			}
		}

		if idx, ok := headerMap["isPackage"]; ok && idx < len(row) {
			val, err := strconv.ParseBool(strings.ToLower(row[idx]))
			if err == nil {
				mapping.IsPackaged = &val
			}
		}

		mappings = append(mappings, mapping)
	}

	return mappings, nil
}

// ParseComponentIdCsv reads a single-column CSV of component IDs.
// It assumes the header is 'componentId'.
func ParseComponentIdCsv(reader io.Reader) ([]string, error) {
	r := csv.NewReader(reader)
	records, err := r.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("failed to read CSV data: %w", err)
	}

	if len(records) < 2 { // Must have a header and at least one data row
		return []string{}, nil
	}

	header := records[0]
	if len(header) == 0 || strings.TrimSpace(header[0]) != "componentId" {
		return nil, fmt.Errorf("CSV file is missing required header: componentId")
	}

	var componentIds []string
	for _, row := range records[1:] {
		if len(row) > 0 {
			id := strings.TrimSpace(row[0])
			if id != "" {
				componentIds = append(componentIds, id)
			}
		}
	}

	return componentIds, nil
}
