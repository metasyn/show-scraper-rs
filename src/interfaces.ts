import { FeatureCollection } from 'geojson';

export interface Show {
  venue: string;
  artists: string[];
  date: string;
  details: string;
}

export interface ShowsByDate {
  [key: string]: Show[];
}

export interface DateItem {
  date: string;
  checked: boolean;
}

export interface ParsedData {
  featureCollection: FeatureCollection;
  dates: DateItem[];
}
