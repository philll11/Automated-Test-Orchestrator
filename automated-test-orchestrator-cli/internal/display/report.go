// automated-test-orchestrator-cli/internal/display/report.go
package display

import (
	"fmt"
	"strings"

	"github.com/automated-test-orchestrator/cli-go/internal/model"
	"github.com/automated-test-orchestrator/cli-go/internal/style"
	"github.com/fatih/color"
)

// PrintExecutionReport renders a Jest-like summary of test execution results.
func PrintExecutionReport(plan *model.CliTestPlan) {
	// Convert CliTestPlan to []CliEnrichedTestExecutionResult to reuse the rendering logic
	var results []model.CliEnrichedTestExecutionResult

	for _, comp := range plan.PlanComponents {
		for _, res := range comp.ExecutionResults {
			enriched := model.CliEnrichedTestExecutionResult{
				ID:                res.ID,
				TestPlanID:        plan.ID,
				TestPlanName:      &plan.Name,
				PlanComponentID:   comp.ComponentID,
				ComponentName:     comp.ComponentName,
				TestComponentID:   res.TestComponentID,
				TestComponentName: res.TestComponentName,
				Status:            res.Status,
				Message:           res.Message,
				TestCases:         res.TestCases,
			}
			results = append(results, enriched)
		}
	}

	if len(results) == 0 {
		style.Warning("No tests were executed.")
		return
	}

	renderReport(results, "")
}

// PrintVerboseResults renders detailed information for query results.
func PrintVerboseResults(results []model.CliEnrichedTestExecutionResult, statusFilter string) {
	if len(results) == 0 {
		style.Warning("No results found.")
		return
	}
	renderReport(results, statusFilter)
}

