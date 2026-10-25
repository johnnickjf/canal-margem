package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"time"

	"margem/backend/internal/ingestion"
)

type healthAlert struct {
	Alert      string           `json:"alert"`
	DedupKey   string           `json:"dedup_key"`
	Status     string           `json:"status"`
	CheckedAt  time.Time        `json:"checked_at"`
	Health     ingestion.Health `json:"health"`
	CheckError string           `json:"check_error,omitempty"`
}

func sendHealthAlert(ctx context.Context, health ingestion.Health, checkedAt time.Time, checkError string) (bool, error) {
	endpoint := os.Getenv("MARGEM_ALERT_WEBHOOK_URL")
	if endpoint == "" {
		return false, nil
	}
	parsed, err := url.Parse(endpoint)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.User != nil || parsed.Fragment != "" {
		return true, errors.New("MARGEM_ALERT_WEBHOOK_URL exige URL HTTPS válida sem credenciais ou fragmento")
	}

	status := "firing"
	if health.Healthy && checkError == "" {
		status = "resolved"
	}
	body, err := json.Marshal(healthAlert{
		Alert:      "margem_source_freshness",
		DedupKey:   "margem_source_freshness",
		Status:     status,
		CheckedAt:  checkedAt,
		Health:     health,
		CheckError: checkError,
	})
	if err != nil {
		return true, errors.New("não foi possível preparar o alerta de saúde")
	}

	requestCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(requestCtx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return true, errors.New("não foi possível preparar o alerta de saúde")
	}
	request.Header.Set("Content-Type", "application/json")
	client := http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	response, err := client.Do(request)
	if err != nil {
		return true, errors.New("falha ao entregar o alerta de saúde")
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return true, errors.New("destino recusou o alerta de saúde")
	}
	return true, nil
}
