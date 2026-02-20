package commands

import (
	"github.com/beetlebot/travel-cli/internal/config"
	"github.com/beetlebot/travel-cli/internal/output"
	"github.com/spf13/cobra"
)

func ProvidersCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "providers",
		Short: "List and inspect available travel providers",
	}
	cmd.AddCommand(providersListCmd())
	return cmd
}

func providersListCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "list",
		Short: "List all registered providers and their status",
		RunE: func(cmd *cobra.Command, args []string) error {
			modeFlag, _ := cmd.Flags().GetString("mode")
			cfg := config.Load().WithMode(modeFlag)

			router := buildRouter(cfg)
			infos := router.ProviderInfos()
			return output.JSON(infos)
		},
	}
	return cmd
}
