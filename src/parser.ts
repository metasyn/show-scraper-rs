import { venues } from "./geocoded.json";
import { DateTime } from "luxon";
import { Feature, FeatureCollection } from "geojson";
import { Show, ShowsByDate, DateItem, ParsedData } from "./interfaces";

const isDev = () => window.location.host.includes("localhost");

export default class Parser {
  static async getShowJson(): Promise<Show[]> {
    const list = isDev()
      ? "http://localhost:8000/scrape/foopee"
      : "https://metasyn.pw/show-scraper";
    try {
      return await fetch(list).then((r) => r.json());
    } catch (err) {
      return err;
    }
  }

  static async get19hzJson(): Promise<Show[]> {
    const list = isDev()
      ? "http://localhost:8000/scrape/19hz"
      : "https://metasyn.pw/show-scraper/19hz";
    try {
      return await fetch(list).then((r) => r.json());
    } catch (err) {
      return err;
    }
  }

  static async parseData(): Promise<ParsedData> {
    const [dataTheList, data19hz] = await Promise.all([
      Parser.getShowJson(),
      Parser.get19hzJson(),
    ]);

    const data = dataTheList.concat(data19hz);

    const showsByDate: ShowsByDate = Parser.sortByDate(data);
    return {
      featureCollection: Parser.geojsonify(showsByDate),
      dates: Parser.getDates(showsByDate),
    };
  }

  static getDates(organized: ShowsByDate): DateItem[] {
    return Object.keys(organized).map((x) => {
      return { date: x, checked: true };
    });
  }

  static sortByDate(data: Show[]): ShowsByDate {
    const organized = {};
    for (let i = 0; i < data.length; i += 1) {
      if (!organized[data[i].date]) {
        organized[data[i].date] = [];
      }
      organized[data[i].date].push(data[i]);
    }
    return organized;
  }

  static geojsonify(data: ShowsByDate): FeatureCollection {
    const features: Feature[] = [];
    const dateKeys = Object.keys(data);

    // loop through dates
    for (let i = 0; i < dateKeys.length; i += 1) {
      // loop through shows
      for (let j = 0; j < data[dateKeys[i]].length; j += 1) {
        const item = data[dateKeys[i]][j];
        const venueList = Object.keys(venues);

        // check for misspellings
        if (!venues[item.venue]) {
          try {
            for (let v = 0; v < venueList.length; v += 1) {
              const misspelled = item.venue.replace(/\W/g, "").toLowerCase();
              const spelledCorrect = venueList[v]
                .replace(/\W/g, "")
                .toLowerCase();
              const editDistance = Parser.getEditDistance(
                misspelled,
                spelledCorrect
              );
              if (editDistance <= 2) {
                console.log(
                  `'${item.venue}' has been replaced with '${venueList[v]}'`
                );
                item.venue = venueList[v];
              }
            }
          } catch (e) {
            console.log("Missing Venue?", e);
          }
        }

        const coordinates = venues[item.venue]
          ? venues[item.venue].coordinates
          : [-122.42296, 37.826524]; // alcatraz

        const show: Feature = {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates,
          },
          properties: {
            sid: `${i}-${j}`,
            date: dateKeys[i],
            venue: item.venue,
            artists: item.artists,
            details: item.details
              .replace(/ ,/g, "") // too many commas
              .replace("***", ""), // unuseful
          },
        };

        // add show to features array
        features.push(show);
      }
    }

    // format for valid geojson
    const output: FeatureCollection = {
      type: "FeatureCollection",
      features,
    };
    return output;
  }

  // Compute the edit distance between the two given strings
  static getEditDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    // increment along the first column of each row
    let i: number;
    for (i = 0; i <= b.length; i += 1) {
      matrix[i] = [i];
    }

    // increment each column in the first row
    let j: number;
    for (j = 0; j <= a.length; j += 1) {
      matrix[0][j] = j;
    }

    // Fill in the rest of the matrix
    for (i = 1; i <= b.length; i += 1) {
      for (j = 1; j <= a.length; j += 1) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            Math.min(
              matrix[i][j - 1] + 1, // insertion
              matrix[i - 1][j] + 1
            )
          ); // deletion
        }
      }
    }

    return matrix[b.length][a.length];
  }

  static formatDate(dateString: string): string {
    const date = DateTime.fromISO(dateString); // force pacific timezone
    date.setZone("America/Los_Angeles");
    return `${date.month}-${date.day} ${date.weekdayShort} `;
  }
}
