package core

import (
	"github.com/beetlebot/travel-cli/internal/config"
)

type Router struct {
	cfg            *config.Config
	flightAdapters []FlightAdapter
	stayAdapters   []StayAdapter
}

func NewRouter(cfg *config.Config) *Router {
	return &Router{cfg: cfg}
}

func (r *Router) RegisterFlight(a FlightAdapter) {
	r.flightAdapters = append(r.flightAdapters, a)
}

func (r *Router) RegisterStay(a StayAdapter) {
	r.stayAdapters = append(r.stayAdapters, a)
}

func (r *Router) ActiveFlightAdapters() []FlightAdapter {
	var out []FlightAdapter
	for _, a := range r.flightAdapters {
		if r.shouldUse(a.Name()) {
			out = append(out, a)
		}
	}
	return out
}

func (r *Router) ActiveStayAdapters() []StayAdapter {
	var out []StayAdapter
	for _, a := range r.stayAdapters {
		if r.shouldUse(a.Name()) {
			out = append(out, a)
		}
	}
	return out
}

func (r *Router) shouldUse(name string) bool {
	switch r.cfg.Mode {
	case config.ModeMock:
		return isMockProvider(name)
	case config.ModeLive:
		return !isMockProvider(name)
	case config.ModeHybrid:
		if !isMockProvider(name) {
			return r.cfg.ProviderHasCredentials(name)
		}
		return r.noLiveAlternative(name)
	}
	return false
}

func (r *Router) noLiveAlternative(mockName string) bool {
	switch mockName {
	case "mock_flights":
		for _, a := range r.flightAdapters {
			if !isMockProvider(a.Name()) && r.cfg.ProviderHasCredentials(a.Name()) {
				return false
			}
		}
		return true
	case "mock_stays":
		for _, a := range r.stayAdapters {
			if !isMockProvider(a.Name()) && r.cfg.ProviderHasCredentials(a.Name()) {
				return false
			}
		}
		return true
	}
	return true
}

func isMockProvider(name string) bool {
	return len(name) >= 5 && name[:5] == "mock_"
}

func (r *Router) ProviderInfos() []ProviderInfo {
	var infos []ProviderInfo

	for _, a := range r.flightAdapters {
		info := ProviderInfo{
			Name:         a.Name(),
			Capabilities: a.Capabilities(),
			Tier:         a.Tier(),
		}
		if avail, reason := a.Available(); avail {
			info.Status = "active"
		} else {
			info.Status = "no_credentials"
			info.Reason = reason
		}
		if r.cfg.Mode == config.ModeMock && !isMockProvider(a.Name()) {
			info.Status = "inactive"
			info.Reason = "mode is mock"
		}
		infos = append(infos, info)
	}

	for _, a := range r.stayAdapters {
		info := ProviderInfo{
			Name:         a.Name(),
			Capabilities: a.Capabilities(),
			Tier:         a.Tier(),
		}
		if avail, reason := a.Available(); avail {
			info.Status = "active"
		} else {
			info.Status = "no_credentials"
			info.Reason = reason
		}
		if r.cfg.Mode == config.ModeMock && !isMockProvider(a.Name()) {
			info.Status = "inactive"
			info.Reason = "mode is mock"
		}
		infos = append(infos, info)
	}

	return infos
}
