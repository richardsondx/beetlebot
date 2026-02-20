package mock

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/beetlebot/travel-cli/internal/core"
)

type MockStaysAdapter struct{}

func NewMockStaysAdapter() *MockStaysAdapter {
	return &MockStaysAdapter{}
}

func (a *MockStaysAdapter) Name() string                    { return "mock_stays" }
func (a *MockStaysAdapter) Tier() core.ProviderTier         { return core.TierEasySignup }
func (a *MockStaysAdapter) Capabilities() []core.Capability { return []core.Capability{core.CapStaysSearch} }
func (a *MockStaysAdapter) Available() (bool, string)       { return true, "" }

type mockStayTemplate struct {
	Name      string
	Type      string
	BasePrice float64
	Rating    float64
	Reviews   int
	Amenities []string
}

var mockStayTemplates = []mockStayTemplate{
	{"Grand Hotel Central", "hotel", 180, 4.5, 1234, []string{"wifi", "pool", "gym", "restaurant", "room_service"}},
	{"City View Suites", "hotel", 140, 4.2, 890, []string{"wifi", "gym", "breakfast"}},
	{"Cozy Downtown Apartment", "apartment", 95, 4.7, 312, []string{"wifi", "kitchen", "washer", "balcony"}},
	{"Boutique Loft Studio", "apartment", 110, 4.6, 245, []string{"wifi", "kitchen", "workspace"}},
	{"Riverside Cabin", "cabin", 130, 4.8, 178, []string{"wifi", "fireplace", "parking", "nature_view"}},
	{"Mountain Campsite", "campsite", 45, 4.3, 89, []string{"fire_pit", "hiking", "parking"}},
	{"Lakeside Glamping", "campsite", 85, 4.5, 156, []string{"tent", "lake_access", "fire_pit", "showers"}},
	{"Heritage B&B", "hotel", 125, 4.4, 567, []string{"wifi", "breakfast", "garden", "parking"}},
	{"Modern Penthouse", "apartment", 220, 4.9, 98, []string{"wifi", "rooftop", "kitchen", "city_view", "hot_tub"}},
	{"Budget Hostel Central", "hotel", 35, 3.8, 2100, []string{"wifi", "shared_kitchen", "lockers"}},
}

func (a *MockStaysAdapter) SearchStays(req core.StaySearchRequest) ([]core.StayOffer, error) {
	checkin, err := time.Parse("2006-01-02", req.CheckIn)
	if err != nil {
		return nil, fmt.Errorf("invalid checkin date: %w", err)
	}
	checkout, err := time.Parse("2006-01-02", req.CheckOut)
	if err != nil {
		return nil, fmt.Errorf("invalid checkout date: %w", err)
	}
	nights := int(checkout.Sub(checkin).Hours() / 24)
	if nights < 1 {
		nights = 1
	}

	rng := rand.New(rand.NewSource(hashSeed(req.City + req.CheckIn)))
	count := 5 + rng.Intn(4)

	var offers []core.StayOffer
	for i := 0; i < count; i++ {
		tmpl := mockStayTemplates[rng.Intn(len(mockStayTemplates))]

		if req.StayType != "any" && req.StayType != "" && req.StayType != tmpl.Type {
			continue
		}

		priceVariance := 0.7 + rng.Float64()*0.6
		pricePerNight := tmpl.BasePrice * priceVariance
		totalPrice := pricePerNight * float64(nights)

		if req.MaxPriceUSD > 0 && pricePerNight > float64(req.MaxPriceUSD) {
			continue
		}

		offers = append(offers, core.StayOffer{
			ID:              fmt.Sprintf("s_%s_%d", tmpl.Type[:3], 2000+i),
			Source:          "mock_stays",
			Name:            fmt.Sprintf("%s %s", tmpl.Name, req.City),
			Type:            tmpl.Type,
			City:            req.City,
			Address:         fmt.Sprintf("%d %s Street, %s", 10+rng.Intn(990), randomStreet(rng), req.City),
			CheckIn:         req.CheckIn,
			CheckOut:        req.CheckOut,
			NightsCount:     nights,
			PricePerNight:   float64(int(pricePerNight*100)) / 100,
			TotalPriceUSD:   float64(int(totalPrice*100)) / 100,
			Currency:        "USD",
			Rating:          tmpl.Rating,
			ReviewCount:     tmpl.Reviews,
			Amenities:       tmpl.Amenities,
			DeepLink:        fmt.Sprintf("https://example.com/stay/%s_%d", tmpl.Type[:3], 2000+i),
			Confidence:      0.90,
			IsBookable:      false,
			RepriceRequired: true,
			FetchedAt:       time.Now().UTC(),
		})
	}

	return offers, nil
}

var streets = []string{"Main", "Oak", "Maple", "King", "Queen", "Park", "River", "Lake", "Mountain", "Forest"}

func randomStreet(rng *rand.Rand) string {
	return streets[rng.Intn(len(streets))]
}
