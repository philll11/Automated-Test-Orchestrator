// automated-test-orchestrator-cli/cmd/test_plans.go
package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/automated-test-orchestrator/cli-go/internal/client"
	"github.com/automated-test-orchestrator/cli-go/internal/display"
	"github.com/automated-test-orchestrator/cli-go/internal/errors"
	"github.com/automated-test-orchestrator/cli-go/internal/style"
	"github.com/briandowns/spinner"
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
		style.Info("Fetching all test plans...")
		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		plans, err := apiClient.GetAllPlans()
		if err != nil {
			style.Error("Failed to list test plans. %v", err)
			os.Exit(1)
		}

		if len(plans) == 0 {
			style.Warning("No test plans found.")
			return
		}

		display.PrintTestPlanSummaries(plans)
		fmt.Println()
		style.Info("To see the full details of a plan, use 'ato test-plans get <Plan ID>'.")
	},
}

// testPlansGetCmd represents the 'test-plans get' command.
var testPlansGetCmd = &cobra.Command{
	Use:   "get <planId>",
	Short: "Get the full details of a specific test plan",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		planID := args[0]
		style.Info("Fetching details for Test Plan ID: %s...", style.ID(planID))

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		plan, err := apiClient.GetPlanStatus(planID)
		if err != nil {
			style.Error("Failed to get test plan. %v", err)
			os.Exit(1)
		}

		display.PrintTestPlanDetails(plan)
	},
}

// testPlansRemoveCmd represents the 'test-plans remove' command.
var testPlansRemoveCmd = &cobra.Command{
	Use:   "rm <planId>",
	Short: "Remove a test plan by its ID",
	Long:  `Removes a test plan and all of its associated data, including components and execution results.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		planID := args[0]
		s := spinner.New(spinner.CharSets[11], 100*time.Millisecond)
		s.Suffix = fmt.Sprintf(" Deleting test plan %s...", planID)
		s.Start()

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		if err := apiClient.DeleteTestPlan(planID); err != nil {
			errors.HandleCLIError(s, err)
		}

		s.Stop()
		style.Success("Test plan \"%s\" was successfully removed.", planID)
	},
}

func init() {
	rootCmd.AddCommand(testPlansCmd)
	testPlansCmd.AddCommand(testPlansListCmd)
	testPlansCmd.AddCommand(testPlansGetCmd)
	testPlansCmd.AddCommand(testPlansRemoveCmd)

	testPlansCmd.Flags().SortFlags = false
}
