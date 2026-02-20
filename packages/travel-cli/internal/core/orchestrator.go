package core

import (
	"context"
	"sync"
	"time"
)

const defaultTimeout = 15 * time.Second

type Orchestrator struct {
	router *Router
}

func NewOrchestrator(router *Router) *Orchestrator {
	return &Orchestrator{router: router}
}

func (o *Orchestrator) SearchFlights(req FlightSearchRequest) (*SearchResult, error) {
	adapters := o.router.ActiveFlightAdapters()
	if len(adapters) == 0 {
		return &SearchResult{
			Query:     req,
			Mode:      o.router.cfg.Mode,
			Providers: nil,
			Errors:    []ProviderError{{Provider: "none", Reason: "no active flight providers for current mode"}},
			FetchedAt: time.Now().UTC(),
		}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	var (
		mu       sync.Mutex
		wg       sync.WaitGroup
		flights  []FlightOffer
		provUsed []string
		errs     []ProviderError
	)

	for _, a := range adapters {
		wg.Add(1)
		go func(adapter FlightAdapter) {
			defer wg.Done()

			done := make(chan struct{})
			var results []FlightOffer
			var err error

			go func() {
				results, err = adapter.SearchFlights(req)
				close(done)
			}()

			select {
			case <-done:
			case <-ctx.Done():
				mu.Lock()
				errs = append(errs, ProviderError{
					Provider: adapter.Name(),
					Reason:   "timeout",
					Fallback: "results from other providers may still be available",
				})
				mu.Unlock()
				return
			}

			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				errs = append(errs, ProviderError{
					Provider: adapter.Name(),
					Reason:   err.Error(),
				})
			} else {
				flights = append(flights, results...)
				provUsed = append(provUsed, adapter.Name())
			}
		}(a)
	}

	wg.Wait()

	flights = DedupeFlights(flights)
	RankFlights(flights)

	if req.MaxResults > 0 && len(flights) > req.MaxResults {
		flights = flights[:req.MaxResults]
	}

	return &SearchResult{
		Query:      req,
		Mode:       o.router.cfg.Mode,
		Providers:  provUsed,
		Flights:    flights,
		TotalFound: len(flights),
		Errors:     errs,
		FetchedAt:  time.Now().UTC(),
	}, nil
}

func (o *Orchestrator) SearchStays(req StaySearchRequest) (*SearchResult, error) {
	adapters := o.router.ActiveStayAdapters()
	if len(adapters) == 0 {
		return &SearchResult{
			Query:     req,
			Mode:      o.router.cfg.Mode,
			Providers: nil,
			Errors:    []ProviderError{{Provider: "none", Reason: "no active stay providers for current mode"}},
			FetchedAt: time.Now().UTC(),
		}, nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), defaultTimeout)
	defer cancel()

	var (
		mu       sync.Mutex
		wg       sync.WaitGroup
		stays    []StayOffer
		provUsed []string
		errs     []ProviderError
	)

	for _, a := range adapters {
		wg.Add(1)
		go func(adapter StayAdapter) {
			defer wg.Done()

			done := make(chan struct{})
			var results []StayOffer
			var err error

			go func() {
				results, err = adapter.SearchStays(req)
				close(done)
			}()

			select {
			case <-done:
			case <-ctx.Done():
				mu.Lock()
				errs = append(errs, ProviderError{
					Provider: adapter.Name(),
					Reason:   "timeout",
					Fallback: "results from other providers may still be available",
				})
				mu.Unlock()
				return
			}

			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				errs = append(errs, ProviderError{
					Provider: adapter.Name(),
					Reason:   err.Error(),
				})
			} else {
				stays = append(stays, results...)
				provUsed = append(provUsed, adapter.Name())
			}
		}(a)
	}

	wg.Wait()

	stays = DedupeStays(stays)
	RankStays(stays)

	if req.MaxResults > 0 && len(stays) > req.MaxResults {
		stays = stays[:req.MaxResults]
	}

	return &SearchResult{
		Query:      req,
		Mode:       o.router.cfg.Mode,
		Providers:  provUsed,
		Stays:      stays,
		TotalFound: len(stays),
		Errors:     errs,
		FetchedAt:  time.Now().UTC(),
	}, nil
}
