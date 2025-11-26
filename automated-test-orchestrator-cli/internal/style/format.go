package style

import (
	"fmt"
	"time"
)

// ID formats an identifier (like a UUID or short ID) consistently.
func ID(id string) string {
	return ColorID(id)
}

// Header formats a section header.
func Header(text string) string {
	return ColorHeader(text)
}

// LabelValue formats a key-value pair (e.g., "Status: Active").
func LabelValue(label string, value interface{}) string {
	return fmt.Sprintf("%s: %v", Faint(label), value)
}

// Time formats a timestamp in a standard way.
func Time(t time.Time) string {
	return t.Format(time.RFC3339)
}

// KeyValue prints a formatted key-value line to stdout.
func PrintKV(key string, value interface{}) {
	fmt.Println(LabelValue(key, value))
}
