// cli-go/cmd/config.go
package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// configCmd represents the config command group.
var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage CLI configuration",
	Long:  `View or update CLI configuration settings like the API URL.`,
}

// configSetCmd represents the 'config set' command.
var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration key-value pair",
	Long:  `Set a configuration value (e.g., 'api_url'). This will be saved to your config file.`,
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]
		value := args[1]

		// Set the value in viper.
		viper.Set(key, value)

		// Find home directory to save the file.
		home, err := os.UserHomeDir()
		if err != nil {
			color.Red("Error: Unable to find home directory. %v", err)
			os.Exit(1)
		}

		// Define the full path for the config file.
		configPath := filepath.Join(home, ".ato.yaml")

		// Write the current configuration to the file.
		if err := viper.WriteConfigAs(configPath); err != nil {
			color.Red("Error: Unable to save config file: %v", err)
			os.Exit(1)
		}

		color.Green("✅ Configuration saved to %s", configPath)
	},
}

// configGetCmd represents the 'config get' command.
var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a configuration value",
	Long:  `Get a configuration value by its key (e.g., 'api_url').`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		key := args[0]
		if viper.IsSet(key) {
			value := viper.Get(key)
			fmt.Printf("%s: %v\n", key, value)
		} else {
			color.Yellow("Configuration key '%s' is not set.", key)
		}
	},
}

// configListCmd represents the 'config list' command.
var configListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all configuration settings",
	Long:  `Displays all the current configuration settings and their values.`,
	Run: func(cmd *cobra.Command, args []string) {
		settings := viper.AllSettings()

		if len(settings) == 0 {
			color.Yellow("No configuration settings found.")
			return
		}

		fmt.Println("Current Configuration Settings:")
		table := tablewriter.NewWriter(os.Stdout)
		table.SetHeader([]string{"Key", "Value"})
		table.SetBorder(true)

		for key, value := range settings {
			table.Append([]string{key, fmt.Sprintf("%v", value)})
		}
		table.Render()

		if viper.ConfigFileUsed() != "" {
			fmt.Printf("\nSettings are being read from: %s\n", viper.ConfigFileUsed())
		}
	},
}

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configGetCmd)
	configCmd.AddCommand(configListCmd)
}
