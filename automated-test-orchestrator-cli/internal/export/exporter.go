// automated-test-orchestrator-cli/internal/export/exporter.go
// automated-test-orchestrator-cli/internal/export/exporter.go
package export

import (
	"fmt"
	"strings"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
)

// Exporter defines the interface for exporting test execution results.
type Exporter interface {
	Export(results []model.CliEnrichedTestExecutionResult, filePath string) error
}

// NewExporter creates a new Exporter based on the specified format.
// Supported formats: "json", "csv", "xml".
func NewExporter(format string) (Exporter, error) {
	switch strings.ToLower(format) {
	case "json":
		return &JSONExporter{}, nil
	case "csv":
		return &CSVExporter{}, nil
	case "xml":
		return &XMLExporter{}, nil
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}
