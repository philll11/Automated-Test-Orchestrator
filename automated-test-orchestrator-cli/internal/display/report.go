// cli-go/internal/display/report.go
package display

import (
	"fmt"
	"strings"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
	"github.com/fatih/color"
)

// PrintExecutionReport renders a Jest-like summary of test execution results.
func PrintExecutionReport(plan *model.CliTestPlan) {
	fmt.Println("\n--- Test Execution Report ---")

	var allResults []model.CliTestExecutionResult
	for _, c := range plan.PlanComponents {
		allResults = append(allResults, c.ExecutionResults...)
	}

	if len(allResults) == 0 {
		color.Yellow("No tests were executed. Ensure the test IDs provided are correct.")
		return
	}

	failures := 0
	for _, result := range allResults {
		if result.Status == "SUCCESS" {
			fmt.Printf("%s %s\n", color.GreenString("PASS"), result.TestComponentID)
		} else {
			failures++
			fmt.Printf("%s %s\n", color.RedString("FAIL"), result.TestComponentID)
			if result.Message != nil && *result.Message != "" {
				indentedMessage := "  > " + strings.ReplaceAll(*result.Message, "\n", "\n  > ")
				fmt.Println(color.HiBlackString(indentedMessage))
			}
		}
	}

	fmt.Println("\n--- Summary ---")
	if failures > 0 {
		color.Red("%d test(s) failed.", failures)
	}
	color.Green("%d test(s) passed.", len(allResults)-failures)
	fmt.Printf("Total tests executed: %d\n", len(allResults))
}

// PrintVerboseResults renders a detailed list of failed tests and their messages.
func PrintVerboseResults(results []model.CliEnrichedTestExecutionResult) {
	var failures []model.CliEnrichedTestExecutionResult
	successCount := 0

	for _, r := range results {
		if r.Status == "FAILURE" {
			failures = append(failures, r)
		} else {
			successCount++
		}
	}

	fmt.Println("\n--- FAILED TESTS ---")
	if len(failures) == 0 {
		color.Green("All tests passed. No failures to report.")
	} else {
		for _, f := range failures {
			componentName := "N/A"
			if f.ComponentName != nil {
				componentName = *f.ComponentName
			}

			testName := f.TestComponentID
			if f.TestComponentName != nil {
				testName = *f.TestComponentName
			}

			color.New(color.FgRed).Printf("❌ FAILURE: %s\n", componentName)
			fmt.Printf("  Test: %s (%s)\n", testName, f.TestComponentID)

			if f.Message != nil && *f.Message != "" {
				fmt.Println("  Message:")
				// Indent the message for readability
				indentedMessage := "    " + strings.ReplaceAll(*f.Message, "\n", "\n    ")
				fmt.Println(color.HiBlackString(indentedMessage))
			}
			fmt.Println() // Add a blank line for spacing
		}
	}

	fmt.Println("--- SUMMARY ---")
	if len(failures) > 0 {
		color.Red("%d test(s) failed.", len(failures))
	}
	color.Green("%d test(s) passed.", successCount)
	fmt.Printf("Total results queried: %d\n", len(results))
}
