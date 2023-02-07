use chrono::{Datelike, Local, NaiveDate};
use select::document::Document;
use select::predicate::Name;

use crate::common::Show;

async fn parse_19hz_info(url: &str) -> Result<Vec<Show>, reqwest::Error> {
    let resp = reqwest::get(url).await;

    match resp {
        Ok(resp) => {
            let table = table_extract::Table::find_first(
                resp.text()
                    .await
                    .expect("unable to get response text")
                    .as_str(),
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

                    let now = Local::now();

                    // TODO: handle Dec -> January where we'll need to increment the year
                    let mut year = now.format("%Y").to_string();

                    let (date, time) = match date_time_split.len() {
                        2 => {
                            // 19hz doesn't include year, so we jsut attach ours here.
                            year.push_str(date_time_split[0]);

                            // Parse it
                            let parsed =
                                NaiveDate::parse_from_str(year.as_str().trim(), "%Y%a: %b %e");

                            // If its ok, update the output. The match syntax was tricky here
                            // so we're just checking the single condition.
                            if parsed.is_err() {
                                return None;
                            }
                            let value = parsed.unwrap();
                            let delta = value
                                - NaiveDate::from_ymd_opt(now.year(), now.month(), now.day())
                                    .unwrap();
                            if delta.num_days() > 14 {
                                return None;
                            }

                            let output = value.format("%Y-%m-%d").to_string();

                            // Final return for the matched arm
                            (output, Some(date_time_split[1].to_string()))
                        }
                        // TODO
                        // Could handle this better maybe?
                        _ => (date_time.clone(), None),
                    };

                    let details = row.get("Price | Age").unwrap_or("").to_string();

                    return Some(Show {
                        venue: venue.expect("could not parse venue"),
                        artists: vec![title],
                        date,
                        details,
                        time,
                        organizers: row.get("Organizers").map(|x| x.to_string()),
                        link, //row.get("Links").map(|x| x.to_string()),
                        tags: row.get("Tags").map(|x| x.to_string()),
                    });
                })
                .filter(|x| x.is_some())
                .map(|x| x.unwrap())
                .collect::<Vec<Show>>();

            return Ok(shows);
        }
        Err(resp) => {
            println!("Could not parse url.");
            return Err(resp);
        }
    }
}

pub async fn scrape() -> Vec<Show> {
    let mut all_shows: Vec<Show> = Vec::new();

    for url in &["https://19hz.info/eventlisting_BayArea.php"] {
        match parse_19hz_info(url).await {
            Ok(s) => all_shows.extend(s),
            Err(e) => println!("Failed parsing url: {} \n{}", url, e),
        };
    }

    return all_shows;
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_19hz_scrape_works() {
        let res = NaiveDate::parse_from_str("2023 Sun: Feb 5", "%Y %a: %b%e");
        assert!(res.is_ok());
    }
}
