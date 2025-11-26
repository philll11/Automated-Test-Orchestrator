// automated-test-orchestrator-cli/cmd/config.go
package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/automated-test-orchestrator/cli-go/internal/style"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

const configKeyApiUrl = "api_url"

// configCmd represents the config command group.
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage the CLI configuration",
	Long:  `View or update the saved API URL for the CLI.`,
}

// configSetCmd represents the 'config set' command.
var configSetCmd = &cobra.Command{
	Use:   "set <url>",
	Short: "Set and save the API base URL",
	Long:  `Sets and permanently saves the API base URL that the CLI will use for all commands.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		url := args[0]

		// Set the value in viper using the hardcoded key.
		viper.Set(configKeyApiUrl, url)

		// Find home directory to determine where to save the file.
		home, err := os.UserHomeDir()
		if err != nil {
			style.Error("Unable to find home directory: %v", err)
			os.Exit(1)
		}

		// Define the full path for the config file.
		configPath := filepath.Join(home, ".ato.yaml")

		// Use WriteConfigAs to create or overwrite the configuration file.
		if err := viper.WriteConfigAs(configPath); err != nil {
			style.Error("Unable to save config file: %v", err)
			os.Exit(1)
		}

		style.Success("API URL has been saved to %s", configPath)
	},
}

// configGetCmd represents the 'config get' command.
var configGetCmd = &cobra.Command{
	Use:   "get",
	Short: "Get the currently saved API base URL",
	Long:  `Displays the API base URL that is currently saved in the configuration file.`,
	Args:  cobra.NoArgs,
	Run: func(cmd *cobra.Command, args []string) {
		if viper.IsSet(configKeyApiUrl) {
			value := viper.GetString(configKeyApiUrl)
			style.PrintKV("Current API URL", value)
			if viper.ConfigFileUsed() != "" {
				fmt.Println(style.Faint(" (from %s)", viper.ConfigFileUsed()))
			}
		} else {
			style.Warning("API URL is not set. Use 'ato config set <url>' to set it.")
		}
	},
}

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configGetCmd)

	configCmd.Flags().SortFlags = false
}
