package commands

import (
	"fmt"
	"strings"

	"github.com/beetlebot/travel-cli/internal/config"
	"github.com/beetlebot/travel-cli/internal/core"
	"github.com/beetlebot/travel-cli/internal/output"
	"github.com/spf13/cobra"
)

func DoctorCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "doctor",
		Short: "Validate configuration, credentials, and provider health",
		RunE: func(cmd *cobra.Command, args []string) error {
			modeFlag, _ := cmd.Flags().GetString("mode")
			cfg := config.Load().WithMode(modeFlag)

			router := buildRouter(cfg)
			infos := router.ProviderInfos()

			active := 0
			var issues []string
			for _, p := range infos {
				if p.Status == "active" {
					active++
				} else if p.Status == "no_credentials" {
					issues = append(issues, fmt.Sprintf("%s: missing credentials", p.Name))
				}
			}

			healthy := active > 0
			summary := fmt.Sprintf("%d/%d providers active (mode=%s)", active, len(infos), cfg.Mode)
			if len(issues) > 0 {
				summary += " | issues: " + strings.Join(issues, "; ")
			}

			report := core.DoctorReport{
				Mode:      cfg.Mode,
				Providers: infos,
				Healthy:   healthy,
				Summary:   summary,
			}

			return output.JSON(report)
		},
	}
	return cmd
}
