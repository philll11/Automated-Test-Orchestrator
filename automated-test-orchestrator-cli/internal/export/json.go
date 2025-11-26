// automated-test-orchestrator-cli/internal/export/json.go
package export

import (
	"encoding/json"
	"os"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
)

// JSONExporter implements the Exporter interface for JSON format.
type JSONExporter struct{}

// Export writes the results to a JSON file.
func (e *JSONExporter) Export(results []model.CliEnrichedTestExecutionResult, filePath string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(results)
}
