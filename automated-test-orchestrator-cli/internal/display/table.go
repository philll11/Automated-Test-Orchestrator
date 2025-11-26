// automated-test-orchestrator-cli/internal/display/table.go
package display

import (
	"fmt"
	"strings"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
	"github.com/automated-test-orchestrator/cli-go/internal/style"
)

// PrintCredentialProfiles renders a list of credential profiles in a table.
func PrintCredentialProfiles(profiles []model.CliCredentialProfile) {
	table := style.NewTable([]string{"Profile Name", "Account ID", "Username", "Execution Instance"})

	for _, p := range profiles {
		row := []string{
			style.Cyan(p.ProfileName),
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
	table := style.NewTable([]string{"Mapping ID", "Main Component ID", "Main Component Name", "Test Component ID", "Test Component Name"})

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
			style.ID(m.ID),
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
	table := style.NewTable([]string{"Plan ID", "Name", "Status", "Created At"})

	for _, p := range plans {
		status := p.Status
		if strings.Contains(status, "FAILED") {
			status = style.Red(status)
		} else if strings.Contains(status, "COMPLETED") {
			status = style.Green(status)
		} else {
			status = style.Yellow(status)
		}

		row := []string{
			style.ID(p.ID),
			p.Name,
			status,
			style.Time(p.CreatedAt.Local()),
		}
		table.Append(row)
	}

	table.Render()
}

// PrintTestPlanDetails renders the full details of a single test plan across multiple tables.
func PrintTestPlanDetails(plan *model.CliTestPlan) {
	// --- Plan Summary Table ---
	fmt.Println()
	style.PrintKV("Plan Summary", "")
	summaryTable := style.NewTable([]string{"ID", "Name", "Status", "Created At"})

	status := plan.Status
	if strings.Contains(status, "FAILED") {
		status = style.Red(status)
	} else if strings.Contains(status, "COMPLETED") {
		status = style.Green(status)
	} else {
		status = style.Yellow(status)
	}

	summaryTable.Append([]string{
		style.ID(plan.ID),
		plan.Name,
		status,
		style.Time(plan.CreatedAt.Local()),
	})
	summaryTable.Render()

	// --- Failure Reason (if present) ---
	if strings.HasSuffix(plan.Status, "_FAILED") && plan.FailureReason != nil {
		fmt.Println()
		style.Error("Failure Reason: %s", *plan.FailureReason)
	}

	// --- Plan Components Table ---
	if len(plan.PlanComponents) > 0 {
		fmt.Println()
		style.PrintKV("Plan Components & Test Coverage", "")
		componentsTable := style.NewTable([]string{"Component ID", "Component Name", "Available Test Name", "Available Test ID"})

		for _, c := range plan.PlanComponents {
			componentName := "N/A"
			if c.ComponentName != nil {
				componentName = *c.ComponentName
			}

			var testNamesBuilder, testIDsBuilder strings.Builder
			if len(c.AvailableTests) == 0 {
				testNamesBuilder.WriteString(style.Faint("None"))
				testIDsBuilder.WriteString(style.Faint("N/A"))
			} else {
				for i, test := range c.AvailableTests {
					testName := "N/A"
					if test.Name != nil && *test.Name != "" {
						testName = *test.Name
					}
					testNamesBuilder.WriteString(testName)
					testIDsBuilder.WriteString(style.ID(test.ID))

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
		fmt.Println()
		style.Info("No components are associated with this plan.")
	}

	// --- Execution Results Table ---
	var allResults []model.CliTestExecutionResult
	for _, pc := range plan.PlanComponents {
		allResults = append(allResults, pc.ExecutionResults...)
	}

	if len(allResults) > 0 {
		fmt.Println()
		style.PrintKV("Test Execution Results", "")
		resultsTable := style.NewTable([]string{"Component Name", "Test Name", "Status", "Details"})

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
			} else {
				testName = res.TestComponentID
			}

			// Logic for Granular Status Display
			var statusDisplay string
			if len(res.TestCases) > 0 {
				passCount := 0
				for _, tc := range res.TestCases {
					if tc.Status == "PASSED" {
						passCount++
					}
				}
				total := len(res.TestCases)
				if passCount == total {
					statusDisplay = fmt.Sprintf("%s\n%s",
						style.Green("SUCCESS"),
						style.Green(fmt.Sprintf("(%d/%d)", passCount, total)))
				} else {
					statusDisplay = fmt.Sprintf("%s\n%s",
						style.Red("FAILURE"),
						style.Red(fmt.Sprintf("(%d/%d)", passCount, total)))
				}
			} else {
				// Legacy / System Error
				if res.Status == "SUCCESS" {
					statusDisplay = style.Green("SUCCESS")
				} else {
					statusDisplay = style.Red("FAILURE")
				}
			}

			// Details Column Logic
			hasMessage := "No"
			if res.Message != nil && *res.Message != "" {
				hasMessage = "Msg: Yes"
			}
			if len(res.TestCases) > 0 {
				hasMessage = fmt.Sprintf("Cases: %d", len(res.TestCases))
			}

			resultsTable.Append([]string{componentMap[res.ID], testName, statusDisplay, hasMessage})
		}
		resultsTable.Render()
	} else {
		fmt.Println()
		style.Info("No tests have been executed for this plan yet.")
	}
}

// PrintDiscoveryResult renders a detailed table of discovered components and their test coverage.
func PrintDiscoveryResult(plan *model.CliTestPlan) {
	if len(plan.PlanComponents) == 0 {
		style.Warning("No components were found for this test plan.")
		return
	}

	table := style.NewTable([]string{"Component ID", "Component Name", "Has Test Coverage", "Available Test Name", "Available Test ID"})

	for _, comp := range plan.PlanComponents {
		componentName := "N/A"
		if comp.ComponentName != nil {
			componentName = *comp.ComponentName
		}

		var coverageStatus string
		var testNamesBuilder, testIDsBuilder strings.Builder

		if len(comp.AvailableTests) == 0 {
			coverageStatus = style.Red(style.IconCross + " No")
			testNamesBuilder.WriteString(style.Faint("N/A"))
			testIDsBuilder.WriteString(style.Faint("N/A"))
		} else {
			coverageStatus = style.Green(style.IconCheck + " Yes")
			for i, test := range comp.AvailableTests {
				testName := "N/A"
				if test.Name != nil && *test.Name != "" {
					testName = *test.Name
				}
				testNamesBuilder.WriteString(testName)
				testIDsBuilder.WriteString(style.ID(test.ID))
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
	table := style.NewTable([]string{"Test Plan", "Component Name", "Test Name", "Status", "Executed At", "Details"})

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
		testPlanDisplay := style.ID(r.TestPlanID)
		if r.TestPlanName != nil && *r.TestPlanName != "" {
			testPlanDisplay = fmt.Sprintf("%s\n(%s)", *r.TestPlanName, style.ID(r.TestPlanID))
		}

		// Logic for Granular Status Display
		var statusDisplay string
		if len(r.TestCases) > 0 {
			passCount := 0
			for _, tc := range r.TestCases {
				if tc.Status == "PASSED" {
					passCount++
				}
			}
			total := len(r.TestCases)
			if passCount == total {
				statusDisplay = fmt.Sprintf("%s\n%s",
					style.Green("SUCCESS"),
					style.Green(fmt.Sprintf("(%d/%d)", passCount, total)))
			} else {
				statusDisplay = fmt.Sprintf("%s\n%s",
					style.Red("FAILURE"),
					style.Red(fmt.Sprintf("(%d/%d)", passCount, total)))
			}
		} else {
			if r.Status == "SUCCESS" {
				statusDisplay = style.Green("SUCCESS")
			} else {
				statusDisplay = style.Red("FAILURE")
			}
		}

		hasMessage := "No Msg"
		if r.Message != nil && *r.Message != "" {
			hasMessage = "Msg: Yes"
		}
		if len(r.TestCases) > 0 {
			hasMessage = fmt.Sprintf("Cases: %d", len(r.TestCases))
		}

		row := []string{
			testPlanDisplay,
			componentName,
			testName,
			statusDisplay,
			style.Time(r.ExecutedAt.Local()),
			hasMessage,
		}
		table.Append(row)
	}

	table.Render()
}
