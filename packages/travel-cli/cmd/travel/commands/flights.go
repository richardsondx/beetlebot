package commands

import (
	"github.com/beetlebot/travel-cli/internal/config"
	"github.com/beetlebot/travel-cli/internal/core"
	"github.com/beetlebot/travel-cli/internal/output"
	"github.com/spf13/cobra"
)

func FlightsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "flights",
		Short: "Search and manage flight offers",
	}
	cmd.AddCommand(flightsSearchCmd())
	return cmd
}

func flightsSearchCmd() *cobra.Command {
	var req core.FlightSearchRequest

	cmd := &cobra.Command{
		Use:   "search",
		Short: "Search for flights",
		Example: `  travel flights search --from YUL --to CDG --depart 2026-06-12 --return 2026-06-20
  travel flights search --from JFK --to LAX --depart 2026-07-01 --mode live`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if req.From == "" || req.To == "" || req.DepartDate == "" {
				return cmd.Help()
			}
			if req.Adults == 0 {
				req.Adults = 1
			}
			if req.MaxResults == 0 {
				req.MaxResults = 10
			}

			modeFlag, _ := cmd.Flags().GetString("mode")
			cfg := config.Load().WithMode(modeFlag)

			router := buildRouter(cfg)
			orch := core.NewOrchestrator(router)
			result, err := orch.SearchFlights(req)
			if err != nil {
				output.JSONError("search failed", err.Error())
				return nil
			}
			return output.JSON(result)
		},
	}

	cmd.Flags().StringVar(&req.From, "from", "", "Origin airport code (required)")
	cmd.Flags().StringVar(&req.To, "to", "", "Destination airport code (required)")
	cmd.Flags().StringVar(&req.DepartDate, "depart", "", "Departure date YYYY-MM-DD (required)")
	cmd.Flags().StringVar(&req.ReturnDate, "return", "", "Return date YYYY-MM-DD (optional)")
	cmd.Flags().IntVar(&req.Adults, "adults", 1, "Number of adults")
	cmd.Flags().StringVar(&req.CabinClass, "cabin", "economy", "Cabin class: economy, business, first")
	cmd.Flags().IntVar(&req.MaxResults, "max", 10, "Maximum results to return")

	return cmd
}
