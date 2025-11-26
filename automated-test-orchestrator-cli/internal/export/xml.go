// automated-test-orchestrator-cli/internal/export/xml.go
// automated-test-orchestrator-cli/internal/export/xml.go
package export

import (
	"encoding/xml"
	"os"
	"time"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
)

// XMLExporter implements the Exporter interface for JUnit XML format.
type XMLExporter struct{}

type JUnitTestSuites struct {
	XMLName xml.Name         `xml:"testsuites"`
	Suites  []JUnitTestSuite `xml:"testsuite"`
}

type JUnitTestSuite struct {
	Name      string          `xml:"name,attr"`
	Tests     int             `xml:"tests,attr"`
	Failures  int             `xml:"failures,attr"`
	Timestamp string          `xml:"timestamp,attr"`
	Cases     []JUnitTestCase `xml:"testcase"`
}

type JUnitTestCase struct {
	Name      string        `xml:"name,attr"`
	ClassName string        `xml:"classname,attr"`
	Failure   *JUnitFailure `xml:"failure,omitempty"`
}

type JUnitFailure struct {
	Message string `xml:"message,attr"`
	Type    string `xml:"type,attr"`
	Content string `xml:",chardata"`
}

// Export writes the results to a JUnit XML file.
func (e *XMLExporter) Export(results []model.CliEnrichedTestExecutionResult, filePath string) error {
	suites := JUnitTestSuites{}

	for _, result := range results {
		suite := JUnitTestSuite{
			Name:      safeString(result.TestComponentName),
			Timestamp: result.ExecutedAt.Format(time.RFC3339),
		}

		componentName := safeString(result.ComponentName)

		if len(result.TestCases) == 0 {
			// Handle legacy/system level results without granular cases
			suite.Tests = 1
			testCase := JUnitTestCase{
				Name:      "Process Execution",
				ClassName: componentName,
			}

			if result.Status == "FAILURE" {
				suite.Failures = 1
				msg := safeString(result.Message)
				testCase.Failure = &JUnitFailure{
					Message: "Process Execution Failed",
					Type:    "SystemError",
					Content: msg,
				}
			}
			suite.Cases = append(suite.Cases, testCase)
		} else {
			// Handle granular test cases
			suite.Tests = len(result.TestCases)
			for _, tc := range result.TestCases {
				testCase := JUnitTestCase{
					Name:      tc.TestDescription,
					ClassName: componentName,
				}

				if tc.Status == "FAILED" {
					suite.Failures++
					details := safeString(tc.Details)
					testCase.Failure = &JUnitFailure{
						Message: "Assertion Failed",
						Type:    "AssertionError",
						Content: details,
					}
				}
				suite.Cases = append(suite.Cases, testCase)
			}
		}

		suites.Suites = append(suites.Suites, suite)
	}

	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := xml.NewEncoder(file)
	encoder.Indent("", "  ")
	if err := encoder.Encode(suites); err != nil {
		return err
	}

	return nil
}
