package style

import "github.com/fatih/color"

// Palette defines the standard colors used across the CLI.
var (
	// Core Colors
	Cyan   = color.New(color.FgCyan).SprintFunc()
	Green  = color.New(color.FgGreen).SprintFunc()
	Red    = color.New(color.FgRed).SprintFunc()
	Yellow = color.New(color.FgYellow).SprintFunc()
	White  = color.New(color.FgWhite).SprintFunc()
	Faint  = color.New(color.Faint).SprintFunc()
	Bold   = color.New(color.Bold).SprintFunc()

	// Semantic Colors
	ColorID      = Cyan
	ColorSuccess = Green
	ColorError   = Red
	ColorWarning = Yellow
	ColorHeader  = color.New(color.FgWhite, color.Bold).SprintFunc()

	// Badges
	BadgePass = color.New(color.BgGreen, color.FgBlack, color.Bold).SprintFunc()
	BadgeFail = color.New(color.BgRed, color.FgWhite, color.Bold).SprintFunc()
)

// Icons defines standard symbols.
const (
	IconCheck   = "✅"
	IconCross   = "❌"
	IconWarning = "⚠️"
	IconInfo    = "ℹ️"
	IconBox     = "📦"
	IconArrow   = "➜"
)
