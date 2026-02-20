package mock

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/beetlebot/travel-cli/internal/core"
)

type MockFlightsAdapter struct{}

func NewMockFlightsAdapter() *MockFlightsAdapter {
	return &MockFlightsAdapter{}
}

func (a *MockFlightsAdapter) Name() string                    { return "mock_flights" }
func (a *MockFlightsAdapter) Tier() core.ProviderTier         { return core.TierEasySignup }
func (a *MockFlightsAdapter) Capabilities() []core.Capability { return []core.Capability{core.CapFlightsSearch} }
func (a *MockFlightsAdapter) Available() (bool, string)       { return true, "" }

var mockAirlines = []struct {
	Code    string
	Name    string
	Prefix  string
}{
	{"AC", "Air Canada", "AC"},
	{"AF", "Air France", "AF"},
	{"UA", "United Airlines", "UA"},
	{"DL", "Delta Air Lines", "DL"},
	{"BA", "British Airways", "BA"},
	{"LH", "Lufthansa", "LH"},
	{"WS", "WestJet", "WS"},
	{"AA", "American Airlines", "AA"},
}

func (a *MockFlightsAdapter) SearchFlights(req core.FlightSearchRequest) ([]core.FlightOffer, error) {
	depart, err := time.Parse("2006-01-02", req.DepartDate)
	if err != nil {
		return nil, fmt.Errorf("invalid depart date: %w", err)
	}

	rng := rand.New(rand.NewSource(hashSeed(req.From + req.To + req.DepartDate)))
	count := 5 + rng.Intn(4)

	var offers []core.FlightOffer
	for i := 0; i < count; i++ {
		al := mockAirlines[rng.Intn(len(mockAirlines))]
		stops := rng.Intn(3)
		durationMin := 120 + rng.Intn(600) + stops*90
		departHour := 6 + rng.Intn(14)
		departTime := depart.Add(time.Duration(departHour) * time.Hour)
		arriveTime := departTime.Add(time.Duration(durationMin) * time.Minute)
		price := 200.0 + float64(rng.Intn(1200)) + float64(stops)*(-50)
		if price < 150 {
			price = 150
		}

		offers = append(offers, core.FlightOffer{
			ID:              fmt.Sprintf("f_%s_%d", al.Code, 1000+i),
			Source:          "mock_flights",
			Airline:         al.Name,
			FlightNumber:    fmt.Sprintf("%s%d", al.Prefix, 100+rng.Intn(900)),
			From:            req.From,
			To:              req.To,
			DepartTime:      departTime,
			ArriveTime:      arriveTime,
			Duration:        time.Duration(durationMin) * time.Minute,
			DurationMinutes: durationMin,
			Stops:           stops,
			CabinClass:      req.CabinClass,
			PriceUSD:        float64(int(price*100)) / 100,
			Currency:        "USD",
			DeepLink:        fmt.Sprintf("https://example.com/book/%s_%d", al.Code, 1000+i),
			Confidence:      0.95,
			IsBookable:      false,
			RepriceRequired: true,
			FetchedAt:       time.Now().UTC(),
		})
	}

	return offers, nil
}

func hashSeed(s string) int64 {
	var h int64
	for _, c := range s {
		h = h*31 + int64(c)
	}
	if h < 0 {
		h = -h
	}
	return h
}
