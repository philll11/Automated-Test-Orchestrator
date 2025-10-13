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
	table.SetHeader([]string{"Mapping ID", "Main Component ID", "Test Component ID", "Test Component Name"})
	table.SetBorder(true)
	table.SetRowLine(true)

	for _, m := range mappings {
		name := "N/A"
		if m.TestComponentName != nil {
			name = *m.TestComponentName
		}
		row := []string{
			m.ID,
			m.MainComponentID,
			m.TestComponentID,
			name,
		}
		table.Append(row)
	}

	table.Render()
}

// PrintTestPlanSummaries renders a list of test plan summaries in a table.
func PrintTestPlanSummaries(plans []model.CliTestPlanSummary) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Plan ID", "Status", "Created At"})
	table.SetBorder(true)

	for _, p := range plans {
		row := []string{
			p.ID,
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
	summaryTable.SetHeader([]string{"ID", "Status", "Created At"})
	summaryTable.Append([]string{
		plan.ID,
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
		componentsTable.SetHeader([]string{"Component ID", "Component Name", "Available Tests"})
		componentsTable.SetRowLine(true)

		for _, c := range plan.PlanComponents {
			name := "N/A"
			if c.ComponentName != nil {
				name = *c.ComponentName
			}
			tests := "None"
			if len(c.AvailableTests) > 0 {
				tests = strings.Join(c.AvailableTests, ", ")
			}
			componentsTable.Append([]string{c.ComponentID, name, tests})
		}
		componentsTable.Render()
	} else {
		fmt.Println("\nNo components are associated with this plan.")
	}

	// --- Execution Results Table ---
	var allResults []map[string]string
	for _, pc := range plan.PlanComponents {
		for _, res := range pc.ExecutionResults {
			name := "N/A"
			if pc.ComponentName != nil {
				name = *pc.ComponentName
			}
			status := color.RedString(res.Status)
			if res.Status == "SUCCESS" {
				status = color.GreenString(res.Status)
			}
			hasLog := "No"
			if res.Log != nil && *res.Log != "" {
				hasLog = "Yes"
			}
			allResults = append(allResults, map[string]string{
				"Component Name": name,
				"Test ID":        res.TestComponentID,
				"Status":         status,
				"Has Log":        hasLog,
			})
		}
	}

	if len(allResults) > 0 {
		fmt.Println("\n--- Test Execution Results ---")
		resultsTable := tablewriter.NewWriter(os.Stdout)
		resultsTable.SetHeader([]string{"Component Name", "Test ID", "Status", "Has Log"})
		for _, res := range allResults {
			resultsTable.Append([]string{res["Component Name"], res["Test ID"], res["Status"], res["Has Log"]})
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
	table.SetHeader([]string{"Component ID", "Component Name", "Has Test Coverage", "Available Test ID"})
	table.SetRowLine(true)
	table.SetAutoWrapText(true)

	for _, comp := range plan.PlanComponents {
		name := "N/A"
		if comp.ComponentName != nil {
			name = *comp.ComponentName
		}

		var coverageStatus, testIDs string

		if len(comp.AvailableTests) == 0 {
			coverageStatus = color.RedString("❌ No")
			testIDs = "N/A"
		} else {
			coverageStatus = color.GreenString("✅ Yes")
			// Join all test IDs with a newline character to display them in a single cell.
			testIDs = strings.Join(comp.AvailableTests, "\n")
		}

		// Append one consolidated row per component.
		table.Append([]string{
			comp.ComponentID,
			name,
			coverageStatus,
			testIDs,
		})
	}

	table.Render()

}

// PrintExecutionResults renders a list of enriched test execution results in a table.
func PrintExecutionResults(results []model.CliEnrichedTestExecutionResult) {
	table := tablewriter.NewWriter(os.Stdout)
	table.SetHeader([]string{"Test Plan ID", "Component Name", "Test Name", "Status", "Executed At", "Log"})
	table.SetBorder(true)

	for _, r := range results {
		componentName := "N/A"
		if r.ComponentName != nil {
			componentName = *r.ComponentName
		}
		testName := r.TestComponentID
		if r.TestComponentName != nil {
			testName = *r.TestComponentName
		}
		status := color.RedString("❌ FAILURE")
		if r.Status == "SUCCESS" {
			status = color.GreenString("✅ SUCCESS")
		}
		hasLog := "No"
		if r.Log != nil && *r.Log != "" {
			hasLog = "Yes"
		}

		row := []string{
			r.TestPlanID,
			componentName,
			testName,
			status,
			r.ExecutedAt.Local().Format("2006-01-02 15:04:05"),
			hasLog,
		}
		table.Append(row)
	}

	table.Render()
}
