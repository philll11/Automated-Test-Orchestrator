// cli-go/cmd/results.go
package cmd

import (
	"fmt"
	"os"

	"github.com/automated-test-orchestrator/cli-go/internal/client"
	"github.com/automated-test-orchestrator/cli-go/internal/display"
	"github.com/automated-test-orchestrator/cli-go/internal/model"
	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// resultsCmd represents the results command.
var resultsCmd = &cobra.Command{
	Use:   "results",
	Short: "Query for test execution results with optional filters",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Fetching test execution results...")

		// Collect filter values from flags
		filters := model.GetResultsFilters{
			TestPlanID:            cmd.Flag("planId").Value.String(),
			DiscoveredComponentID: cmd.Flag("componentId").Value.String(),
			TestComponentID:       cmd.Flag("testId").Value.String(),
			Status:                cmd.Flag("status").Value.String(),
		}
		verbose, _ := cmd.Flags().GetBool("verbose")

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		results, err := apiClient.GetExecutionResults(filters)
		if err != nil {
			color.Red("Error: Failed to fetch results. %v", err)
			os.Exit(1)
		}

		if len(results) == 0 {
			color.Yellow("No test execution results found matching the specified criteria.")
			return
		}

		if verbose {
			display.PrintVerboseResults(results)
		} else {
			display.PrintExecutionResults(results)
		}
	},
}

func init() {
	rootCmd.AddCommand(resultsCmd)

	resultsCmd.Flags().String("planId", "", "Filter results by a specific Test Plan ID")
	resultsCmd.Flags().String("componentId", "", "Filter results by a specific Discovered Component ID")
	resultsCmd.Flags().String("testId", "", "Filter results by a specific Test Component ID")
	resultsCmd.Flags().String("status", "", "Filter results by status (SUCCESS or FAILURE)")
	resultsCmd.Flags().BoolP("verbose", "v", false, "Display a detailed report of failed tests and their error messages")

	resultsCmd.Flags().SortFlags = false
}
