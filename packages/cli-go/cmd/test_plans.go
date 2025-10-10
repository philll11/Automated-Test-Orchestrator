// cli-go/cmd/test_plans.go
package cmd

import (
	"fmt"
	"os"

	"github.com/automated-test-orchestrator/cli-go/internal/client"
	"github.com/automated-test-orchestrator/cli-go/internal/display"
	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// testPlansCmd represents the test-plans command group.
var testPlansCmd = &cobra.Command{
	Use:     "test-plans",
	Aliases: []string{"tp"},
	Short:   "Manage and view test plans",
}

// testPlansListCmd represents the 'test-plans list' command.
var testPlansListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all test plans",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Fetching all test plans...")
		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		plans, err := apiClient.GetAllPlans()
		if err != nil {
			color.Red("Error: Failed to list test plans. %v", err)
			os.Exit(1)
		}

		if len(plans) == 0 {
			color.Yellow("No test plans found.")
			return
		}

		display.PrintTestPlanSummaries(plans)
		fmt.Println("\nTo see the full details of a plan, use 'ato test-plans get <Plan ID>'.")
	},
}

// testPlansGetCmd represents the 'test-plans get' command.
var testPlansGetCmd = &cobra.Command{
	Use:   "get <planId>",
	Short: "Get the full details of a specific test plan",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		planID := args[0]
		fmt.Printf("Fetching details for Test Plan ID: %s...\n", color.CyanString(planID))

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		plan, err := apiClient.GetPlanStatus(planID)
		if err != nil {
			color.Red("Error: Failed to get test plan. %v", err)
			os.Exit(1)
		}

		display.PrintTestPlanDetails(plan)
	},
}

func init() {
	rootCmd.AddCommand(testPlansCmd)
	testPlansCmd.AddCommand(testPlansListCmd)
	testPlansCmd.AddCommand(testPlansGetCmd)
}
