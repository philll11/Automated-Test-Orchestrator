// automated-test-orchestrator-cli/cmd/mappings.go
package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/automated-test-orchestrator/cli-go/internal/client"
	"github.com/automated-test-orchestrator/cli-go/internal/csv"
	"github.com/automated-test-orchestrator/cli-go/internal/display"
	"github.com/automated-test-orchestrator/cli-go/internal/errors"
	"github.com/automated-test-orchestrator/cli-go/internal/model"
	"github.com/automated-test-orchestrator/cli-go/internal/style"
	"github.com/briandowns/spinner"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// mappingsCmd represents the mappings command group.
var mappingsCmd = &cobra.Command{
	Use:   "mappings",
	Short: "Manage component-to-test mappings",
}

// mappingsListCmd represents the 'mappings list' command.
var mappingsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all existing test mappings",
	Run: func(cmd *cobra.Command, args []string) {
		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		mappings, err := apiClient.GetAllMappings()
		if err != nil {
			errors.HandleCLIError(nil, err)
		}

		if len(mappings) == 0 {
			style.Warning("No mappings found.")
			return
		}

		display.PrintMappings(mappings)
	},
}

// mappingsAddCmd represents the 'mappings add' command.
var mappingsAddCmd = &cobra.Command{
	Use:   "add",
	Short: "Add a new test mapping",
	Run: func(cmd *cobra.Command, args []string) {
		s := spinner.New(spinner.CharSets[11], 100*time.Millisecond)
		s.Suffix = " Adding new mapping..."
		s.Start()

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		mainID, _ := cmd.Flags().GetString("mainId")
		mainName, _ := cmd.Flags().GetString("main-name")
		testID, _ := cmd.Flags().GetString("testId")
		testName, _ := cmd.Flags().GetString("test-name")

		req := model.CreateMappingRequest{
			MainComponentID: mainID,
			TestComponentID: testID,
		}
		if mainName != "" {
			req.MainComponentName = &mainName
		}
		if testName != "" {
			req.TestComponentName = &testName
		}

		newMapping, err := apiClient.CreateMapping(req)
		if err != nil {
			errors.HandleCLIError(s, err)
		}

		s.Stop()
		style.Success("Mapping created successfully!")
		style.PrintKV("Mapping ID", style.ID(newMapping.ID))
	},
}

// mappingsImportCmd represents the 'mappings import' command.
var mappingsImportCmd = &cobra.Command{
	Use:   "import",
	Short: "Bulk import mappings from a CSV file",
	Run: func(cmd *cobra.Command, args []string) {
		s := spinner.New(spinner.CharSets[11], 100*time.Millisecond)
		s.Suffix = " Preparing to import mappings..."
		s.Start()

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		csvPath, _ := cmd.Flags().GetString("from-csv")

		file, err := os.Open(csvPath)
		if err != nil {
			errors.HandleCLIError(s, fmt.Errorf("failed to open file %s: %w", csvPath, err))
		}
		defer file.Close()

		mappingsToCreate, err := csv.ParseMappingCsv(file)
		if err != nil {
			errors.HandleCLIError(s, fmt.Errorf("failed to parse CSV file: %w", err))
		}

		if len(mappingsToCreate) == 0 {
			s.Stop()
			style.Warning("No valid mappings found in the CSV file.")
			return
		}
		s.Suffix = fmt.Sprintf(" Found %d mappings to import.", len(mappingsToCreate))
		time.Sleep(1 * time.Second) // Pause to show message

		var successCount, failureCount int
		for i, mapping := range mappingsToCreate {
			s.Suffix = fmt.Sprintf(" Importing mapping %d of %d: %s -> %s", i+1, len(mappingsToCreate), mapping.MainComponentID, mapping.TestComponentID)
			_, err := apiClient.CreateMapping(mapping)
			if err != nil {
				failureCount++
				s.Stop()
				// Use the non-terminating formatter for the loop.
				errorMsg := errors.FormatError(err)
				style.Error("Failed to import row %d: %s", i+2, errorMsg)
				s.Start() // Restart spinner for the next item
			} else {
				successCount++
			}
		}

		s.Stop()
		style.Header("\n--- Import Complete ---")
		if successCount > 0 {
			style.Success("Successfully imported %d mapping(s).", successCount)
		}
		if failureCount > 0 {
			style.Error("Failed to import %d mapping(s). See error details above.", failureCount)
		}
	},
}

// mappingsRmCmd represents the 'mappings rm' command.
var mappingsRmCmd = &cobra.Command{
	Use:   "rm <mappingId>",
	Short: "Remove a test mapping by its unique ID",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		mappingID := args[0]
		s := spinner.New(spinner.CharSets[11], 100*time.Millisecond)
		s.Suffix = fmt.Sprintf(" Removing mapping %s...", mappingID)
		s.Start()

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		if err := apiClient.DeleteMapping(mappingID); err != nil {
			errors.HandleCLIError(s, err)
		}

		s.Stop()
		style.Success("Mapping removed successfully!")
	},
}

func init() {
	rootCmd.AddCommand(mappingsCmd)

	// List command
	mappingsCmd.AddCommand(mappingsListCmd)

	// Add command with flags
	mappingsCmd.AddCommand(mappingsAddCmd)
	mappingsAddCmd.Flags().String("mainId", "", "The main component ID (required)")
	mappingsAddCmd.Flags().String("main-name", "", "An optional descriptive name for the main component")
	mappingsAddCmd.Flags().String("testId", "", "The test component ID (required)")
	mappingsAddCmd.Flags().String("test-name", "", "An optional descriptive name for the test component")
	mappingsAddCmd.MarkFlagRequired("mainId")
	mappingsAddCmd.MarkFlagRequired("testId")

	// Import command with flags
	mappingsCmd.AddCommand(mappingsImportCmd)
	mappingsImportCmd.Flags().String("from-csv", "", "Path to a CSV file for bulk import (required)")
	mappingsImportCmd.MarkFlagRequired("from-csv")

	// Remove command
	mappingsCmd.AddCommand(mappingsRmCmd)
}
