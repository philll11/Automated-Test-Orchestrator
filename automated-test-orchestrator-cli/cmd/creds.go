// cli-go/cmd/creds.go
package cmd

import (
	"fmt"

	"github.com/AlecAivazis/survey/v2"
	"github.com/automated-test-orchestrator/cli-go/internal/client"
	"github.com/automated-test-orchestrator/cli-go/internal/display"
	"github.com/automated-test-orchestrator/cli-go/internal/errors"
	"github.com/automated-test-orchestrator/cli-go/internal/model"
	"github.com/fatih/color"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// credsCmd represents the creds command group.
var credsCmd = &cobra.Command{
	Use:   "creds",
	Short: "Manage secure credential profiles",
	Long:  `Add, list, or delete credential profiles used to connect to the integration platform.`,
}

// credsAddCmd represents the 'creds add' command.
var credsAddCmd = &cobra.Command{
	Use:   "add <profile>",
	Short: "Add a new credential profile",
	Long:  `Interactively prompts for details to add a new credential profile (e.g., "dev-account").`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		profileName := args[0]
		apiClient := client.NewAPIClient(viper.GetString("api_url"))

		fmt.Printf("Adding new credentials for profile: %s\n", color.CyanString(profileName))

		answers := struct {
			AccountID           string `survey:"accountId"`
			Username            string `survey:"username"`
			PasswordOrToken     string `survey:"passwordOrToken"`
			ExecutionInstanceID string `survey:"executionInstanceId"`
		}{}

		questions := promptForCredentials()

		err := survey.Ask(questions, &answers)
		if err != nil {
			fmt.Println("\nCredential creation cancelled.")
			return
		}

		requestData := model.AddCredentialRequest{
			ProfileName:         profileName,
			AccountID:           answers.AccountID,
			Username:            answers.Username,
			PasswordOrToken:     answers.PasswordOrToken,
			ExecutionInstanceID: answers.ExecutionInstanceID,
		}

		if err := apiClient.AddCredentialProfile(requestData); err != nil {
			errors.HandleCLIError(nil, err)
		}

		color.Green("✅ Profile \"%s\" has been saved securely.", profileName)
	},
}

// credsListCmd represents the 'creds list' command.
var credsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all saved credential profiles",
	Long:  `Retrieves and displays a list of all configured credential profiles.`,
	Run: func(cmd *cobra.Command, args []string) {
		apiClient := client.NewAPIClient(viper.GetString("api_url"))
		profiles, err := apiClient.ListCredentialProfiles()
		if err != nil {
			errors.HandleCLIError(nil, err)
		}

		if len(profiles) == 0 {
			color.Yellow("No credential profiles found. Use \"ato creds add <profile>\" to add one.")
			return
		}

		color.Green("Saved Credential Profiles:")
		display.PrintCredentialProfiles(profiles)
	},
}

// credsDeleteCmd represents the 'creds delete' command.
var credsDeleteCmd = &cobra.Command{
	Use:   "delete <profile>",
	Short: "Delete a credential profile",
	Long:  `Deletes a credential profile by its name.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		profileName := args[0]
		apiClient := client.NewAPIClient(viper.GetString("api_url"))

		if err := apiClient.DeleteCredentialProfile(profileName); err != nil {
			errors.HandleCLIError(nil, err)
		}

		color.Green("✅ Profile \"%s\" was successfully deleted.", profileName)
	},
}

// promptForCredentials defines the interactive questions for the 'add' command.
func promptForCredentials() []*survey.Question {
	return []*survey.Question{
		{
			Name:     "accountId",
			Prompt:   &survey.Input{Message: "Enter your Integration Platform Account ID:"},
			Validate: survey.Required,
		},
		{
			Name:     "username",
			Prompt:   &survey.Input{Message: "Enter your Integration Platform Username:"},
			Validate: survey.Required,
		},
		{
			Name:     "passwordOrToken",
			Prompt:   &survey.Password{Message: "Enter your Integration Platform Password or Token:"},
			Validate: survey.Required,
		},
		{
			Name:     "executionInstanceId",
			Prompt:   &survey.Input{Message: "Enter the ID of the execution instance to use for execution:"},
			Validate: survey.Required,
		},
	}
}

func init() {
	rootCmd.AddCommand(credsCmd)

	credsCmd.AddCommand(credsAddCmd)
	credsCmd.AddCommand(credsListCmd)
	credsCmd.AddCommand(credsDeleteCmd)
}
