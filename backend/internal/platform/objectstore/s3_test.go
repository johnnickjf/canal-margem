package objectstore

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func TestVerifySeparatesMissingKeyFromBucketAndCorruption(t *testing.T) {
	for _, tc := range []struct {
		name       string
		status     int
		body       string
		want       error
		wantFailed bool
	}{
		{"missing key", 404, "<Error><Code>NoSuchKey</Code></Error>", ErrMissing, true},
		{"missing bucket", 404, "<Error><Code>NoSuchBucket</Code></Error>", nil, true},
		{"access denied", 403, "<Error><Code>AccessDenied</Code></Error>", nil, true},
		{"different bytes", 200, "alterado", ErrCorrupt, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tc.status)
				fmt.Fprint(w, tc.body)
			}))
			defer server.Close()
			client := s3.NewFromConfig(aws.Config{
				Region: "us-east-1", Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider("test", "test", "")),
				RetryMaxAttempts: 1,
			}, func(o *s3.Options) { o.BaseEndpoint = aws.String(server.URL); o.UsePathStyle = true })
			store := S3{Client: client, Bucket: "test-bucket"}
			err := store.Verify(context.Background(), "raw/key", "hash", 4)
			if (err != nil) != tc.wantFailed || (tc.want != nil && !errors.Is(err, tc.want)) || (tc.want == nil && (errors.Is(err, ErrMissing) || errors.Is(err, ErrCorrupt))) {
				t.Fatalf("classificação inesperada: %v", err)
			}
		})
	}
}
