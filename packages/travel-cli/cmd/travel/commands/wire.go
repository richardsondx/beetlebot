package commands

import (
	"github.com/beetlebot/travel-cli/internal/adapters/live"
	"github.com/beetlebot/travel-cli/internal/adapters/mock"
	"github.com/beetlebot/travel-cli/internal/config"
	"github.com/beetlebot/travel-cli/internal/core"
)

func buildRouter(cfg *config.Config) *core.Router {
	router := core.NewRouter(cfg)

	router.RegisterFlight(mock.NewMockFlightsAdapter())
	router.RegisterStay(mock.NewMockStaysAdapter())

	router.RegisterFlight(live.NewDuffelFlightsAdapter())
	router.RegisterStay(live.NewExpediaStaysAdapter())
	router.RegisterStay(live.NewAirbnbStaysAdapter())

	return router
}
