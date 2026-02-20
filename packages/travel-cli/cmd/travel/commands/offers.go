package commands

import (
	"fmt"

	"github.com/beetlebot/travel-cli/internal/core"
	"github.com/beetlebot/travel-cli/internal/output"
	"github.com/spf13/cobra"
)

func OffersCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "offers",
		Short: "Combine and reprice travel offers",
	}
	cmd.AddCommand(offersCombineCmd())
	cmd.AddCommand(offersRepriceCmd())
	return cmd
}

func offersCombineCmd() *cobra.Command {
	var flightID, stayID string

	cmd := &cobra.Command{
		Use:   "combine",
		Short: "Combine a flight and stay offer into a trip package",
		RunE: func(cmd *cobra.Command, args []string) error {
			if flightID == "" || stayID == "" {
				return fmt.Errorf("both --flight-id and --stay-id are required")
			}
			combined := core.CombinedOffer{
				FlightOfferID: flightID,
				StayOfferID:   stayID,
				TotalPriceUSD: 0, // will be resolved from cache in future
			}
			return output.JSON(combined)
		},
	}

	cmd.Flags().StringVar(&flightID, "flight-id", "", "Flight offer ID")
	cmd.Flags().StringVar(&stayID, "stay-id", "", "Stay offer ID")

	return cmd
}

func offersRepriceCmd() *cobra.Command {
	var offerID string

	cmd := &cobra.Command{
		Use:   "reprice",
		Short: "Reprice a cached offer with fresh data",
		RunE: func(cmd *cobra.Command, args []string) error {
			if offerID == "" {
				return fmt.Errorf("--offer-id is required")
			}
			return output.JSON(map[string]interface{}{
				"offerId": offerID,
				"status":  "reprice_not_implemented",
				"message": "Reprice requires live provider connection. Coming in a future version.",
			})
		},
	}

	cmd.Flags().StringVar(&offerID, "offer-id", "", "Offer ID to reprice")

	return cmd
}
