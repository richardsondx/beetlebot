package commands

import (
	"github.com/beetlebot/travel-cli/internal/config"
	"github.com/beetlebot/travel-cli/internal/core"
	"github.com/beetlebot/travel-cli/internal/output"
	"github.com/spf13/cobra"
)

func StaysCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "stays",
		Short: "Search and manage accommodation offers",
	}
	cmd.AddCommand(staysSearchCmd())
	return cmd
}

func staysSearchCmd() *cobra.Command {
	var req core.StaySearchRequest

	cmd := &cobra.Command{
		Use:   "search",
		Short: "Search for hotels, Airbnb, camping, and other stays",
		Example: `  travel stays search --city Paris --checkin 2026-06-12 --checkout 2026-06-20
  travel stays search --city "Banff" --checkin 2026-08-01 --checkout 2026-08-05 --type camping`,
		RunE: func(cmd *cobra.Command, args []string) error {
			if req.City == "" || req.CheckIn == "" || req.CheckOut == "" {
				return cmd.Help()
			}
			if req.Guests == 0 {
				req.Guests = 2
			}
			if req.Rooms == 0 {
				req.Rooms = 1
			}
			if req.MaxResults == 0 {
				req.MaxResults = 10
			}
			if req.StayType == "" {
				req.StayType = "any"
			}

			modeFlag, _ := cmd.Flags().GetString("mode")
			cfg := config.Load().WithMode(modeFlag)

			router := buildRouter(cfg)
			orch := core.NewOrchestrator(router)
			result, err := orch.SearchStays(req)
			if err != nil {
				output.JSONError("search failed", err.Error())
				return nil
			}
			return output.JSON(result)
		},
	}

	cmd.Flags().StringVar(&req.City, "city", "", "City name (required)")
	cmd.Flags().StringVar(&req.CheckIn, "checkin", "", "Check-in date YYYY-MM-DD (required)")
	cmd.Flags().StringVar(&req.CheckOut, "checkout", "", "Check-out date YYYY-MM-DD (required)")
	cmd.Flags().IntVar(&req.Guests, "guests", 2, "Number of guests")
	cmd.Flags().IntVar(&req.Rooms, "rooms", 1, "Number of rooms")
	cmd.Flags().StringVar(&req.StayType, "type", "any", "Stay type: hotel, airbnb, camping, any")
	cmd.Flags().IntVar(&req.MaxResults, "max", 10, "Maximum results to return")
	cmd.Flags().IntVar(&req.MaxPriceUSD, "max-price", 0, "Max price per night in USD (0 = no limit)")

	return cmd
}
