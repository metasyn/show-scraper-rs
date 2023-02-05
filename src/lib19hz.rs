use select::document::Document;
use select::predicate::Name;

use crate::common::Show;

fn parse_19hz_info(url: &str) -> Result<Vec<Show>, reqwest::Error> {
    let resp = reqwest::blocking::get(url);
    match resp {
        Ok(resp) => {
            let table = table_extract::Table::find_first(
                resp.text().expect("unable to get response text").as_str(),
            )
            .expect("unable to find table");

            let shows = table
                .iter()
                .map(|row| {
                    let title_venue = row
                        .get("Event Title @ Venue")
                        .expect("<title/venue missing>")
                        .split("@")
                        .collect::<Vec<_>>();

                    let (raw_title, venue) = match title_venue.len() {
                        0 | 1 => (None, None),
                        2 => (
                            Some(title_venue[0].trim()),
                            Some(title_venue[1].trim().to_string()),
                        ),
                        _ => todo!(),
                    };

                    let doc = Document::from(raw_title.expect("couldn't extract title"));
                    let root = doc.find(Name("a")).take(1).collect::<Vec<_>>()[0];
                    let link = root.attr("href").map(|x| x.to_string());
                    let title = root.text();

                    // TODO parse  time
                    let date_time = row.get("Date/Time").unwrap_or("<missing-date>").to_string();
                    let date_time_split = date_time.split("<br>").collect::<Vec<_>>();

                    let (date, time) = match date_time_split.len() {
                        0 | 1 => (date_time.clone(), None),
                        2 => (
                            date_time_split[0].to_string(),
                            Some(date_time_split[1].to_string()),
                        ),
                        _ => todo!(),
                    };

                    return Show {
                        venue: venue.expect("could not parse venue"),
                        artists: vec![title],
                        date,
                        details: row.get("Price | Age").unwrap_or("").to_string(),
                        time,
                        organizers: row.get("Organizers").map(|x| x.to_string()),
                        link, //row.get("Links").map(|x| x.to_string()),
                        tags: row.get("Tags").map(|x| x.to_string()),
                    };
                })
                .collect::<Vec<Show>>();

            return Ok(shows);
        }
        Err(resp) => {
            println!("Could not parse url.");
            return Err(resp);
        }
    }
}

fn scrape_shows() -> Vec<Show> {
    let mut all_shows: Vec<Show> = Vec::new();

    for url in &["https://19hz.info/eventlisting_BayArea.php"] {
        match parse_19hz_info(url) {
            Ok(s) => all_shows.extend(s),
            Err(e) => println!("Failed parsing url: {} \n{}", url, e),
        };
    }

    return all_shows;
}

pub fn scrape_shows_to_json() -> serde_json::Result<std::string::String> {
    return serde_json::to_string(&scrape_shows());
}
