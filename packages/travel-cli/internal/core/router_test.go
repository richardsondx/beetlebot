package core

import (
	"testing"

	"github.com/beetlebot/travel-cli/internal/config"
)

type fakeFlightAdapter struct {
	name string
	tier ProviderTier
	avail bool
}

func (f *fakeFlightAdapter) Name() string                    { return f.name }
func (f *fakeFlightAdapter) Tier() ProviderTier              { return f.tier }
func (f *fakeFlightAdapter) Capabilities() []Capability      { return []Capability{CapFlightsSearch} }
func (f *fakeFlightAdapter) Available() (bool, string) {
	if f.avail {
		return true, ""
	}
	return false, "no credentials"
}
func (f *fakeFlightAdapter) SearchFlights(req FlightSearchRequest) ([]FlightOffer, error) {
	return nil, nil
}

func TestRouter_MockMode_OnlyMockAdapters(t *testing.T) {
	cfg := &config.Config{Mode: config.ModeMock}
	router := NewRouter(cfg)
	router.RegisterFlight(&fakeFlightAdapter{name: "mock_flights", avail: true})
	router.RegisterFlight(&fakeFlightAdapter{name: "duffel", avail: true})

	active := router.ActiveFlightAdapters()
	if len(active) != 1 {
		t.Fatalf("expected 1 adapter, got %d", len(active))
	}
	if active[0].Name() != "mock_flights" {
		t.Errorf("expected mock_flights, got %s", active[0].Name())
	}
}

func TestRouter_LiveMode_OnlyLiveAdapters(t *testing.T) {
	cfg := &config.Config{Mode: config.ModeLive}
	router := NewRouter(cfg)
	router.RegisterFlight(&fakeFlightAdapter{name: "mock_flights", avail: true})
	router.RegisterFlight(&fakeFlightAdapter{name: "duffel", avail: true})

	active := router.ActiveFlightAdapters()
	if len(active) != 1 {
		t.Fatalf("expected 1 adapter, got %d", len(active))
	}
	if active[0].Name() != "duffel" {
		t.Errorf("expected duffel, got %s", active[0].Name())
	}
}

func TestRouter_HybridMode_FallbackToMock(t *testing.T) {
	cfg := &config.Config{
		Mode:      config.ModeHybrid,
		Providers: map[string]config.ProviderConfig{},
	}
	router := NewRouter(cfg)
	router.RegisterFlight(&fakeFlightAdapter{name: "mock_flights", avail: true})
	router.RegisterFlight(&fakeFlightAdapter{name: "duffel", avail: false})

	active := router.ActiveFlightAdapters()
	if len(active) != 1 {
		t.Fatalf("expected 1 adapter (mock fallback), got %d", len(active))
	}
	if active[0].Name() != "mock_flights" {
		t.Errorf("expected mock_flights fallback, got %s", active[0].Name())
	}
}

func TestProviderInfos_ShowsAllProviders(t *testing.T) {
	cfg := &config.Config{Mode: config.ModeMock}
	router := NewRouter(cfg)
	router.RegisterFlight(&fakeFlightAdapter{name: "mock_flights", avail: true})
	router.RegisterFlight(&fakeFlightAdapter{name: "duffel", avail: false})

	infos := router.ProviderInfos()
	if len(infos) != 2 {
		t.Fatalf("expected 2 infos, got %d", len(infos))
	}
	if infos[0].Status != "active" {
		t.Errorf("expected mock_flights active, got %s", infos[0].Status)
	}
	if infos[1].Status != "inactive" {
		t.Errorf("expected duffel inactive in mock mode, got %s", infos[1].Status)
	}
}
