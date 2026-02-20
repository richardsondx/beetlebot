package core

import (
	"testing"
	"time"
)

func TestRankFlights_CheaperDirectFirst(t *testing.T) {
	flights := []FlightOffer{
		{ID: "expensive_direct", PriceUSD: 900, Stops: 0, DurationMinutes: 450, Confidence: 0.9, IsBookable: true},
		{ID: "cheap_direct", PriceUSD: 400, Stops: 0, DurationMinutes: 480, Confidence: 0.9, IsBookable: true},
		{ID: "cheap_1stop", PriceUSD: 350, Stops: 1, DurationMinutes: 600, Confidence: 0.9, IsBookable: true},
	}

	RankFlights(flights)

	if flights[0].ID != "cheap_direct" {
		t.Errorf("expected cheap_direct first, got %s", flights[0].ID)
	}
}

func TestRankFlights_BookablePreferred(t *testing.T) {
	flights := []FlightOffer{
		{ID: "not_bookable", PriceUSD: 400, Stops: 0, DurationMinutes: 450, Confidence: 0.9, IsBookable: false},
		{ID: "bookable", PriceUSD: 420, Stops: 0, DurationMinutes: 450, Confidence: 0.9, IsBookable: true},
	}

	RankFlights(flights)

	if flights[0].ID != "bookable" {
		t.Errorf("expected bookable first, got %s", flights[0].ID)
	}
}

func TestRankStays_HighRatingPreferred(t *testing.T) {
	stays := []StayOffer{
		{ID: "ok_hotel", PricePerNight: 100, Rating: 3.5, Confidence: 0.9, IsBookable: true},
		{ID: "great_hotel", PricePerNight: 110, Rating: 4.8, Confidence: 0.9, IsBookable: true},
	}

	RankStays(stays)

	if stays[0].ID != "great_hotel" {
		t.Errorf("expected great_hotel first, got %s", stays[0].ID)
	}
}

func TestDedupeFlights(t *testing.T) {
	now := time.Now()
	flights := []FlightOffer{
		{ID: "a", Airline: "AC", FlightNumber: "AC100", DepartTime: now},
		{ID: "b", Airline: "AC", FlightNumber: "AC100", DepartTime: now},
		{ID: "c", Airline: "AF", FlightNumber: "AF200", DepartTime: now},
	}

	result := DedupeFlights(flights)
	if len(result) != 2 {
		t.Errorf("expected 2 unique flights, got %d", len(result))
	}
}

func TestDedupeStays(t *testing.T) {
	stays := []StayOffer{
		{ID: "a", Name: "Hotel X", Source: "mock", CheckIn: "2026-06-01"},
		{ID: "b", Name: "Hotel X", Source: "mock", CheckIn: "2026-06-01"},
		{ID: "c", Name: "Hotel Y", Source: "mock", CheckIn: "2026-06-01"},
	}

	result := DedupeStays(stays)
	if len(result) != 2 {
		t.Errorf("expected 2 unique stays, got %d", len(result))
	}
}
