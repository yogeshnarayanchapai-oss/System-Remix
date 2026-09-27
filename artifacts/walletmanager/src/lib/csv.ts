type CsvValue = string | number | null | undefined;

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
  const escapeCell = (value: CsvValue) => {
    let text = value == null ? '' : String(value);
    if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
  };

  const content = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}