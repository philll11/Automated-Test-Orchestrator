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
	fmt.Println() // Blank line for spacing

	// --- Metrics Trackers ---
	var (
		testsTotal  int
		testsPassed int
		testsFailed int

		casesTotal  int
		casesPassed int
		casesFailed int
	)

	// --- PRE-CALCULATE METRICS (Global) ---
	for _, component := range plan.PlanComponents {
		if len(component.ExecutionResults) == 0 {
			continue
		}
		for _, result := range component.ExecutionResults {
			testsTotal++
			suiteIsFailure := false

			if len(result.TestCases) > 0 {
				// Granular Mode
				for _, tc := range result.TestCases {
					casesTotal++
					if tc.Status == "FAILED" {
						casesFailed++
						suiteIsFailure = true
					} else {
						casesPassed++
					}
				}
			} else {
				// Legacy Mode
				casesTotal++
				if result.Status == "FAILURE" {
					casesFailed++
					suiteIsFailure = true
				} else {
					casesPassed++
				}
			}

			if suiteIsFailure {
				testsFailed++
			} else {
				testsPassed++
			}
		}
	}

	if casesTotal == 0 {
		color.Yellow("No tests were executed.")
		return
	}

	// --- PRINT GLOBAL HEADLINE (The Test Plan) ---
	if casesFailed > 0 {
		color.New(color.BgRed, color.FgWhite, color.Bold).Printf(" FAIL ")
	} else {
		color.New(color.BgGreen, color.FgBlack, color.Bold).Printf(" PASS ")
	}
	// Print Test Plan Name
	fmt.Printf(" %s\n\n", color.New(color.FgWhite, color.Bold).Sprint(plan.Name))

	// --- RENDER GROUPS (Components) ---
	for _, component := range plan.PlanComponents {
		if len(component.ExecutionResults) == 0 {
			continue
		}

		// SUBHEADING: The Component
		componentName := component.ComponentID
		if component.ComponentName != nil && *component.ComponentName != "" {
			componentName = *component.ComponentName
		}

		// Printing: "📦 Component Name"
		fmt.Printf("%s %s\n", "📦", color.New(color.FgHiCyan, color.Bold).Sprint(componentName))

		// LOOP RESULTS
		for _, result := range component.ExecutionResults {
			testName := result.TestComponentID
			if result.TestComponentName != nil && *result.TestComponentName != "" {
				testName = *result.TestComponentName
			}

			// Print Test Component Name
			fmt.Printf("  %s\n", color.New(color.FgHiWhite).Sprint(testName))

			// === BRANCH A: GRANULAR TEST CASES ===
			if len(result.TestCases) > 0 {
				for _, tc := range result.TestCases {

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
						fmt.Printf("    %s %s\n", "✅", color.New(color.FgHiBlack).Sprint(label))
					} else {
						fmt.Printf("    %s %s\n", "❌", color.New(color.FgRed).Sprint(label))
						if tc.Details != nil && *tc.Details != "" {
							cleanDetails := strings.TrimSpace(*tc.Details)
							indented := "      " + strings.ReplaceAll(cleanDetails, "\n", "\n      ")
							fmt.Println(color.New(color.FgHiBlack).Sprint(indented))
						}
					}
				}

				// === BRANCH B: LEGACY / SYSTEM ===
			} else {
				if result.Status == "SUCCESS" {
					fmt.Printf("    %s %s\n", "✅", color.New(color.FgHiBlack).Sprint("Test completed successfully"))
				} else {
					fmt.Printf("    %s %s\n", "❌", color.New(color.FgRed).Sprint("Test Failed"))
					if result.Message != nil && *result.Message != "" {
						cleanMessage := strings.TrimSpace(*result.Message)
						indented := "      " + strings.ReplaceAll(cleanMessage, "\n", "\n      ")
						fmt.Println(color.New(color.FgHiBlack).Sprint(indented))
					}
				}
			}
		}
		fmt.Println() // Spacing between components
	}
	printSummaryFooter(testsTotal, testsPassed, testsFailed, casesTotal, casesPassed, casesFailed)
}

// PrintVerboseResults renders detailed information for query results.
func PrintVerboseResults(results []model.CliEnrichedTestExecutionResult, statusFilter string) {
	if len(results) == 0 {
		color.Yellow("No results found.")
		return
	}

	fmt.Println() // Spacing

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
			color.New(color.BgRed, color.FgWhite, color.Bold).Printf(" FAIL ")
		} else {
			color.New(color.BgGreen, color.FgBlack, color.Bold).Printf(" PASS ")
		}
		fmt.Printf(" %s\n\n", color.New(color.FgWhite, color.Bold).Sprint(pNode.Name))

		for _, cKey := range pNode.CompOrder {
			cNode := pNode.Components[cKey]

			fmt.Printf("%s %s\n", "📦", color.New(color.FgHiCyan, color.Bold).Sprint(cNode.Name))

			for _, result := range cNode.Results {
				testName := result.TestComponentID
				if result.TestComponentName != nil && *result.TestComponentName != "" {
					testName = *result.TestComponentName
				}

				fmt.Printf("  %s\n", color.New(color.FgHiWhite).Sprint(testName))

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
							fmt.Printf("    %s %s\n", "✅", color.New(color.FgHiBlack).Sprint(label))
						} else {
							fmt.Printf("    %s %s\n", "❌", color.New(color.FgRed).Sprint(label))
							if tc.Details != nil && *tc.Details != "" {
								indented := "      " + strings.ReplaceAll(strings.TrimSpace(*tc.Details), "\n", "\n      ")
								fmt.Println(color.New(color.FgHiBlack).Sprint(indented))
							}
						}
					}
				} else {
					// === LEGACY ===
					if result.Status == "SUCCESS" {
						// Only show success if we aren't strictly filtering for failures
						if statusFilter != "FAILURE" {
							fmt.Printf("    %s %s\n", "✅", color.New(color.FgHiBlack).Sprint("Test completed successfully"))
						}
					} else {
						fmt.Printf("    %s %s\n", "❌", color.New(color.FgRed).Sprint("Test Failed"))
						if result.Message != nil && *result.Message != "" {
							indented := "      " + strings.ReplaceAll(strings.TrimSpace(*result.Message), "\n", "\n      ")
							fmt.Println(color.New(color.FgHiBlack).Sprint(indented))
						}
					}
				}
			}
			fmt.Println()
		}
	}

	printSummaryFooter(globalTestsTotal, globalTestsPassed, globalTestsFailed, globalCasesTotal, globalCasesPassed, globalCasesFailed)
}

// Helper to print the summary footer cleanly
func printSummaryFooter(sTotal, sPass, sFail, cTotal, cPass, cFail int) {
	fmt.Println("--- Summary ---")

	// Tests Line
	fmt.Printf("Tests: ")
	if sFail > 0 {
		color.New(color.FgRed, color.Bold).Printf("%d failed", sFail)
		fmt.Printf(", ")
	}
	if sPass > 0 {
		color.New(color.FgGreen, color.Bold).Printf("%d passed", sPass)
		fmt.Printf(", ")
	}
	fmt.Printf("%d total\n", sTotal)

	// Cases Line
	fmt.Printf("Test Cases:  ")
	if cFail > 0 {
		color.New(color.FgRed, color.Bold).Printf("%d failed", cFail)
		fmt.Printf(", ")
	}
	if cPass > 0 {
		color.New(color.FgGreen, color.Bold).Printf("%d passed", cPass)
		fmt.Printf(", ")
	}
	fmt.Printf("%d total\n", cTotal)
}
