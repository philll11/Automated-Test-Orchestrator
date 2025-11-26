// automated-test-orchestrator-cli/cmd/results.go
package cmd

import (
	"os"
	"path/filepath"

	"github.com/automated-test-orchestrator/cli-go/internal/client"
	"github.com/automated-test-orchestrator/cli-go/internal/display"
	"github.com/automated-test-orchestrator/cli-go/internal/export"
	"github.com/automated-test-orchestrator/cli-go/internal/model"
	"github.com/automated-test-orchestrator/cli-go/internal/style"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// resultsCmd represents the results command.
var resultsCmd = &cobra.Command{
	Use:   "results",
	Short: "Query for test execution results with optional filters",
	Run: func(cmd *cobra.Command, args []string) {
		style.Info("Fetching test execution results...")

		// Collect filter values from flags
		filters := model.GetResultsFilters{
			TestPlanID:      cmd.Flag("planId").Value.String(),
			ComponentID:     cmd.Flag("componentId").Value.String(),
			TestComponentID: cmd.Flag("testId").Value.String(),
			Status:          cmd.Flag("status").Value.String(),
		}
		verbose, _ := cmd.Flags().GetBool("verbose")

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		results, err := apiClient.GetExecutionResults(filters)
		if err != nil {
			style.Error("Failed to fetch results. %v", err)
			os.Exit(1)
		}

		if len(results) == 0 {
			style.Warning("No test execution results found matching the specified criteria.")
			return
		}

		// Handle Export
		exportPath, _ := cmd.Flags().GetString("export")
		exportFormat, _ := cmd.Flags().GetString("format")

		if exportPath != "" {
			exporter, err := export.NewExporter(exportFormat)
			if err != nil {
				style.Error("%v", err)
				os.Exit(1)
			}

			err = exporter.Export(results, exportPath)
			if err != nil {
				style.Error("Failed to export results. %v", err)
				os.Exit(1)
			}

			absPath, _ := filepath.Abs(exportPath)
			style.Success("Successfully exported results to %s", absPath)
			return
		}

		if verbose {
			display.PrintVerboseResults(results, filters.Status)
		} else {
			display.PrintExecutionResults(results)
		}
	},
}

func init() {
	rootCmd.AddCommand(resultsCmd)

	resultsCmd.Flags().StringP("planId", "p", "", "Filter results by a specific Test Plan ID")
	resultsCmd.Flags().String("componentId", "", "Filter results by a specific Discovered Component ID")
	resultsCmd.Flags().String("testId", "", "Filter results by a specific Test Component ID")
	resultsCmd.Flags().String("status", "", "Filter results by status (SUCCESS or FAILURE)")
	resultsCmd.Flags().BoolP("verbose", "v", false, "Display a detailed report of failed tests and their error messages")

	// Export Flags
	resultsCmd.Flags().String("export", "", "Path to export the results to a file")
	resultsCmd.Flags().String("format", "json", "Format of the export file (json, csv, xml)")

	resultsCmd.Flags().SortFlags = false
}
