import type { JSONContent } from '@tiptap/react';

import type { CachedWeatherSummary, DiaryTranslate, WeatherSummary } from './types';

const DIARY_WEATHER_CACHE_KEY = 'devtree:diaryWeatherSummary';
const WEATHER_CACHE_TTL_MS = 30 * 60 * 1000;

export function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function monthTitle(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function isEmptyDoc(content: JSONContent | null): boolean {
  if (content?.type !== 'doc') return true;
  return !Array.isArray(content.content) || content.content.length === 0;
}

export function getWeatherLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Rain showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Weather';
}

export function getWeatherLabelKey(code: number): string {
  if (code === 0) return 'diary.weather.clear';
  if (code === 1 || code === 2) return 'diary.weather.partlyCloudy';
  if (code === 3) return 'diary.weather.cloudy';
  if (code === 45 || code === 48) return 'diary.weather.fog';
  if (code >= 51 && code <= 67) return 'diary.weather.rain';
  if (code >= 71 && code <= 77) return 'diary.weather.snow';
  if (code >= 80 && code <= 82) return 'diary.weather.rainShowers';
  if (code >= 95) return 'diary.weather.thunderstorm';
  return 'diary.weather.default';
}

export function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code === 1 || code === 2) return '🌤️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code >= 95) return '⛈️';
  return '🌍';
}

function celsiusToUnit(tempC: number, unit: 'c' | 'f'): number {
  if (unit === 'f') return (tempC * 9) / 5 + 32;
  return tempC;
}

export function formatTemp(tempC: number, unit: 'c' | 'f'): string {
  return `${Math.round(celsiusToUnit(tempC, unit))}°${unit.toUpperCase()}`;
}

function compactLocationFromAddress(address?: {
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  country?: string;
}): string {
  if (!address) return '';
  const street = address.road?.trim() ?? '';
  const city = (address.city ?? address.town ?? address.village ?? '').trim();
  const country = address.country?.trim() ?? '';

  return [country, city, street].filter(Boolean).join(', ');
}

export function extractClientPreview(content: JSONContent | null): {
  previewText: string;
  previewImage: string | null;
} {
  if (!content || typeof content !== 'object') {
    return { previewText: '', previewImage: null };
  }

  const textChunks: string[] = [];
  let previewImage: string | null = null;

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const current = node as {
      text?: unknown;
      type?: unknown;
      attrs?: unknown;
      content?: unknown;
    };

    if (typeof current.text === 'string' && current.text.trim()) {
      textChunks.push(current.text.trim());
    }

    if (
      !previewImage &&
      current.type === 'image' &&
      current.attrs &&
      typeof current.attrs === 'object'
    ) {
      const src = (current.attrs as { src?: unknown }).src;
      if (typeof src === 'string' && src.trim()) previewImage = src.trim();
    }

    if (Array.isArray(current.content)) {
      for (const child of current.content) walk(child);
    }
  };

  walk(content);

  return {
    previewText: textChunks.join(' ').split(/\s+/).join(' ').trim().slice(0, 180),
    previewImage,
  };
}

export function templateBodyToContent(body: string): JSONContent {
  const lines = body
    .replaceAll(String.raw`\n`, '\n')
    .replaceAll('\r\n', '\n')
    .split('\n')
    .map((line) => line.trimEnd());

  const blocks: NonNullable<JSONContent['content']> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      blocks.push({ type: 'paragraph' });
      continue;
    }

    if (line.startsWith('### ')) {
      blocks.push(
        {
          type: 'heading',
          attrs: { level: 3, contenteditable: 'false' },
          content: [{ type: 'text', text: line.slice(4).trim() }],
        },
        { type: 'paragraph' },
      );
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(
        {
          type: 'heading',
          attrs: { level: 2, contenteditable: 'false' },
          content: [{ type: 'text', text: line.slice(3).trim() }],
        },
        { type: 'paragraph' },
      );
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push(
        {
          type: 'heading',
          attrs: { level: 1, contenteditable: 'false' },
          content: [{ type: 'text', text: line.slice(2).trim() }],
        },
        { type: 'paragraph' },
      );
      continue;
    }

    blocks.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
  }

  blocks.push({ type: 'paragraph' });

  return { type: 'doc', content: blocks };
}

export function isLegacyTemplateBody(body: string): boolean {
  return !body.trimStart().startsWith('{');
}

