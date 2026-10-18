package postgres

import (
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"time"
)

func Date(t time.Time) pgtype.Date    { return pgtype.Date{Time: t, Valid: true} }
func Text(s string) pgtype.Text       { return pgtype.Text{String: s, Valid: true} }
func NewUUID() pgtype.UUID            { return pgtype.UUID{Bytes: uuid.New(), Valid: true} }
func UUIDString(v pgtype.UUID) string { return uuid.UUID(v.Bytes).String() }
