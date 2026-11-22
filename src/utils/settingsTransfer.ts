import {
	type CalendarViewConfig,
	type CoNotesSettings,
	type CoNotesLanguage,
	type CoNotesWeekStart,
	type NoteSource,
	type NoteCategory,
	normalizeDayCellMinHeight,
	normalizeSourceIndicatorHeight,
} from '../types';
import { normalizeSourceCategories } from './sourceCategories';

export interface SettingsExport {
	contents: string;
	filename: string;
}

export function createSettingsExport(
	settings: CoNotesSettings,
	exportedAt = new Date(),
): SettingsExport {
	const year = exportedAt.getFullYear();
	const month = String(exportedAt.getMonth() + 1).padStart(2, '0');
	const day = String(exportedAt.getDate()).padStart(2, '0');

	return {
		contents: `${JSON.stringify(settings, null, 2)}\n`,
		filename: `co-notes-settings-${year}-${month}-${day}.json`,
	};
}

export function parseSettingsImport(contents: string): CoNotesSettings {
	const value: unknown = JSON.parse(contents);
	const record = expectRecord(value);
	const language = expectString(record, 'language');
	if (!isLanguage(language)) {
		throw new Error('Invalid settings language');
	}
	const weekStart = record.weekStart ?? 'monday';
	if (!isWeekStart(weekStart)) {
		throw new Error('Invalid week start setting');
	}
	if (typeof record.confirmBeforeCreate !== 'boolean') {
		throw new Error('Invalid create-note confirmation setting');
	}
	if (record.highlightWeekends !== undefined && typeof record.highlightWeekends !== 'boolean') {
		throw new Error('Invalid weekend highlighting setting');
	}
	if (
		record.holidayCountry !== undefined &&
		(typeof record.holidayCountry !== 'string' ||
			(record.holidayCountry !== '' && !/^[A-Z]{2}$/.test(record.holidayCountry)))
	) {
		throw new Error('Invalid holiday country setting');
	}
	if (!Array.isArray(record.calendarViews)) {
		throw new Error('Invalid calendar views');
	}

	return {
		confirmBeforeCreate: record.confirmBeforeCreate,
		globalSourceIndicatorHeight: normalizeSourceIndicatorHeight(
			expectNumber(record, 'globalSourceIndicatorHeight'),
		),
		globalDayCellMinHeight: normalizeDayCellMinHeight(
			expectNumber(record, 'globalDayCellMinHeight'),
		),
		highlightWeekends: record.highlightWeekends ?? true,
		holidayCountry: record.holidayCountry ?? '',
		language,
		weekStart,
		calendarViews: record.calendarViews.map(parseCalendarView),
	};
}

function parseCalendarView(value: unknown): CalendarViewConfig {
	const record = expectRecord(value);
	if (!Array.isArray(record.sources)) {
		throw new Error('Invalid note sources');
	}

	const view: CalendarViewConfig = {
		id: expectString(record, 'id'),
		name: expectString(record, 'name'),
		sources: record.sources.map(parseNoteSource),
	};
	copyOptionalSources(record, 'weeklySources', 'weeklySource', view);
	copyOptionalSources(record, 'monthlySources', 'monthlySource', view);
	copyOptionalNumber(record, 'sourceIndicatorHeight', view);
	copyOptionalNumber(record, 'dayCellMinHeight', view);
	if (record.categories !== undefined) {
		if (!Array.isArray(record.categories)) throw new Error('Invalid source categories');
		view.categories = record.categories.map(parseNoteCategory);
	}
	return normalizeSourceCategories(view);
}

function parseNoteSource(value: unknown): NoteSource {
	const record = expectRecord(value);
	const source: NoteSource = {
		id: expectString(record, 'id'),
		name: expectString(record, 'name'),
		pathTemplate: expectString(record, 'pathTemplate'),
		color: expectString(record, 'color'),
	};
	copyOptionalString(record, 'categoryId', source);
	copyOptionalString(record, 'checkboxProperty', source);
	copyOptionalString(record, 'markerSymbol', source);
	return source;
}

function parseNoteCategory(value: unknown): NoteCategory {
	const record = expectRecord(value);
	return {
		id: expectString(record, 'id'),
		name: expectString(record, 'name'),
		color: expectString(record, 'color'),
	};
}

function copyOptionalSources(
	record: Record<string, unknown>,
	key: 'weeklySources' | 'monthlySources',
	legacyKey: 'weeklySource' | 'monthlySource',
	target: CalendarViewConfig,
): void {
	const value = record[key];
	if (Array.isArray(value)) {
		target[key] = value.map(parseNoteSource);
		return;
	}

	// Import legacy single-source format (v0.4.3 and earlier).
	const legacy = record[legacyKey];
	if (legacy !== undefined) {
		target[key] = [parseNoteSource(legacy)];
	}
}

function copyOptionalString(
	record: Record<string, unknown>,
	key: 'categoryId' | 'checkboxProperty' | 'markerSymbol',
	target: NoteSource,
): void {
	const value = record[key];
	if (value === undefined) {
		return;
	}
	if (typeof value !== 'string') {
		throw new Error(`Invalid ${key}`);
	}
	target[key] = value;
}

function copyOptionalNumber(
	record: Record<string, unknown>,
	key: 'sourceIndicatorHeight' | 'dayCellMinHeight',
	target: CalendarViewConfig,
): void {
	const value = record[key];
	if (value === undefined) {
		return;
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`Invalid ${key}`);
	}
	target[key] = value;
}

function expectRecord(value: unknown): Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new Error('Invalid Co Notes settings');
	}
	return value as Record<string, unknown>;
}

function expectString(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	if (typeof value !== 'string') {
		throw new Error(`Invalid ${key}`);
	}
	return value;
}

function expectNumber(record: Record<string, unknown>, key: string): number {
	const value = record[key];
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`Invalid ${key}`);
	}
	return value;
}

function isLanguage(value: string): value is CoNotesLanguage {
	return value === 'system' || value === 'zh-CN' || value === 'en';
}

function isWeekStart(value: unknown): value is CoNotesWeekStart {
	return value === 'monday' || value === 'sunday';
}
