package main

import (
	"fmt"
	"os"

	"github.com/beetlebot/travel-cli/cmd/travel/commands"
	"github.com/spf13/cobra"
)

func main() {
	root := &cobra.Command{
		Use:   "travel",
		Short: "Beetlebot travel broker – flights, stays, and trip planning",
		Long:  "A local-first travel search CLI that aggregates flights, hotels, and alternative stays with compact JSON output for AI consumption.",
	}

	root.PersistentFlags().String("mode", "", "Provider mode: mock, live, hybrid (default from config/env)")
	root.PersistentFlags().Bool("json", true, "Output as JSON (default true)")

	root.AddCommand(commands.FlightsCmd())
	root.AddCommand(commands.StaysCmd())
	root.AddCommand(commands.OffersCmd())
	root.AddCommand(commands.ProvidersCmd())
	root.AddCommand(commands.DoctorCmd())
	root.AddCommand(versionCmd())

	if err := root.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func versionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print travel CLI version",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Println("travel v0.1.0")
		},
	}
}