export function templateJsonToContent(content: JSONContent): JSONContent {
  const blocks: NonNullable<JSONContent['content']> = [];
  for (const block of content.content ?? []) {
    const isEmptyParagraph =
      block.type === 'paragraph' && (!block.content || block.content.length === 0);
    if (isEmptyParagraph) continue;

    // one editable paragraph after each non-empty block for the cursor to land in
    blocks.push(
      { ...block, attrs: { ...block.attrs, contenteditable: 'false' } },
      { type: 'paragraph' },
    );
  }
  return { type: 'doc', content: blocks };
}

export function extractTextFromContent(content: JSONContent): string {
  const chunks: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === 'text' && node.text) chunks.push(node.text);
    for (const child of node.content ?? []) walk(child);
  };
  walk(content);
  return chunks.join(' ').trim().slice(0, 180);
}

export function stripNonEditableAttrs(content: JSONContent): JSONContent {
  const stripped: JSONContent = { ...content };
  if (stripped.attrs) {
    const attrs = stripped.attrs as Record<string, unknown>;
    const rest = Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'contenteditable'));
    stripped.attrs = Object.keys(rest).length > 0 ? rest : undefined;
  }
  if (Array.isArray(stripped.content)) {
    stripped.content = stripped.content.map(stripNonEditableAttrs);
  }
  return stripped;
}

export function parseTemplateBodyToJson(body: string): JSONContent | null {
  if (isLegacyTemplateBody(body)) return null;
  try {
    const parsed = JSON.parse(body) as unknown;
    if (typeof parsed !== 'object' || parsed === null || (parsed as { type?: unknown }).type !== 'doc') {
      return null;
    }
    return parsed as JSONContent;
  } catch {
    return null;
  }
}

export function decodeTemplateText(value: string): string {
  return value.replaceAll(String.raw`\n`, '\n');
}

export async function fetchWeatherSnapshotForDate(
  dateOnly: string,
  locationEnabled: boolean,
): Promise<WeatherSummary | null> {
  if (!locationEnabled || !('geolocation' in navigator)) return null;

  const cachedRaw = globalThis.localStorage.getItem(DIARY_WEATHER_CACHE_KEY);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as CachedWeatherSummary;
      const isFresh = Date.now() - cached.cachedAt <= WEATHER_CACHE_TTL_MS;
      if (cached.date === dateOnly && isFresh) {
        return {
          tempC: cached.tempC,
          weatherCode: cached.weatherCode,
          weatherLabel: cached.weatherLabel,
          locationName: cached.locationName,
          locationShort: cached.locationShort,
          locationLat: null,
          locationLon: null,
        };
      }
    } catch {
      globalThis.localStorage.removeItem(DIARY_WEATHER_CACHE_KEY);
    }
  }

  return new Promise((resolve) => {
    // eslint-disable-next-line sonarjs/no-intrusive-permissions -- required to capture location snapshot once for user-requested diary metadata
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const [weatherRes, placeRes] = await Promise.all([
            fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`,
            ),
            fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2`,
            ),
          ]);

          if (!weatherRes.ok || !placeRes.ok) {
            resolve(null);
            return;
          }

          const weatherJson = (await weatherRes.json()) as {
            current_weather?: { temperature?: number; weathercode?: number };
          };
          const placeJson = (await placeRes.json()) as {
            display_name?: string;
            address?: {
              house_number?: string;
              road?: string;
              neighbourhood?: string;
              suburb?: string;
              city?: string;
              town?: string;
              village?: string;
              county?: string;
              state?: string;
              country?: string;
            };
          };

          const temp = weatherJson.current_weather?.temperature;
          const weatherCode = weatherJson.current_weather?.weathercode;
          if (typeof temp !== 'number' || typeof weatherCode !== 'number') {
            resolve(null);
            return;
          }

          const locationShort = compactLocationFromAddress(placeJson.address);
          const locationName = (placeJson.display_name ?? locationShort).trim();

          const weatherLabel = getWeatherLabel(weatherCode);

          globalThis.localStorage.setItem(
            DIARY_WEATHER_CACHE_KEY,
            JSON.stringify({
              tempC: temp,
              weatherCode,
              weatherLabel,
              locationName,
              locationShort,
              cachedAt: Date.now(),
              date: dateOnly,
            } satisfies CachedWeatherSummary),
          );

          resolve({
            tempC: temp,
            weatherCode,
            weatherLabel,
            locationName,
            locationShort,
            locationLat: latitude,
            locationLon: longitude,
          });
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

export function getHeaderSubtitle(
  selectedDate: string | null,
  locationShort: string | null | undefined,
  t: DiaryTranslate,
): string {
  if (!selectedDate) return t('diary.selectOrCreate');
  if (!locationShort) return t('diary.locationUnavailable');
  return `${t('diary.locationLabel')}: ${locationShort}`;
}

export { EMPTY_DOC } from '@/lib/tiptapUtils';
