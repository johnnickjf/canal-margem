// Package objectstore stores immutable, content-addressed raw bytes in Cloudflare R2
// through its S3-compatible API (LocalStack in integration tests).
package objectstore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"io"
	"margem/backend/internal/platform/canonical"
	"net/http"
	"os"
	"time"
)

type Store interface {
	Save(context.Context, []byte) (string, string, error)
	Verify(context.Context, string, string, int64) error
}

var ErrMissing = errors.New("objeto raw ausente")
var ErrCorrupt = errors.New("objeto raw corrompido")

type S3 struct {
	Client *s3.Client
	Bucket string
}

func FromEnv(ctx context.Context) (*S3, error) {
	bucket, endpoint := os.Getenv("RAW_BUCKET"), os.Getenv("S3_ENDPOINT_URL")
	if bucket == "" || endpoint == "" {
		return nil, fmt.Errorf("RAW_BUCKET e S3_ENDPOINT_URL são obrigatórios")
	}
	region := os.Getenv("AWS_DEFAULT_REGION")
	if region == "" {
		region = "auto"
	}
	c, e := config.LoadDefaultConfig(ctx, config.WithRegion(region), config.WithRetryMaxAttempts(3), config.WithHTTPClient(&http.Client{Timeout: 60 * time.Second}))
	if e != nil {
		return nil, e
	}
	client := s3.NewFromConfig(c, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
		o.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
		o.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
	})
	return &S3{client, bucket}, nil
}
func (s *S3) Save(ctx context.Context, body []byte) (string, string, error) {
	sha := canonical.Hash(body)
	key := "raw/sha256/" + sha
	_, e := s.Client.PutObject(ctx, &s3.PutObjectInput{Bucket: &s.Bucket, Key: &key, Body: bytes.NewReader(body), IfNoneMatch: aws.String("*")})
	if e != nil {
		var response *smithyhttp.ResponseError
		if !errors.As(e, &response) || response.HTTPStatusCode() != 412 {
			return "", "", e
		}
	}
	if e = s.Verify(ctx, key, sha, int64(len(body))); e != nil {
		return "", "", e
	}
	return sha, key, nil
}
func (s *S3) Verify(ctx context.Context, key, sha string, size int64) error {
	if size < 0 {
		return fmt.Errorf("tamanho raw inválido")
	}
	r, e := s.Client.GetObject(ctx, &s3.GetObjectInput{Bucket: &s.Bucket, Key: &key})
	if e != nil {
		var apiError smithy.APIError
		if errors.As(e, &apiError) && apiError.ErrorCode() == "NoSuchKey" {
			return ErrMissing
		}
		return e
	}
	defer r.Body.Close()
	b, e := io.ReadAll(io.LimitReader(r.Body, size+1))
	if e != nil {
		return e
	}
	if int64(len(b)) != size || canonical.Hash(b) != sha {
		return ErrCorrupt
	}
	return nil
}

// ProjectionFromEnv deliberately uses a different bucket from private raw data.
func ProjectionFromEnv(ctx context.Context) (*S3, error) {
	s, e := FromEnv(ctx)
	if e != nil {
		return nil, e
	}
	bucket := os.Getenv("PUBLIC_BUCKET")
	if bucket == "" || bucket == s.Bucket {
		return nil, fmt.Errorf("PUBLIC_BUCKET deve ser distinto de RAW_BUCKET")
	}
	s.Bucket = bucket
	return s, nil
}

func (s *S3) SaveProjection(ctx context.Context, key string, body []byte) error {
	_, e := s.Client.PutObject(ctx, &s3.PutObjectInput{Bucket: &s.Bucket, Key: &key, Body: bytes.NewReader(body), IfNoneMatch: aws.String("*"), ContentType: aws.String("application/json; charset=utf-8"), CacheControl: aws.String("public, max-age=31536000, immutable")})
	if e != nil {
		var response *smithyhttp.ResponseError
		if !errors.As(e, &response) || response.HTTPStatusCode() != 412 {
			return e
		}
	}
	return s.Verify(ctx, key, canonical.Hash(body), int64(len(body)))
}

func (s *S3) LoadProjection(ctx context.Context, key, sha string, size int64) ([]byte, error) {
	if size < 1 || size > 16*1024*1024 {
		return nil, fmt.Errorf("projeção excede limite")
	}
	r, e := s.Client.GetObject(ctx, &s3.GetObjectInput{Bucket: &s.Bucket, Key: &key})
	if e != nil {
		return nil, e
	}
	defer r.Body.Close()
	b, e := io.ReadAll(io.LimitReader(r.Body, size+1))
	if e != nil {
		return nil, e
	}
	if int64(len(b)) != size || canonical.Hash(b) != sha {
		return nil, fmt.Errorf("projeção ausente ou corrompida")
	}
	return b, nil
}
