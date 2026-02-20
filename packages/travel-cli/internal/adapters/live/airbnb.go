package live

import (
	"fmt"
	"os"

	"github.com/beetlebot/travel-cli/internal/core"
)

// AirbnbStaysAdapter provides Airbnb listing search.
// Airbnb does not offer a public API; this adapter uses deep-link generation
// and optionally an affiliate/partner integration when available.
// Set AIRBNB_AFFILIATE_ID to enable (or leave unset for deep-link-only mode).
type AirbnbStaysAdapter struct{}

func NewAirbnbStaysAdapter() *AirbnbStaysAdapter {
	return &AirbnbStaysAdapter{}
}

func (a *AirbnbStaysAdapter) Name() string            { return "airbnb" }
func (a *AirbnbStaysAdapter) Tier() core.ProviderTier { return core.TierPartnerRequired }
func (a *AirbnbStaysAdapter) Capabilities() []core.Capability {
	return []core.Capability{core.CapStaysSearch, core.CapDeepLink}
}

func (a *AirbnbStaysAdapter) Available() (bool, string) {
	if os.Getenv("AIRBNB_AFFILIATE_ID") == "" {
		return false, "set AIRBNB_AFFILIATE_ID (Airbnb affiliate or partner program required)"
	}
	return true, ""
}

func (a *AirbnbStaysAdapter) SearchStays(req core.StaySearchRequest) ([]core.StayOffer, error) {
	// TODO: implement deep-link builder or affiliate API
	// Deep link pattern: https://www.airbnb.com/s/{city}/homes?checkin={date}&checkout={date}&adults={n}
	return nil, fmt.Errorf("airbnb adapter not yet implemented – coming soon")
}
