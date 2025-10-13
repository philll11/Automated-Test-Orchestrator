// cli-go/cmd/execute.go
package cmd

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/automated-test-orchestrator/cli-go/internal/client"
	"github.com/automated-test-orchestrator/cli-go/internal/display"
	"github.com/briandowns/spinner"
	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// executeCmd represents the execute command
var executeCmd = &cobra.Command{
	Use:   "execute",
	Short: "Execute a selected set of tests from a Test Plan",
	Run: func(cmd *cobra.Command, args []string) {
		planID, _ := cmd.Flags().GetString("planId")
		tests, _ := cmd.Flags().GetString("tests")
		creds, _ := cmd.Flags().GetString("creds")

		var testsToRun []string
		if tests != "" {
			testsToRun = strings.Split(tests, ",")
			for i, t := range testsToRun {
				testsToRun[i] = strings.TrimSpace(t)
			}
		}

		s := spinner.New(spinner.CharSets[11], 100*time.Millisecond)
		s.Suffix = " Preparing execution..."
		s.Start()

		executionMessage := "all available tests"
		if len(testsToRun) > 0 {
			executionMessage = "selected tests"
		}
		s.Suffix = fmt.Sprintf(" Initiating execution for %s for Plan ID: %s...", executionMessage, color.CyanString(planID))

		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		err := apiClient.InitiateExecution(planID, testsToRun, creds)
		if err != nil {
			s.Stop()
			color.Red("\nError: Failed to initiate execution: %v", err)
			os.Exit(1)
		}

		s.Suffix = " Execution in progress. Waiting for results..."
		finalPlan, err := apiClient.PollForExecutionCompletion(planID)
		if err != nil {
			s.Stop()
			color.Red("\nExecution failed.")
			if finalPlan != nil && finalPlan.FailureReason != nil {
				fmt.Printf("Reason: %s\n", *finalPlan.FailureReason)
			} else {
				fmt.Printf("Reason: %v\n", err)
			}
			os.Exit(1)
		}

		s.Stop()
		color.Green("✅ Execution complete!")
		display.PrintExecutionReport(finalPlan)
	},
}

func init() {
	rootCmd.AddCommand(executeCmd)
	executeCmd.Flags().StringP("planId", "p", "", "The Test Plan ID from the discovery phase (required)")
	executeCmd.Flags().StringP("tests", "t", "", "A comma-separated list of specific test component IDs to run")
	executeCmd.Flags().String("creds", "", "The name of the credential profile to use (required)")
	executeCmd.MarkFlagRequired("planId")
	executeCmd.MarkFlagRequired("creds")
}
