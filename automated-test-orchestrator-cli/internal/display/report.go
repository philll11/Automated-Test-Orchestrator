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
			if result.Log != nil && *result.Log != "" {
				indentedLog := "  > " + strings.ReplaceAll(*result.Log, "\n", "\n  > ")
				fmt.Println(color.HiBlackString(indentedLog))
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
