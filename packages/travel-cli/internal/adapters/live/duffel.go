package live

import (
	"fmt"
	"os"

	"github.com/beetlebot/travel-cli/internal/core"
)

// DuffelFlightsAdapter connects to the Duffel API for flight search.
// Duffel is self-serve friendly: https://duffel.com (free tier available).
// Set DUFFEL_API_TOKEN to enable.
type DuffelFlightsAdapter struct{}

func NewDuffelFlightsAdapter() *DuffelFlightsAdapter {
	return &DuffelFlightsAdapter{}
}

func (a *DuffelFlightsAdapter) Name() string            { return "duffel" }
func (a *DuffelFlightsAdapter) Tier() core.ProviderTier { return core.TierEasySignup }
func (a *DuffelFlightsAdapter) Capabilities() []core.Capability {
	return []core.Capability{core.CapFlightsSearch, core.CapReprice}
}

func (a *DuffelFlightsAdapter) Available() (bool, string) {
	if os.Getenv("DUFFEL_API_TOKEN") == "" {
		return false, "set DUFFEL_API_TOKEN (sign up free at https://duffel.com)"
	}
	return true, ""
}

func (a *DuffelFlightsAdapter) SearchFlights(req core.FlightSearchRequest) ([]core.FlightOffer, error) {
	// TODO: implement real Duffel API call
	// POST https://api.duffel.com/air/offer_requests
	// Authorization: Bearer $DUFFEL_API_TOKEN
	return nil, fmt.Errorf("duffel adapter not yet implemented – coming soon")
}
