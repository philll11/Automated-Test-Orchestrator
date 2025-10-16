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

	var executedTestCount int
	var totalFailureCount int

	// Iterate through components to group the report by the main component.
	for _, component := range plan.PlanComponents {
		if len(component.ExecutionResults) == 0 {
			continue // Skip components for which no tests were run.
		}

		componentHasFailure := false
		for _, result := range component.ExecutionResults {
			executedTestCount++
			if result.Status == "FAILURE" {
				componentHasFailure = true
				totalFailureCount++
			}
		}

		componentName := component.ComponentID
		if component.ComponentName != nil && *component.ComponentName != "" {
			componentName = *component.ComponentName
		}

		headerColor := color.New(color.FgGreen, color.Bold)
		headerText := "PASS"
		if componentHasFailure {
			headerColor = color.New(color.FgRed, color.Bold)
			headerText = "FAIL"
		}
		headerColor.Printf("\n%s", headerText)
		fmt.Printf(" %s\n", componentName)

		// Print the individual test results for this component.
		for _, result := range component.ExecutionResults {
			testName := result.TestComponentID // Fallback to ID
			if result.TestComponentName != nil && *result.TestComponentName != "" {
				testName = *result.TestComponentName
			}

			if result.Status == "SUCCESS" {
				fmt.Printf("  %s %s\n", color.GreenString("✅ PASS"), color.HiBlackString(testName))
			} else {
				fmt.Printf("  %s %s\n", color.RedString("❌ FAIL"), testName)
				if result.Message != nil && *result.Message != "" {
					// Indent the error message for readability
					indentedMessage := "    " + strings.ReplaceAll(*result.Message, "\n", "\n    ")
					fmt.Println(color.RedString(indentedMessage))
				}
			}
		}
	}

	if executedTestCount == 0 {
		color.Yellow("No tests were executed. Ensure the test IDs provided are correct or that mappings exist.")
		return
	}

	// Print the final summary of all tests executed.
	fmt.Println("\n--- Summary ---")
	successCount := executedTestCount - totalFailureCount
	if totalFailureCount > 0 {
		color.Red("%d test(s) failed.", totalFailureCount)
	}
	if successCount > 0 {
		color.Green("%d test(s) passed.", successCount)
	}
	fmt.Printf("Total tests executed: %d\n", executedTestCount)
}

// (PrintVerboseResults remains unchanged)
// ...
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
