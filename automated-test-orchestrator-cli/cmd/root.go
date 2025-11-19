// cli-go/cmd/root.go
package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "ato",
	Short: "Automated Test Orchestrator",
	Long:  `A command-line interface to interact with the Automated Test Orchestrator API.`,
}

// Execute adds all child commands to the root command and sets flags appropriately.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.Version = "1.0.0"

	// Define a persistent flag available to all subcommands.
	rootCmd.PersistentFlags().String("api-url", "http://localhost:3001/api/v1", "The base URL for the Orchestrator API")

	// Bind the flag to Viper so its value can be overridden by environment variables or config files.
	viper.BindPFlag("api_url", rootCmd.PersistentFlags().Lookup("api-url"))
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	// Find home directory.
	home, err := os.UserHomeDir()
	cobra.CheckErr(err)

	// Search for a config file named ".ato" (with a .yaml, .json, etc. extension) in the home directory.
	viper.AddConfigPath(home)
	viper.SetConfigName(".ato")
	viper.SetConfigType("yaml")

	// Tell Viper to also read environment variables.
	viper.SetEnvPrefix("ATO")
	viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	viper.AutomaticEnv()

	// If a config file is found, read it in.
	// We ignore the error if the file doesn't exist, as it will be created on 'config set'.
	_ = viper.ReadInConfig()
}
