// cli-go/internal/display/table.go
package display

import (
	"fmt"
	"os"
	"strings"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
)

// PrintCredentialProfiles renders a list of credential profiles in a table.
func PrintCredentialProfiles(profiles []model.CliCredentialProfile) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Profile Name", "Account ID", "Username", "Execution Instance"})
	table.SetBorder(true)
	table.SetRowLine(true)

	for _, p := range profiles {
		row := []string{
			p.ProfileName,
			p.Credentials.AccountID,
			p.Credentials.Username,
			p.Credentials.ExecutionInstanceID,
		}
		table.Append(row)
	}

	table.Render()
}

// PrintMappings renders a list of mappings in a table.
func PrintMappings(mappings []model.CliMapping) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Mapping ID", "Main Component ID", "Main Component Name", "Test Component ID", "Test Component Name"})
	table.SetBorder(true)
	table.SetRowLine(true)

	for _, m := range mappings {
		mainName := "N/A"
		if m.MainComponentName != nil {
			mainName = *m.MainComponentName
		}
		testName := "N/A"
		if m.TestComponentName != nil {
			testName = *m.TestComponentName
		}
		row := []string{
			m.ID,
			m.MainComponentID,
			mainName,
			m.TestComponentID,
			testName,
		}
		table.Append(row)
	}

	table.Render()
}

// PrintTestPlanSummaries renders a list of test plan summaries in a table.
func PrintTestPlanSummaries(plans []model.CliTestPlanSummary) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Plan ID", "Name", "Status", "Created At"})
	table.SetBorder(true)

	for _, p := range plans {
		row := []string{
			p.ID,
			p.Name,
			p.Status,
			p.CreatedAt.Local().Format("2006-01-02 15:04:05"), // Format time for readability
		}
		table.Append(row)
	}

	table.Render()
}

// PrintTestPlanDetails renders the full details of a single test plan across multiple tables.
func PrintTestPlanDetails(plan *model.CliTestPlan) {
	// --- Plan Summary Table ---
	fmt.Println("\n--- Plan Summary ---")
	summaryTable := tablewriter.NewWriter(os.Stdout)
	summaryTable.SetHeader([]string{"ID", "Name", "Status", "Created At"})
	summaryTable.Append([]string{
		plan.ID,
		plan.Name,
		plan.Status,
		plan.CreatedAt.Local().Format("2006-01-02 15:04:05"),
	})
	summaryTable.Render()

	// --- Failure Reason (if present) ---
	if strings.HasSuffix(plan.Status, "_FAILED") && plan.FailureReason != nil {
		color.New(color.FgRed).Printf("\nFailure Reason: ")
		fmt.Println(*plan.FailureReason)
	}

	// --- Plan Components Table ---
	if len(plan.PlanComponents) > 0 {
		fmt.Println("\n--- Plan Components & Test Coverage ---")
		componentsTable := tablewriter.NewWriter(os.Stdout)
		componentsTable.SetHeader([]string{"Component ID", "Component Name", "Available Test Name", "Available Test ID"})
		componentsTable.SetRowLine(true)

		for _, c := range plan.PlanComponents {
			componentName := "N/A"
			if c.ComponentName != nil {
				componentName = *c.ComponentName
			}

			var testNamesBuilder, testIDsBuilder strings.Builder
			if len(c.AvailableTests) == 0 {
				testNamesBuilder.WriteString("None")
				testIDsBuilder.WriteString("N/A")
			} else {
				for i, test := range c.AvailableTests {
					testName := "N/A"
					if test.Name != nil && *test.Name != "" {
						testName = *test.Name
					}
					testNamesBuilder.WriteString(testName)
					testIDsBuilder.WriteString(test.ID)

					if i < len(c.AvailableTests)-1 {
						testNamesBuilder.WriteString("\n")
						testIDsBuilder.WriteString("\n")
					}
				}
			}
			componentsTable.Append([]string{c.ComponentID, componentName, testNamesBuilder.String(), testIDsBuilder.String()})
		}
		componentsTable.Render()
	} else {
		fmt.Println("\nNo components are associated with this plan.")
	}

	// --- Execution Results Table ---
	var allResults []model.CliTestExecutionResult
	for _, pc := range plan.PlanComponents {
		allResults = append(allResults, pc.ExecutionResults...)
	}

	if len(allResults) > 0 {
		fmt.Println("\n--- Test Execution Results ---")
		resultsTable := tablewriter.NewWriter(os.Stdout)
		resultsTable.SetHeader([]string{"Component Name", "Test Name", "Test ID", "Status", "Has Message"})

		// Create a map to get component names easily
		componentMap := make(map[string]string)
		for _, pc := range plan.PlanComponents {
			for _, res := range pc.ExecutionResults {
				if _, ok := componentMap[res.ID]; !ok {
					if pc.ComponentName != nil {
						componentMap[res.ID] = *pc.ComponentName
					} else {
						componentMap[res.ID] = "N/A"
					}
				}
			}
		}

		for _, res := range allResults {
			testName := "N/A"
			if res.TestComponentName != nil {
				testName = *res.TestComponentName
			}
			status := color.RedString("FAILURE")
			if res.Status == "SUCCESS" {
				status = color.GreenString("SUCCESS")
			}
			hasMessage := "No"
			if res.Message != nil && *res.Message != "" {
				hasMessage = "Yes"
			}

			resultsTable.Append([]string{componentMap[res.ID], testName, res.TestComponentID, status, hasMessage})
		}
		resultsTable.Render()
	} else {
		fmt.Println("\nNo tests have been executed for this plan yet.")
	}
}

