// cli/src/csv_parser.ts
/**
 * A generic, dependency-free CSV parser that converts CSV content into an array of objects.
 * It is resilient to column order and extra columns.
 *
 * @param fileContent The raw string content of the CSV file.
 * @param requiredHeaders An array of strings representing the column headers that MUST be present.
 * @returns An array of objects, where each object represents a row.
 * @throws An error if any of the required headers are not found.
 */
function parseCsv(fileContent, requiredHeaders) {
    const lines = fileContent.split(/\r?\n/);
    if (lines.length === 0) {
        return [];
    }
    const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const missingHeaders = requiredHeaders.filter(reqHeader => !header.includes(reqHeader));
    if (missingHeaders.length > 0) {
        throw new Error(`CSV file is missing required headers: ${missingHeaders.join(', ')}`);
    }
    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        const values = line.split(',');
        const rowObject = {};
        for (let j = 0; j < header.length; j++) {
            const headerName = header[j];
            const value = (values[j] || '').trim().replace(/^"|"$/g, '');
            rowObject[headerName] = value;
        }
        records.push(rowObject);
    }
    return records;
}
/**
 * A specific utility that uses the generic parser to extract ONLY the 'componentId' column.
 * @param fileContent The raw string content of the CSV file.
 * @returns An array of trimmed, non-empty component IDs.
 */
export function parseComponentIdCsv(fileContent) {
    const records = parseCsv(fileContent, ['componentId']);
    return records.map(record => record.componentId).filter(Boolean);
}
/**
 * A specific utility that uses the generic parser for bulk-importing mappings.
 * It requires 'mainComponentId' and 'testComponentId' headers.
 * It also supports optional 'testComponentName', 'isDeployed', and 'isPackage' columns.
 *
 * @param fileContent The raw string content of the CSV file.
 * @returns An array of mapping objects suitable for the API.
 */
export function parseMappingCsv(fileContent) {
    const requiredHeaders = ['mainComponentId', 'testComponentId'];
    const records = parseCsv(fileContent, requiredHeaders);
    return records.map(record => {
        // Coerce string 'true'/'false' to boolean, otherwise undefined
        const isDeployed = record.isDeployed ? record.isDeployed.toLowerCase() === 'true' : undefined;
        const isPackage = record.isPackage ? record.isPackage.toLowerCase() === 'true' : undefined;
        return {
            mainComponentId: record.mainComponentId,
            testComponentId: record.testComponentId,
            testComponentName: record.testComponentName || undefined,
            isDeployed: isDeployed,
            isPackage: isPackage,
        };
    }).filter(r => r.mainComponentId && r.testComponentId);
}
