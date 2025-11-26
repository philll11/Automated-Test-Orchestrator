// automated-test-orchestrator-cli/internal/export/csv.go
package export

import (
	"encoding/csv"
	"os"
	"time"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
)

// CSVExporter implements the Exporter interface for CSV format.
type CSVExporter struct{}

// Export writes the results to a CSV file.
func (e *CSVExporter) Export(results []model.CliEnrichedTestExecutionResult, filePath string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write Header
	header := []string{
		"Plan ID",
		"Component",
		"Test Suite",
		"Case ID",
		"Description",
		"Status",
		"Details",
		"Time",
	}
	if err := writer.Write(header); err != nil {
		return err
	}

	for _, result := range results {
		planID := result.TestPlanID
		component := safeString(result.ComponentName)
		testSuite := safeString(result.TestComponentName)
		executedAt := result.ExecutedAt.Format(time.RFC3339)

		if len(result.TestCases) == 0 {
			// Write a single row for the suite if there are no granular test cases
			row := []string{
				planID,
				component,
				testSuite,
				"", // Case ID
				"", // Description
				result.Status,
				safeString(result.Message),
				executedAt,
			}
			if err := writer.Write(row); err != nil {
				return err
			}
		} else {
			// Write a row for each test case
			for _, tc := range result.TestCases {
				row := []string{
					planID,
					component,
					testSuite,
					safeString(tc.TestCaseID),
					tc.TestDescription,
					tc.Status,
					safeString(tc.Details),
					executedAt,
				}
				if err := writer.Write(row); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func safeString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
