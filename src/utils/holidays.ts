import { requestUrl } from 'obsidian';

export interface CalendarHoliday {
	date: string;
	name: string;
	isOffDay: boolean;
}

export const HOLIDAY_COUNTRY_OPTIONS: Record<string, string> = {
	CN: '中国 / China',
	US: 'United States',
	GB: 'United Kingdom',
	JP: '日本 / Japan',
	KR: '대한민국 / South Korea',
	SG: 'Singapore',
	AU: 'Australia',
	CA: 'Canada',
	DE: 'Deutschland / Germany',
	FR: 'France',
	IT: 'Italia / Italy',
	ES: 'España / Spain',
};

const CACHE_KEY = 'co-notes-holidays-v1';
const REQUEST_TIMEOUT_MS = 10_000;
const FAILURE_RETRY_MS = 5 * 60_000;

export function isHolidayCountry(value: unknown): value is string {
	return value === '' || (typeof value === 'string' && /^[A-Z]{2}$/.test(value));
}

/** Load and cache public holidays without blocking calendar rendering. */
export class HolidayService {
	private readonly cache: Record<string, CalendarHoliday[]>;
	private readonly pending = new Map<string, Promise<void>>();
	private readonly failedAt = new Map<string, number>();

	constructor(
		private readonly getCountry: () => string,
		private readonly onLoaded: () => void,
	) {
		this.cache = readCache();
	}

	ensureYear(year: number): void {
		const country = this.getCountry();
		if (!country) return;
		const key = getCacheKey(country, year);
		if (this.cache[key] || this.pending.has(key)) return;
		const lastFailure = this.failedAt.get(key) ?? 0;
		if (Date.now() - lastFailure < FAILURE_RETRY_MS) return;

		const request = this.fetchYear(country, year)
			.then((days) => {
				this.cache[key] = days;
				this.failedAt.delete(key);
				writeCache(this.cache);
				this.onLoaded();
			})
			.catch(() => {
				// Keep the regular weekend calendar when the network or source fails.
				this.failedAt.set(key, Date.now());
			})
			.finally(() => this.pending.delete(key));
		this.pending.set(key, request);
	}

	getHoliday(date: Date): CalendarHoliday | undefined {
		const country = this.getCountry();
		if (!country) return undefined;
		const days = this.cache[getCacheKey(country, date.getFullYear())];
		const dateKey = formatDateKey(date);
		return days?.find((day) => day.date === dateKey);
	}

	private async fetchYear(country: string, year: number): Promise<CalendarHoliday[]> {
		if (country === 'CN') {
			const path = `${year}.json`;
			try {
				return parseChinaHolidays(await requestJson(
					`https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${path}`,
				));
			} catch {
				return parseChinaHolidays(await requestJson(
					`https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${path}`,
				));
			}
		}

		return parseNagerHolidays(await requestJson(
			`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
		));
	}
}

export function parseChinaHolidays(value: unknown): CalendarHoliday[] {
	if (typeof value !== 'object' || value === null || !('days' in value) || !Array.isArray(value.days)) {
		throw new Error('Invalid China holiday data');
	}
	return value.days.map(parseHoliday).filter((day): day is CalendarHoliday => day !== null);
}

export function parseNagerHolidays(value: unknown): CalendarHoliday[] {
	if (!Array.isArray(value)) throw new Error('Invalid public holiday data');
	return value
		.filter((day: unknown) => typeof day === 'object' && day !== null && (!('global' in day) || day.global === true))
		.map(parseHoliday)
		.filter((day): day is CalendarHoliday => day !== null)
		.map((day) => ({ ...day, isOffDay: true }));
}

function parseHoliday(value: unknown): CalendarHoliday | null {
	if (typeof value !== 'object' || value === null) return null;
	const date = 'date' in value ? value.date : undefined;
	const name = 'name' in value ? value.name : undefined;
	if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
	if (typeof name !== 'string' || !name) return null;
	return {
		date,
		name,
		isOffDay: !('isOffDay' in value) || value.isOffDay === true,
	};
}

async function requestJson(url: string): Promise<unknown> {
	let timeout: number | undefined;
	try {
		const response = await Promise.race([
			requestUrl(url),
			new Promise<never>((_, reject) => {
				timeout = window.setTimeout(() => reject(new Error('Holiday request timed out')), REQUEST_TIMEOUT_MS);
			}),
		]);
		return response.json as unknown;
	} finally {
		if (timeout !== undefined) window.clearTimeout(timeout);
	}
}

function getCacheKey(country: string, year: number): string {
	return `${country}-${year}`;
}

function formatDateKey(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

function readCache(): Record<string, CalendarHoliday[]> {
	try {
		const value: unknown = JSON.parse(activeWindow.localStorage.getItem(CACHE_KEY) ?? '{}');
		if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
		const result: Record<string, CalendarHoliday[]> = {};
		for (const [key, days] of Object.entries(value)) {
			if (!/^[A-Z]{2}-\d{4}$/.test(key) || !Array.isArray(days)) continue;
			result[key] = days.map(parseHoliday).filter((day): day is CalendarHoliday => day !== null);
		}
		return result;
	} catch {
		return {};
	}
}

function writeCache(cache: Record<string, CalendarHoliday[]>): void {
	try {
		activeWindow.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
	} catch {
		// In-memory caching still works when storage is unavailable or full.
	}
}
