package core

import (
	"time"

	"github.com/beetlebot/travel-cli/internal/config"
)

type Capability string

const (
	CapFlightsSearch Capability = "flights.search"
	CapStaysSearch   Capability = "stays.search"
	CapReprice       Capability = "reprice"
	CapDeepLink      Capability = "deepLink"
)

type ProviderTier string

const (
	TierEasySignup      ProviderTier = "easySignup"
	TierPartnerRequired ProviderTier = "partnerRequired"
	TierEnterpriseOnly  ProviderTier = "enterpriseOnly"
)

type FlightSearchRequest struct {
	From       string `json:"from"`
	To         string `json:"to"`
	DepartDate string `json:"departDate"`
	ReturnDate string `json:"returnDate,omitempty"`
	Adults     int    `json:"adults,omitempty"`
	CabinClass string `json:"cabinClass,omitempty"`
	MaxResults int    `json:"maxResults,omitempty"`
}

type StaySearchRequest struct {
	City        string `json:"city"`
	CheckIn     string `json:"checkIn"`
	CheckOut    string `json:"checkOut"`
	Guests      int    `json:"guests,omitempty"`
	Rooms       int    `json:"rooms,omitempty"`
	MaxResults  int    `json:"maxResults,omitempty"`
	StayType    string `json:"stayType,omitempty"`
	MaxPriceUSD int    `json:"maxPriceUSD,omitempty"`
}

type FlightOffer struct {
	ID              string        `json:"id"`
	Source          string        `json:"source"`
	Airline         string        `json:"airline"`
	FlightNumber    string        `json:"flightNumber"`
	From            string        `json:"from"`
	To              string        `json:"to"`
	DepartTime      time.Time     `json:"departTime"`
	ArriveTime      time.Time     `json:"arriveTime"`
	Duration        time.Duration `json:"-"`
	DurationMinutes int           `json:"durationMinutes"`
	Stops           int           `json:"stops"`
	CabinClass      string        `json:"cabinClass"`
	PriceUSD        float64       `json:"priceUSD"`
	Currency        string        `json:"currency"`
	DeepLink        string        `json:"deepLink,omitempty"`
	Confidence      float64       `json:"confidence"`
	IsBookable      bool          `json:"isBookable"`
	RepriceRequired bool          `json:"repriceRequired"`
	FetchedAt       time.Time     `json:"fetchedAt"`
}

type StayOffer struct {
	ID              string    `json:"id"`
	Source          string    `json:"source"`
	Name            string    `json:"name"`
	Type            string    `json:"type"`
	City            string    `json:"city"`
	Address         string    `json:"address,omitempty"`
	CheckIn         string    `json:"checkIn"`
	CheckOut        string    `json:"checkOut"`
	NightsCount     int       `json:"nightsCount"`
	PricePerNight   float64   `json:"pricePerNight"`
	TotalPriceUSD   float64   `json:"totalPriceUSD"`
	Currency        string    `json:"currency"`
	Rating          float64   `json:"rating,omitempty"`
	ReviewCount     int       `json:"reviewCount,omitempty"`
	Amenities       []string  `json:"amenities,omitempty"`
	DeepLink        string    `json:"deepLink,omitempty"`
	Confidence      float64   `json:"confidence"`
	IsBookable      bool      `json:"isBookable"`
	RepriceRequired bool      `json:"repriceRequired"`
	FetchedAt       time.Time `json:"fetchedAt"`
}

type CombinedOffer struct {
	FlightOfferID string  `json:"flightOfferId"`
	StayOfferID   string  `json:"stayOfferId"`
	TotalPriceUSD float64 `json:"totalPriceUSD"`
}

type SearchResult struct {
	Query      interface{}     `json:"query"`
	Mode       config.Mode     `json:"mode"`
	Providers  []string        `json:"providers"`
	Flights    []FlightOffer   `json:"flights,omitempty"`
	Stays      []StayOffer     `json:"stays,omitempty"`
	Combined   []CombinedOffer `json:"combined,omitempty"`
	TotalFound int             `json:"totalFound"`
	Errors     []ProviderError `json:"errors,omitempty"`
	FetchedAt  time.Time       `json:"fetchedAt"`
}

type ProviderError struct {
	Provider string `json:"provider"`
	Reason   string `json:"reason"`
	Fallback string `json:"fallback,omitempty"`
}

type ProviderInfo struct {
	Name         string       `json:"name"`
	Capabilities []Capability `json:"capabilities"`
	Tier         ProviderTier `json:"tier"`
	Status       string       `json:"status"`
	Reason       string       `json:"reason,omitempty"`
}

type DoctorReport struct {
	Mode      config.Mode    `json:"mode"`
	Providers []ProviderInfo `json:"providers"`
	Healthy   bool           `json:"healthy"`
	Summary   string         `json:"summary"`
}

type FlightAdapter interface {
	Name() string
	Tier() ProviderTier
	Capabilities() []Capability
	Available() (bool, string)
	SearchFlights(req FlightSearchRequest) ([]FlightOffer, error)
}

type StayAdapter interface {
	Name() string
	Tier() ProviderTier
	Capabilities() []Capability
	Available() (bool, string)
	SearchStays(req StaySearchRequest) ([]StayOffer, error)
}
