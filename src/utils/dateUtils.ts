import { moment } from 'obsidian';
import type { CoNotesWeekStart } from '../types';

interface MomentDate {
	format(template: string): string;
	isoWeek(): number;
}

/**
 * Format only brace-wrapped moment expressions, keeping all other path text literal.
 * Square-bracket literals remain supported for compatibility.
 */
export function formatPath(template: string, date: Date): string {
	const formattedDate = moment(date) as MomentDate;
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

/** Number of cells from the previous month before the first day of a month. */
export function getLeadingDayCount(firstDayOfMonth: Date, weekStart: CoNotesWeekStart): number {
	const firstWeekday = weekStart === 'monday' ? 1 : 0;
	return (firstDayOfMonth.getDay() - firstWeekday + 7) % 7;
}

/**
 * Return the Thursday that determines the ISO week containing a displayed row.
 * Using Thursday avoids assigning a Sunday-starting row entirely to the ISO week
 * of its Sunday when the row crosses an ISO week boundary.
 */
export function getIsoWeekReferenceDate(
	weekStartDate: Date,
	weekStart: CoNotesWeekStart,
): Date {
	const firstWeekday = weekStart === 'monday' ? 1 : 0;
	const daysUntilThursday = (4 - firstWeekday + 7) % 7;
	return new Date(
		weekStartDate.getFullYear(),
		weekStartDate.getMonth(),
		weekStartDate.getDate() + daysUntilThursday,
	);
}

/** ISO week number (1-53), consistent with moment's WW format token. */
export function getIsoWeekNumber(date: Date): number {
	return (moment(date) as MomentDate).isoWeek();
}

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

export type CalendarDayType = 'workday' | 'weekend' | 'holiday';

/** Centralized classification allows holiday and adjusted-workday calendars later. */
export function getCalendarDayType(date: Date): CalendarDayType {
	const weekday = date.getDay();
	return weekday === 0 || weekday === 6 ? 'weekend' : 'workday';
}

/** Extract the Thursday of an ISO week from paths such as 2026-W47 or 2026/W47. */
export function extractWeeklyDateFromPath(filePath: string): Date | null {
	const match = filePath.match(/(\d{4})[-/]?W(\d{1,2})(?!\d)/i);
	if (!match) {
		return null;
	}

	const year = parseInt(match[1]!, 10);
	const week = parseInt(match[2]!, 10);
	if (week < 1 || week > 53) {
		return null;
	}

	// ISO week 1 is the week containing January 4; Thursday identifies the week-year.
	const january4 = new Date(year, 0, 4);
	const mondayOfWeek1 = new Date(year, 0, 4 - ((january4.getDay() + 6) % 7));
	return new Date(
		mondayOfWeek1.getFullYear(),
		mondayOfWeek1.getMonth(),
		mondayOfWeek1.getDate() + (week - 1) * 7 + 3,
	);
}

/** Extract the first day of a month from paths such as 2026-11 or 2026/11. */
export function extractMonthlyDateFromPath(filePath: string): Date | null {
	const match = filePath.match(/(\d{4})([-/])(\d{1,2})(?!\d|[-/]\d)/);
	if (!match) {
		return null;
	}

	const month = parseInt(match[3]!, 10);
	if (month < 1 || month > 12) {
		return null;
	}
	return new Date(parseInt(match[1]!, 10), month - 1, 1);
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
