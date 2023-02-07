import maplibregl from "maplibre-gl";

import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";

import { Feature, FeatureCollection, Point } from "geojson";

import "./styles.css";
import Parser from "./parser";
import { DateItem } from "./interfaces";
import { DateTime } from "luxon";

const showsSource = "shows";
const clustersLayer = "clusters";
const clusterCountLayer = "cluster-count";
const showLayer = "show";
const start = {
  // start in the mission
  lng: -122.416,
  lat: 37.76,
  zoom: 12,
};

class MapHandler {
  // These three things are initialized and become the basis for
  // all other operations going forward by this class.
  map: maplibregl.Map;
  featureCollection: FeatureCollection;
  dates: DateItem[];
  popup: maplibregl.Popup;

  constructor() {
    this.map = this.createMap();
    this.popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
    });
    const parsed = Parser.parseData();

    parsed.then(({ featureCollection, dates }) => {
      this.featureCollection = featureCollection;
      this.dates = dates;
      this.setupMap();
      this.setupDates();
      this.updateListingsAndMap();
      this.addListeners();

      // this.devTools();
    });
  }

  createMap(): maplibregl.Map {
    const map = new maplibregl.Map({
      container: "map", // container id
      // See https://docs.mapbox.com/mapbox-gl-js/example/map-tiles/
      // for the example of using raster tiles this way
      style: {
        version: 8,
        sources: {
          "raster-tiles": {
            type: "raster",
            tiles: [
              "https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution:
              'Map tiles by <a target="_top" rel="noopener" href="http://stamen.com">Stamen Design</a>, under <a target="_top" rel="noopener" href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a>. Data by <a target="_top" rel="noopener" href="http://openstreetmap.org">OpenStreetMap</a>, under <a target="_top" rel="noopener" href="http://creativecommons.org/licenses/by-sa/3.0">CC BY SA</a>',
          },
        },
        layers: [
          {
            id: "simple-tiles",
            type: "raster",
            source: "raster-tiles",
            minzoom: 0,
            maxzoom: 22,
          },
        ],
        // need to add this for cluster count "glyphs"
        glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
      },
      center: [start.lng, start.lat],
      zoom: start.zoom,
    });

    // Add locator control
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: false,
      })
    );

    return map;
  }

  setupMap(): void {
    this.map.on("load", () => {
      // Add the actual shows
      this.map.addSource(showsSource, {
        type: "geojson",
        data: this.featureCollection,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Main layer
      this.map.addLayer({
        id: showLayer,
        type: "circle",
        source: showsSource,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#4CAF50",
          "circle-radius": 10,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#fff",
        },
      });

      this.map.addLayer({
        id: clustersLayer,
        type: "circle",
        source: showsSource,
        filter: ["has", "point_count"],
        paint: {
          // Use step expressions (https://www.mapbox.com/mapbox-gl-js/style-spec/#expressions-step)
          // with three steps to implement three types of circles:
          "circle-color": [
            "step",
            ["get", "point_count"],
            "#51bbd6",
            50,
            "#f1f075",
            100,
            "#f28cb1",
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            20,
            50,
            30,
            100,
            40,
          ],
        },
      });

      this.map.addLayer({
        id: clusterCountLayer,
        type: "symbol",
        source: showsSource,
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          // Needs to be a font that is available
          // from https://github.com/openmaptiles/fonts
          "text-font": ["Open Sans Bold"],
          "text-size": 12,
        },
      });

      // inspect a cluster on click
      this.map.on("click", clustersLayer, (e) => {
        const features = this.map.queryRenderedFeatures(e.point, {
          layers: [clustersLayer],
        });
        const clusterId = features[0].properties.cluster_id;
        const source: maplibregl.GeoJSONSource = this.map.getSource(
          showsSource
        ) as maplibregl.GeoJSONSource;

        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err || !zoom) return;
          const item = features[0].geometry;
          if (item.type == "Point") {
            this.map.easeTo({
              center: [item.coordinates[0], item.coordinates[1]],
              zoom: zoom + 1, // extra zooming
            });
          }
        });
      });

      // When a click event occurs on a feature in
      // the unclustered-point layer, open a popup at
      // the location of the feature, with
      // description HTML from its properties.
      this.map.on("click", showLayer, (e) => {
        if (e && e.features && e.features[0].geometry.type == "Point") {
          const item = e.features[0];
          const geometry = item.geometry as Point;
          const coordinates = geometry.coordinates.slice();

          // TODO is this needed?
          // Ensure that if the map is zoomed out such that
          // multiple copies of the feature are visible, the
          // popup appears over the copy being pointed to.
          while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
          }

          const container = document.createElement("div");
          container.classList.add("popup-listing");

          // Get all shows related to this point, even if
          // we've clikced on particular date
          const venue = e.features[0].properties?.venue;
          this.map
            .queryRenderedFeatures()
            .filter((x) => x.properties?.venue === venue)
            .sort((a, b) => a.properties?.date > b.properties?.date)
            .forEach((x) => {
              container.appendChild(
                this.makeShowDetailsHtml(x.properties, true)
              );
            });

          // Attach single venue
          const p = document.createElement("p");
          p.innerText = venue;
          p.setAttribute("class", "venue");
          const html = p.outerHTML + container.outerHTML;

          this.popup
            .setLngLat([coordinates[0], coordinates[1]])
            .setHTML(html)
            .addTo(this.map);
        }
      });

      this.map.on("mouseenter", clustersLayer, () => {
        this.map.getCanvas().style.cursor = "pointer";
      });

      this.map.on("mouseleave", clustersLayer, () => {
        this.map.getCanvas().style.cursor = "";
      });

      this.map.on("move", () => {
        this.updateListingsAndMap();
      });
    });
  }

  makeShowDetailsHtml(
    props: GeoJSON.GeoJsonProperties,
    skipVenue = false
  ): HTMLDivElement {
    const div = document.createElement("div");
    div.setAttribute("class", "listing-item");

    if (props) {
      ["venue", "date", "details", "artists"].forEach((x) => {
        if (props[x] !== undefined) {
          switch (x) {
            case "artists":
              {
                const li = document.createElement("li");
                // TODO: why is this ever a string?
                const artists =
                  typeof props[x] === "string"
                    ? JSON.parse(props[x])
                    : props[x];

                artists.forEach((a: string) => {
                  const ul = document.createElement("ul");
                  ul.innerText = a;
                  li.append(ul);
                });
                div.appendChild(li);
              }
              break;
            default: {
              if (skipVenue && x === "venue") {
                break;
              }
              const p = document.createElement("p");
              p.innerText = props[x];
              p.classList.add(x);
              div.appendChild(p);
            }
          }
        }
      });
    }
    return div;
  }

  updateListingsAndMap(): void {
    const bounds = this.map.getBounds();

    const filtered = this.featureCollection.features.filter((f) => {
      if (f.geometry.type === "Point") {
        const onMap = bounds.contains([
          f.geometry.coordinates[0],
          f.geometry.coordinates[1],
        ]);
        const validDate = this.isSelected(f.properties?.date);
        return onMap && validDate;
      }
      return false;
    });

    // Filter on source, for clusters
    const source: maplibregl.GeoJSONSource = this.map.getSource(
      showsSource
    ) as maplibregl.GeoJSONSource;

    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: filtered,
      });
    }

    // Filter listings
    const listingEl = document.getElementById("listing");
    if (listingEl) {
      listingEl.innerHTML = "";

      filtered.forEach((f) => {
        const div = this.makeShowDetailsHtml(f.properties);
        div.setAttribute("class", "listing-item");

        const setPopup = (f: Feature) => {
          if (f.geometry.type === "Point") {
            this.popup
              .setLngLat([f.geometry.coordinates[0], f.geometry.coordinates[1]])
              .setHTML(div.outerHTML)
              .addTo(this.map);
          }
        };

        const easeTo = (f: Feature) => {
          if (f.geometry.type === "Point") {
            this.map.easeTo({
              center: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
              zoom: 16,
              duration: 1000,
            });
          }
        };

        div.addEventListener("click", () => {
          setPopup(f);
          easeTo(f);

          // If we're on mobile, hide the listings after click
          const showMapButton = document.getElementById("show-map-button");
          if (showMapButton) {
            // showMapButton.click();
          }
        });

        div.addEventListener("mouseover", () => {
          setPopup(f);
        });

        listingEl.appendChild(div);
      });

      listingEl.addEventListener("hover", (e) => {
        console.log(e);
      });
    }
  }

  setupDates(): void {
    // Set the main dates
    this.setDates(this.dates);
    const dateStrings = this.getDateStrings();

    const dateSelectors = document.getElementById("date-selectors");

    if (dateSelectors) {
      dateStrings.forEach((s) => {
        const p = document.createElement("p");
        const label = document.createElement("label");
        label.setAttribute("for", s);

        const check = document.createElement("input");
        check.setAttribute("id", s);
        check.setAttribute("type", "checkbox");
        check.setAttribute("checked", "true");

        label.appendChild(check);
        label.appendChild(document.createTextNode(s));

        p.appendChild(label);

        check.addEventListener("click", (e) => {
          const el = e.target as HTMLInputElement;
          this.setDate(el.id, el.checked);
        });

        dateSelectors.appendChild(p);
      });
    }
  }

  syncDateSelector(): void {
    document.querySelectorAll("#date-selectors input").forEach((i) => {
      const t = i as HTMLInputElement;
      t.checked = this.isSelected(t.id);
    });
  }

  addListeners(): void {
    const filterButton = document.getElementById("filter-button");
    const hideFilterButton = document.getElementById("hide-filter-button");
    const resetFilterButton = document.getElementById("reset-filter-button");
    const filters = document.getElementById("filters");
    const todayButton = document.getElementById("today-button");
    const tomorrowButton = document.getElementById("tomorrow-button");
    const byDateButton = document.getElementById("by-date-button");

    const map = document.getElementById("map");
    const mapOverlay = document.getElementById("map-overlay");

    const dateSelectors = document.getElementById("date-selectors");
    const showMapButton = document.getElementById("show-map-button");
    const showListButton = document.getElementById("show-list-button");

    filterButton?.addEventListener("click", () => {
      filterButton.classList.toggle("hidden");
      hideFilterButton?.classList.toggle("hidden");
      resetFilterButton?.classList.toggle("hidden");
      filters?.classList.toggle("hidden");
    });

    hideFilterButton?.addEventListener("click", () => {
      filterButton?.classList.toggle("hidden");
      hideFilterButton.classList.toggle("hidden");
      resetFilterButton?.classList.toggle("hidden");
      filters?.classList.toggle("hidden");
      dateSelectors?.classList.add("hidden");
    });

    showMapButton?.addEventListener("click", () => {
      map?.classList.remove("hidden");
      mapOverlay?.classList.add("hidden");
    });

    showListButton?.addEventListener("click", () => {
      map?.classList.add("hidden");
      mapOverlay?.classList.remove("hidden");
    });

    todayButton?.addEventListener("click", () => this.today());
    tomorrowButton?.addEventListener("click", () => this.tomorrow());

    byDateButton?.addEventListener("click", () => {
      document.getElementById("date-selectors")?.classList.toggle("hidden");
    });

    resetFilterButton?.addEventListener("click", () => {
      this.resetDateSelections();
      this.map.easeTo(start);
    });
  }

  createGeocoder(): MapboxGeocoder {
    const accessToken =
      "pk.eyJ1IjoibWV0YXN5biIsImEiOiIwN2FmMDNhNTRhOWQ3NDExODI1MTllMDk1ODc3NTllZiJ9.Bye80QJ4r0RJsKj4Sre6KQ";
    return new MapboxGeocoder({
      accessToken,
      // mapboxgl: maplibregl,
      types: "poi",
      proximity: {
        longitude: -122.416,
        latitude: 37.76,
      },
      countries: "us", // ISO 3166
      bbox: [-125.222168, 35.728677, -118.048096, 41.845013],
      filter: (f: Feature) => {
        return [
          "music",
          "event",
          "venue",
          "concert",
          "band",
          "show",
          "stage",
          "hall",
          "club",
          "disco",
          "punk",
          "jazz",
          "rock",
          "theater",
          "theatre",
          "gallery",
          "art",
          "bar", // sometimes the only categories for venues are related to serving drinks
          "alcohol",
          "auditorium",
          "amphitheater",
        ].some((cat) => f.properties?.category.toLowerCase().includes(cat));
      },
    });
  }

  devTools(): void {
    // Do something with these
    const geocodeCoordinates = {};
    const geocoder = this.createGeocoder();

    // this.map.addControl(geocoder);
    geocoder.addTo("#geocoder");

    const scrape = false;
    if (scrape) {
      this.featureCollection.features.forEach((f) => {
        const venue = f.properties?.venue;
        geocoder.query(venue);
        setTimeout(() => {
          console.log(".");
        }, 100);
      });
    }

    geocoder.on("results", (e) => {
      const item = e.features[0];
      try {
        if (e.request && e.request.params && e.request.params.query && item) {
          const query = e.request.params.query;
          geocodeCoordinates[query] = {
            coordinates: item.geometry.coordinates,
            text: item.text,
          };
        }
      } catch (err) {
        console.error(err);
      }
    });

    // Get the geocoder results container.
    const results = document.createElement("pre");
    results.setAttribute("id", "result");
    document.getElementsByTagName("body")[0].appendChild(results);

    // Clear results container when search is cleared.
    geocoder.on("clear", () => {
      if (results) {
        results.innerText = "";
      }
    });
  }

  setDates(items: DateItem[]): void {
    this.dates = items;
  }

  getDateStrings(): string[] {
    return this.dates.map((x) => x.date);
  }

  resetDateSelections(): void {
    this.dates.forEach((x) => {
      x.checked = true;
    });
    this.syncDateSelector();
    this.updateListingsAndMap();
    this.popup.remove();
  }

  setDate(s: string, val: boolean): void {
    this.dates
      .filter((x) => x.date === s)
      .forEach((x) => {
        x.checked = val;
      });
    this.updateListingsAndMap();
    this.popup.remove();
  }

  only(s: string): void {
    this.dates.forEach((x) => {
      x.checked = x.date === s;
    });
    this.syncDateSelector();
    this.updateListingsAndMap();
    this.popup.remove();
  }

  today(): void {
    const now = DateTime.now().setZone("America/Los_Angeles");
    // toString returns an ISO 8601 string
    // where we are just interested in YYYY-MM-DD which is
    // only the first 10 characters
    const today = now.toString().slice(0, 10);
    this.only(today);
  }

  tomorrow(): void {
    const now = DateTime.now().setZone("America/Los_Angeles");
    const tomorrow = now.plus({ hours: 24 }).toString().slice(0, 10);
    this.only(tomorrow);
  }

  isSelected(s: string): boolean {
    return this.dates.filter((x) => x.date === s).some((x) => x.checked);
  }
}

new MapHandler();
