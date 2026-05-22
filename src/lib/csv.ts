import Papa from 'papaparse'

export interface ParsedCSV {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCSV(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve({
          headers: results.meta.fields ?? [],
          rows: results.data,
        })
      },
      error: reject,
    })
  })
}

export function extractNames(rows: Record<string, string>[], column: string): string[] {
  return rows
    .map((row) => row[column]?.trim())
    .filter((name): name is string => Boolean(name))
}
