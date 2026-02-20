package core

import "sort"

func RankFlights(flights []FlightOffer) {
	sort.SliceStable(flights, func(i, j int) bool {
		si := flightScore(flights[i])
		sj := flightScore(flights[j])
		return si > sj
	})
}

func flightScore(f FlightOffer) float64 {
	score := 100.0

	score -= f.PriceUSD / 50.0

	score -= float64(f.Stops) * 15.0

	score -= float64(f.DurationMinutes) / 30.0

	if f.IsBookable {
		score += 20.0
	}

	score += f.Confidence * 10.0

	return score
}

func RankStays(stays []StayOffer) {
	sort.SliceStable(stays, func(i, j int) bool {
		si := stayScore(stays[i])
		sj := stayScore(stays[j])
		return si > sj
	})
}

func stayScore(s StayOffer) float64 {
	score := 100.0

	score -= s.PricePerNight / 20.0

	score += s.Rating * 8.0

	if s.IsBookable {
		score += 20.0
	}

	score += s.Confidence * 10.0

	return score
}

func DedupeFlights(flights []FlightOffer) []FlightOffer {
	seen := make(map[string]bool)
	var out []FlightOffer
	for _, f := range flights {
		key := f.Airline + f.FlightNumber + f.DepartTime.String()
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, f)
	}
	return out
}

func DedupeStays(stays []StayOffer) []StayOffer {
	seen := make(map[string]bool)
	var out []StayOffer
	for _, s := range stays {
		key := s.Name + s.Source + s.CheckIn
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, s)
	}
	return out
}
