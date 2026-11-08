import { moment } from 'obsidian';

interface MomentDateFormatter {
	format(template: string): string;
}

/**
 * Format only brace-wrapped moment expressions, keeping all other path text literal.
 * Square-bracket literals remain supported for compatibility.
 */
export function formatPath(template: string, date: Date): string {
	const formattedDate = moment(date) as MomentDateFormatter;
	let result = '';
	let index = 0;

	while (index < template.length) {
		const current = template[index];
		const closingBracket = current === '[' ? ']' : current === '{' ? '}' : null;

		if (closingBracket) {
			const closingIndex = template.indexOf(closingBracket, index + 1);
			if (closingIndex !== -1) {
				const content = template.slice(index + 1, closingIndex);
				result += current === '{' ? formattedDate.format(content) : content;
				index = closingIndex + 1;
				continue;
			}
		}

		result += current ?? '';
		index++;
	}

	return result;
}

/**
 * Return the vault-relative file path for a given template and date.
 * Appends ".md" if the template does not already end with it.
 */
export function getFilePath(template: string, date: Date): string {
	const path = formatPath(template, date);
	return path.endsWith('.md') ? path : `${path}.md`;
}

/** ISO week number (1-53), consistent with moment's WW format token. */
export function getIsoWeekNumber(date: Date): number {
	return moment(date).isoWeek();
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/**
 * Try to extract a calendar date from a file path.
 * Supports common patterns like YYYY-MM-DD, YYYY/MM/DD, and YYYYMMDD.
 */
export function extractDateFromPath(filePath: string): Date | null {
	// YYYY-MM-DD or YYYY/MM/DD with a consistent separator.
	// The negative lookahead prevents partial matches like "2026/11/20" inside "2026/11/2026".
	let match = filePath.match(/(\d{4})([-/])(\d{1,2})\2(\d{1,2})(?!\d)/);
	if (match) {
		return new Date(
			parseInt(match[1]!, 10),
			parseInt(match[3]!, 10) - 1,
			parseInt(match[4]!, 10),
		);
	}

	// YYYYMMDD
	match = filePath.match(/(\d{4})(\d{2})(\d{2})(?!\d)/);
	if (match) {
		return new Date(
			parseInt(match[1]!, 10),
			parseInt(match[2]!, 10) - 1,
			parseInt(match[3]!, 10),
		);
	}

	return null;
}
