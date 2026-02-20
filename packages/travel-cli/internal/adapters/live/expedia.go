package live

import (
	"fmt"
	"os"

	"github.com/beetlebot/travel-cli/internal/core"
)

// ExpediaStaysAdapter connects to Expedia Rapid API for hotel search.
// Requires partner signup: https://developers.expediagroup.com/supply/lodging/docs/getting-started
// Set EXPEDIA_API_KEY and EXPEDIA_API_SECRET to enable.
type ExpediaStaysAdapter struct{}

func NewExpediaStaysAdapter() *ExpediaStaysAdapter {
	return &ExpediaStaysAdapter{}
}

func (a *ExpediaStaysAdapter) Name() string            { return "expedia" }
func (a *ExpediaStaysAdapter) Tier() core.ProviderTier { return core.TierPartnerRequired }
func (a *ExpediaStaysAdapter) Capabilities() []core.Capability {
	return []core.Capability{core.CapStaysSearch, core.CapReprice, core.CapDeepLink}
}

func (a *ExpediaStaysAdapter) Available() (bool, string) {
	if os.Getenv("EXPEDIA_API_KEY") == "" || os.Getenv("EXPEDIA_API_SECRET") == "" {
		return false, "set EXPEDIA_API_KEY and EXPEDIA_API_SECRET (partner signup at developers.expediagroup.com)"
	}
	return true, ""
}

func (a *ExpediaStaysAdapter) SearchStays(req core.StaySearchRequest) ([]core.StayOffer, error) {
	// TODO: implement Expedia Rapid API call
	// GET https://api.ean.com/v3/properties/availability
	return nil, fmt.Errorf("expedia adapter not yet implemented – coming soon")
}
