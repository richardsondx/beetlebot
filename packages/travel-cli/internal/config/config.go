package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type Mode string

const (
	ModeMock   Mode = "mock"
	ModeLive   Mode = "live"
	ModeHybrid Mode = "hybrid"
)

type ProviderConfig struct {
	Enabled  bool              `yaml:"enabled"`
	Priority int               `yaml:"priority"`
	EnvKeys  map[string]string `yaml:"envKeys,omitempty"`
}

type Config struct {
	Mode      Mode                      `yaml:"mode"`
	Providers map[string]ProviderConfig `yaml:"providers"`
}

func DefaultConfig() *Config {
	return &Config{
		Mode: ModeMock,
		Providers: map[string]ProviderConfig{
			"mock_flights": {Enabled: true, Priority: 100},
			"mock_stays":   {Enabled: true, Priority: 100},
		},
	}
}

func Load() *Config {
	cfg := DefaultConfig()

	if path := configPath(); path != "" {
		if data, err := os.ReadFile(path); err == nil {
			_ = yaml.Unmarshal(data, cfg)
		}
	}

	if envMode := os.Getenv("TRAVEL_MODE"); envMode != "" {
		switch strings.ToLower(envMode) {
		case "mock":
			cfg.Mode = ModeMock
		case "live":
			cfg.Mode = ModeLive
		case "hybrid":
			cfg.Mode = ModeHybrid
		}
	}

	if envProviders := os.Getenv("TRAVEL_PROVIDERS"); envProviders != "" {
		names := strings.Split(envProviders, ",")
		for _, n := range names {
			n = strings.TrimSpace(n)
			if _, ok := cfg.Providers[n]; !ok {
				cfg.Providers[n] = ProviderConfig{Enabled: true, Priority: 50}
			}
		}
	}

	return cfg
}

func (c *Config) WithMode(mode string) *Config {
	if mode == "" {
		return c
	}
	switch strings.ToLower(mode) {
	case "mock":
		c.Mode = ModeMock
	case "live":
		c.Mode = ModeLive
	case "hybrid":
		c.Mode = ModeHybrid
	}
	return c
}

func (c *Config) ProviderHasCredentials(name string) bool {
	pc, ok := c.Providers[name]
	if !ok {
		return false
	}
	for _, envKey := range pc.EnvKeys {
		if os.Getenv(envKey) == "" {
			return false
		}
	}
	return true
}

func (c *Config) MissingCredentials(name string) []string {
	pc, ok := c.Providers[name]
	if !ok {
		return nil
	}
	var missing []string
	for label, envKey := range pc.EnvKeys {
		if os.Getenv(envKey) == "" {
			missing = append(missing, fmt.Sprintf("%s (%s)", label, envKey))
		}
	}
	return missing
}

func configPath() string {
	if p := os.Getenv("TRAVEL_CONFIG"); p != "" {
		return p
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	p := filepath.Join(home, ".config", "beetlebot", "travel.yaml")
	if _, err := os.Stat(p); err == nil {
		return p
	}
	return ""
}
