package style

import (
	"github.com/fatih/color"
	"github.com/olekukonko/tablewriter"
)

// NewTable creates a new tablewriter.Table with standard styling.
func NewTable(headers []string) *tablewriter.Table {
	table := tablewriter.NewWriter(color.Output)
	table.SetHeader(headers)
	table.SetAutoWrapText(false)
	table.SetAutoFormatHeaders(true)
	table.SetHeaderAlignment(tablewriter.ALIGN_LEFT)
	table.SetAlignment(tablewriter.ALIGN_LEFT)
	table.SetBorder(true)
	table.SetRowLine(true)
	table.SetCenterSeparator("+")
	table.SetColumnSeparator("|")
	table.SetRowSeparator("-")
	table.SetHeaderLine(true)
	return table
}
