// cli-go/cmd/discover.go
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
	"github.com/briandowns/spinner"
	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// discoverCmd represents the discover command
var discoverCmd = &cobra.Command{
	Use:   "discover [componentIds...]",
	Short: "Create a new test plan from a list of components",
	Long: `Creates a new test plan. Provide component IDs as arguments, from a CSV file,
or interactively if no other input is given.`,
	Run: func(cmd *cobra.Command, args []string) {
		s := spinner.New(spinner.CharSets[11], 100*time.Millisecond)
		s.Suffix = " Preparing test plan..."
		s.Start()

		fromCsv, _ := cmd.Flags().GetString("from-csv")
		dependencies, _ := cmd.Flags().GetBool("dependencies")
		creds, _ := cmd.Flags().GetString("creds")

		var componentIds []string
		var err error

		if fromCsv != "" {
			s.Suffix = fmt.Sprintf(" Reading components from %s...", color.CyanString(fromCsv))
			file, err := os.Open(fromCsv)
			if err != nil {
				s.Stop()
				color.Red("\nError: Failed to open file: %v", err)
				os.Exit(1)
			}
			defer file.Close()
			componentIds, err = csv.ParseComponentIdCsv(file)
			if err != nil {
				s.Stop()
				color.Red("\nError: Failed to parse CSV file: %v", err)
				os.Exit(1)
			}
		} else if len(args) > 0 {
			componentIds = args
		} else {
			s.Stop() // Stop for interactive prompt
			componentIds, err = promptForComponentIDs(dependencies)
			if err != nil {
				color.Red("Error during interactive prompt: %v", err)
				os.Exit(1)
			}
			s.Start()
		}

		if len(componentIds) == 0 {
			s.Stop()
			color.Yellow("No component IDs provided. Exiting.")
			return
		}

		discoveryMode := ""
		if dependencies {
			discoveryMode = " and all their dependencies"
		}
		s.Suffix = fmt.Sprintf(" Creating test plan with %d component(s)%s...", len(componentIds), discoveryMode)

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		planID, err := apiClient.InitiateDiscovery(componentIds, creds, dependencies)
		if err != nil {
			s.Stop()
			color.Red("\nError: Failed to initiate discovery: %v", err)
			os.Exit(1)
		}

		s.Suffix = fmt.Sprintf(" Test plan created (ID: %s). Waiting for component discovery...", color.CyanString(planID))
		finalPlan, err := apiClient.PollForPlanCompletion(planID)
		if err != nil {
			s.Stop()
			color.Red("\nTest plan creation failed.")
			if finalPlan != nil && finalPlan.FailureReason != nil {
				fmt.Printf("Reason: %s\n", *finalPlan.FailureReason)
			} else {
				fmt.Printf("Reason: %v\n", err)
			}
			os.Exit(1)
		}

		s.Stop()
		color.Green("✅ Test plan processing complete!")
		fmt.Printf("\nTest Plan ID: %s\n\n", color.CyanString(planID))
		display.PrintDiscoveryResult(finalPlan)
		color.Yellow("\nTo execute tests, use the 'execute' command with the Plan ID.")
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
	discoverCmd.Flags().String("from-csv", "", "Path to a CSV file with a single column of 'componentId's")
	discoverCmd.Flags().Bool("dependencies", false, "Discover all dependencies for the provided components")
	discoverCmd.Flags().String("creds", "", "The name of the credential profile to use (required)")
	discoverCmd.MarkFlagRequired("creds")
}
