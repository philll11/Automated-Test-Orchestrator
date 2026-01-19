// automated-test-orchestrator-cli/cmd/discover.go
package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/automated-test-orchestrator/cli-go/internal/client"
	"github.com/automated-test-orchestrator/cli-go/internal/csv"
	"github.com/automated-test-orchestrator/cli-go/internal/display"
	"github.com/automated-test-orchestrator/cli-go/internal/style"
	"github.com/briandowns/spinner"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// discoverCmd represents the discover command
var discoverCmd = &cobra.Command{
	Use:   "discover",
	Short: "Create a new test plan",
	Long: `Creates a new test plan. Provide component/test IDs via --ids, from a CSV file,
or interactively if no other input is given.`,
	Run: func(cmd *cobra.Command, args []string) {
		s := spinner.New(spinner.CharSets[11], 100*time.Millisecond, spinner.WithWriter(os.Stderr))
		s.Suffix = " Preparing test plan..."
		s.Start()

		planName, _ := cmd.Flags().GetString("plan-name")
		planType, _ := cmd.Flags().GetString("type")
		entryIDs, _ := cmd.Flags().GetStringArray("ids")
		entryNames, _ := cmd.Flags().GetStringArray("names")
		folderNames, _ := cmd.Flags().GetStringArray("folders")
		fromCsv, _ := cmd.Flags().GetString("from-csv")
		dependencies, _ := cmd.Flags().GetBool("dependencies")
		creds, _ := cmd.Flags().GetString("creds")

		var componentIds []string
		var componentNames []string
		var componentFolders []string
		var err error

		// 1. Load from CSV (currently assumes IDs only)
		if fromCsv != "" {
			s.Suffix = fmt.Sprintf(" Reading components from %s...", style.Cyan(fromCsv))
			file, err := os.Open(fromCsv)
			if err != nil {
				s.Stop()
				style.Error("Failed to open file: %v", err)
				os.Exit(1)
			}
			defer file.Close()
			componentIds, err = csv.ParseComponentIdCsv(file)
			if err != nil {
				s.Stop()
				style.Error("Failed to parse CSV file: %v", err)
				os.Exit(1)
			}
		}

		// 2. Append Flags
		if len(entryIDs) > 0 {
			componentIds = append(componentIds, entryIDs...)
		}
		if len(entryNames) > 0 {
			componentNames = append(componentNames, entryNames...)
		}
		if len(folderNames) > 0 {
			componentFolders = append(componentFolders, folderNames...)
		}

		// 3. Interactive fallback (only if NO inputs provided)
		if len(componentIds) == 0 && len(componentNames) == 0 && len(componentFolders) == 0 {
			s.Stop() // Stop for interactive prompt
			componentIds, err = promptForComponentIDs(dependencies)
			if err != nil {
				style.Error("Error during interactive prompt: %v", err)
				os.Exit(1)
			}
			s.Start()
		}

		if len(componentIds) == 0 && len(componentNames) == 0 && len(componentFolders) == 0 {
			s.Stop()
			style.Warning("No IDs, Names, or Folders provided. Exiting.")
			return
		}

		discoveryMode := ""
		if dependencies {
			discoveryMode = " and all their dependencies"
		}
		totalInputs := len(componentIds) + len(componentNames) + len(componentFolders)
		s.Suffix = fmt.Sprintf(" Creating test plan '%s' with %d input(s)%s...", planName, totalInputs, discoveryMode)

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		planID, err := apiClient.InitiateDiscovery(planName, planType, componentIds, componentNames, componentFolders, creds, dependencies)
		if err != nil {
			s.Stop()
			style.Error("Failed to initiate discovery: %v", err)
			os.Exit(1)
		}

		s.Suffix = fmt.Sprintf(" Test plan created (ID: %s). Waiting for component discovery...", style.ID(planID))
		finalPlan, err := apiClient.PollForPlanCompletion(planID)
		if err != nil {
			s.Stop()
			style.Error("Test plan creation failed.")
			if finalPlan != nil && finalPlan.FailureReason != nil {
				style.Error("Reason: %s", *finalPlan.FailureReason)
			} else {
				style.Error("Reason: %v", err)
			}
			os.Exit(1)
		}

		s.Stop()
		style.Success("Test plan '%s' processing complete!", finalPlan.Name)
		style.PrintKV("Test Plan ID", style.ID(planID))
		fmt.Println()
		display.PrintDiscoveryResult(finalPlan)
		fmt.Println()
		style.Info("To execute tests, use the 'execute' command with the Plan ID.")
	},
}

func promptForComponentIDs(dependencies bool) ([]string, error) {
	var ids []string
	reader := bufio.NewReader(os.Stdin)
	message := "Enter a Component ID to add to the plan (leave blank to finish):"
	if dependencies {
		message = "Enter a root Component ID to discover dependencies from (leave blank to finish):"
	}

	for {
		fmt.Print(message + " ")
		input, err := reader.ReadString('\n')
		if err != nil {
			return nil, err
		}
		id := strings.TrimSpace(input)
		if id == "" {
			break
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func init() {
	rootCmd.AddCommand(discoverCmd)
	discoverCmd.Flags().StringP("plan-name", "p", "", "A descriptive name for the test plan (required)")
	discoverCmd.Flags().StringP("type", "t", "COMPONENT", "Plan Mode: COMPONENT (default) or TEST")
	discoverCmd.Flags().StringArrayP("ids", "i", []string{}, "ID of component or test to include, e.g. '32939380-cece-4a24-a255-5a4d358aed4e' (can be used multiple times)")
	discoverCmd.Flags().StringArrayP("names", "n", []string{}, "Name of component or test to resolve (can be used multiple times)")
	discoverCmd.Flags().StringArrayP("folders", "F", []string{}, "Name of folder to scan for components/tests (can be used multiple times)")
	discoverCmd.Flags().StringP("from-csv", "f", "", "Path to a CSV file with a single column of 'componentId's")
	discoverCmd.Flags().BoolP("dependencies", "d", false, "Discover all dependencies for the provided components")
	discoverCmd.Flags().StringP("creds", "c", "", "The name of the credential profile to use (required)")

	discoverCmd.MarkFlagRequired("plan-name")
	discoverCmd.MarkFlagRequired("creds")

	discoverCmd.Flags().SortFlags = false
}
