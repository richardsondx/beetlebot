package output

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

var Writer io.Writer = os.Stdout

func JSON(v interface{}) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("json marshal: %w", err)
	}
	_, err = fmt.Fprintln(Writer, string(data))
	return err
}

func JSONCompact(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("json marshal: %w", err)
	}
	_, err = fmt.Fprintln(Writer, string(data))
	return err
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

func JSONError(msg string, details string) {
	_ = JSON(ErrorResponse{Error: msg, Details: details})
}
