package style

import (
	"fmt"

	"github.com/fatih/color"
)

// Success prints a success message with a checkmark.
func Success(format string, a ...interface{}) {
	msg := fmt.Sprintf(format, a...)
	fmt.Fprintln(color.Output, IconCheck, ColorSuccess(msg))
}

// Error prints an error message with a cross to stderr.
func Error(format string, a ...interface{}) {
	msg := fmt.Sprintf(format, a...)
	fmt.Fprintln(color.Error, IconCross, ColorError(msg))
}

// Warning prints a warning message with a warning sign.
func Warning(format string, a ...interface{}) {
	msg := fmt.Sprintf(format, a...)
	fmt.Fprintln(color.Output, IconWarning, ColorWarning(msg))
}

// Info prints an informational message with an info icon.
func Info(format string, a ...interface{}) {
	msg := fmt.Sprintf(format, a...)
	fmt.Fprintln(color.Output, IconInfo, White(msg))
}