// PrintDiscoveryResult renders a detailed table of discovered components and their test coverage.
func PrintDiscoveryResult(plan *model.CliTestPlan) {
	if len(plan.PlanComponents) == 0 {
		color.Yellow("No components were found for this test plan.")
		return
	}

	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Component ID", "Component Name", "Has Test Coverage", "Available Test Name", "Available Test ID"})
	table.SetRowLine(true)

	for _, comp := range plan.PlanComponents {
		componentName := "N/A"
		if comp.ComponentName != nil {
			componentName = *comp.ComponentName
		}

		var coverageStatus string
		var testNamesBuilder, testIDsBuilder strings.Builder

		if len(comp.AvailableTests) == 0 {
			coverageStatus = color.RedString("❌ No")
			testNamesBuilder.WriteString("N/A")
			testIDsBuilder.WriteString("N/A")
		} else {
			coverageStatus = color.GreenString("✅ Yes")
			for i, test := range comp.AvailableTests {
				testName := "N/A"
				if test.Name != nil && *test.Name != "" {
					testName = *test.Name
				}
				testNamesBuilder.WriteString(testName)
				testIDsBuilder.WriteString(test.ID)
				if i < len(comp.AvailableTests)-1 {
					testNamesBuilder.WriteString("\n")
					testIDsBuilder.WriteString("\n")
				}
			}
		}

		table.Append([]string{
			comp.ComponentID,
			componentName,
			coverageStatus,
			testNamesBuilder.String(),
			testIDsBuilder.String(),
		})
	}
	table.Render()
}

// PrintExecutionResults renders a list of enriched test execution results in a table.
func PrintExecutionResults(results []model.CliEnrichedTestExecutionResult) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Test Plan", "Component Name", "Test Name", "Status", "Executed At", "Message"})
	table.SetBorder(true)
	table.SetRowLine(true)

	for _, r := range results {
		componentName := "N/A"
		if r.ComponentName != nil {
			componentName = *r.ComponentName
		}
		testName := r.TestComponentID
		if r.TestComponentName != nil {
			testName = *r.TestComponentName
		}

		// Format the Test Plan column
		testPlanDisplay := r.TestPlanID
		if r.TestPlanName != nil && *r.TestPlanName != "" {
			testPlanDisplay = fmt.Sprintf("%s\n(%s)", *r.TestPlanName, r.TestPlanID)
		}

		status := color.RedString("FAILURE")
		if r.Status == "SUCCESS" {
			status = color.GreenString("SUCCESS")
		}

		hasMessage := "No"
		if r.Message != nil && *r.Message != "" {
			hasMessage = "Yes"
		}

		row := []string{
			testPlanDisplay,
			componentName,
			testName,
			status,
			r.ExecutedAt.Local().Format("2006-01-02 15:04:05"),
			hasMessage,
		}
		table.Append(row)
	}

	table.Render()
}