// renderReport contains the unified logic for rendering the execution tree.
func renderReport(results []model.CliEnrichedTestExecutionResult, statusFilter string) {
	fmt.Fprintln(color.Output) // Spacing

	// --- Data Structures for Grouping ---
	type CompNode struct {
		Name    string
		Results []model.CliEnrichedTestExecutionResult
	}
	type PlanNode struct {
		Name       string
		Components map[string]*CompNode
		CompOrder  []string
	}

	// Grouping Logic: PlanID -> ComponentID -> Results
	tree := make(map[string]*PlanNode)
	var planOrder []string

	var (
		globalTestsTotal, globalTestsPassed, globalTestsFailed int
		globalCasesTotal, globalCasesPassed, globalCasesFailed int
	)

	// 1. Build the Tree & Calculate Metrics
	for _, r := range results {
		// Metrics Calculation
		globalTestsTotal++
		suiteIsFailure := false

		if len(r.TestCases) > 0 {
			for _, tc := range r.TestCases {
				globalCasesTotal++
				if tc.Status == "FAILED" {
					globalCasesFailed++
					suiteIsFailure = true
				} else {
					globalCasesPassed++
				}
			}
		} else {
			globalCasesTotal++
			if r.Status == "FAILURE" {
				globalCasesFailed++
				suiteIsFailure = true
			} else {
				globalCasesPassed++
			}
		}

		if suiteIsFailure {
			globalTestsFailed++
		} else {
			globalTestsPassed++
		}

		// Grouping Construction
		planKey := r.TestPlanID
		if _, exists := tree[planKey]; !exists {
			tree[planKey] = &PlanNode{
				Name:       r.TestPlanID,
				Components: make(map[string]*CompNode),
				CompOrder:  []string{},
			}
			if r.TestPlanName != nil && *r.TestPlanName != "" {
				tree[planKey].Name = *r.TestPlanName
			}
			planOrder = append(planOrder, planKey)
		}

		compKey := r.PlanComponentID
		if _, exists := tree[planKey].Components[compKey]; !exists {
			compName := r.PlanComponentID
			if r.ComponentName != nil && *r.ComponentName != "" {
				compName = *r.ComponentName
			}

			tree[planKey].Components[compKey] = &CompNode{
				Name:    compName,
				Results: []model.CliEnrichedTestExecutionResult{},
			}
			tree[planKey].CompOrder = append(tree[planKey].CompOrder, compKey)
		}

		tree[planKey].Components[compKey].Results = append(tree[planKey].Components[compKey].Results, r)
	}

	// 2. Render The Tree
	for _, pKey := range planOrder {
		pNode := tree[pKey]

		// Determine Plan Status Badge
		planHasFailure := false
		for _, cKey := range pNode.CompOrder {
			for _, r := range pNode.Components[cKey].Results {
				if r.Status == "FAILURE" {
					planHasFailure = true
					break
				}
				for _, tc := range r.TestCases {
					if tc.Status == "FAILED" {
						planHasFailure = true
						break
					}
				}
			}
			if planHasFailure {
				break
			}
		}

		if planHasFailure {
			fmt.Fprint(color.Output, style.BadgeFail(" FAIL "))
		} else {
			fmt.Fprint(color.Output, style.BadgePass(" PASS "))
		}
		fmt.Fprintf(color.Output, " %s\n\n", style.Header(pNode.Name))

		for _, cKey := range pNode.CompOrder {
			cNode := pNode.Components[cKey]

			fmt.Fprintf(color.Output, "%s %s\n", style.IconBox, style.Cyan(cNode.Name))

			for _, result := range cNode.Results {
				testName := result.TestComponentID
				if result.TestComponentName != nil && *result.TestComponentName != "" {
					testName = *result.TestComponentName
				}

				fmt.Fprintf(color.Output, "  %s\n", style.White(testName))

				// === GRANULAR CASES ===
				if len(result.TestCases) > 0 {
					for _, tc := range result.TestCases {

						// FILTER LOGIC:
						// If user specifically asked for FAILURES, hide the PASSED cases to reduce noise.
						if statusFilter == "FAILURE" && tc.Status == "PASSED" {
							continue
						}

						label := ""
						idExists := tc.TestCaseID != nil && *tc.TestCaseID != ""
						descExists := tc.TestDescription != ""
						if idExists && descExists {
							label = fmt.Sprintf("%s: %s", *tc.TestCaseID, tc.TestDescription)
						} else if idExists {
							label = *tc.TestCaseID
						} else {
							label = tc.TestDescription
						}

						if tc.Status == "PASSED" {
							fmt.Fprintf(color.Output, "    %s %s\n", style.IconCheck, style.Faint(label))
						} else {
							fmt.Fprintf(color.Output, "    %s %s\n", style.IconCross, style.Red(label))
							if tc.Details != nil && *tc.Details != "" {
								indented := "      " + strings.ReplaceAll(strings.TrimSpace(*tc.Details), "\n", "\n      ")
								fmt.Fprintln(color.Output, style.Faint(indented))
							}
						}
					}
				} else {
					// === LEGACY ===
					if result.Status == "SUCCESS" {
						// Only show success if we aren't strictly filtering for failures
						if statusFilter != "FAILURE" {
							fmt.Fprintf(color.Output, "    %s %s\n", style.IconCheck, style.Faint("Test completed successfully"))
						}
					} else {
						fmt.Fprintf(color.Output, "    %s %s\n", style.IconCross, style.Red("Test Failed"))
						if result.Message != nil && *result.Message != "" {
							indented := "      " + strings.ReplaceAll(strings.TrimSpace(*result.Message), "\n", "\n      ")
							fmt.Fprintln(color.Output, style.Faint(indented))
						}
					}
				}
			}
			fmt.Fprintln(color.Output)
		}
	}

	printSummaryFooter(globalTestsTotal, globalTestsPassed, globalTestsFailed, globalCasesTotal, globalCasesPassed, globalCasesFailed)
}

// Helper to print the summary footer cleanly
func printSummaryFooter(sTotal, sPass, sFail, cTotal, cPass, cFail int) {
	fmt.Fprintln(color.Output, "--- Summary ---")

	// Tests Line
	fmt.Fprint(color.Output, "Tests: ")
	if sFail > 0 {
		fmt.Fprintf(color.Output, "%s, ", style.Red(fmt.Sprintf("%d failed", sFail)))
	}
	if sPass > 0 {
		fmt.Fprintf(color.Output, "%s, ", style.Green(fmt.Sprintf("%d passed", sPass)))
	}
	fmt.Fprintf(color.Output, "%d total\n", sTotal)

	// Cases Line
	fmt.Fprint(color.Output, "Test Cases:  ")
	if cFail > 0 {
		fmt.Fprintf(color.Output, "%s, ", style.Red(fmt.Sprintf("%d failed", cFail)))
	}
	if cPass > 0 {
		fmt.Fprintf(color.Output, "%s, ", style.Green(fmt.Sprintf("%d passed", cPass)))
	}
	fmt.Fprintf(color.Output, "%d total\n", cTotal)
}
