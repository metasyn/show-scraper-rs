extern crate chrono;
extern crate reqwest;
extern crate select;
extern crate serde;
extern crate serde_json;

use std::fmt;
use std::fs::File;
use std::vec::Vec;

use chrono::Local;
use chrono::{DateTime, Datelike, NaiveDate};
use select::document::Document;
use select::node::Node;
use select::predicate::{Attr, Name, Predicate};

use serde::Serialize;

#[derive(Serialize)]
struct Show {
    venue: String,
    artists: Vec<String>,
    // latitude: f32,
    // longitude: f32,
    date: String,
    details: String,
}

impl fmt::Display for Show {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let artists = self.artists.join(", ");
        write!(
            f,
            "date: {}\nvenue {}\nartists: {}\ndetails: {}",
            self.date, self.venue, artists, self.details
        )
    }
}

fn parse_date_string(date: String) -> NaiveDate {
    // Take a datestring like mar_10 and return a NaiveDate we can use.
    // Always assumes current year.
    let today: DateTime<Local> = Local::now();
    let year = today.format("%Y");
    let date_with_year = &format!("{} {}", year, date);
    let date = NaiveDate::parse_from_str(date_with_year, "%Y %b_%d").unwrap();
    return date;
}

fn parse_date_node(n: Node) -> NaiveDate {
    // Take a node that contains a date in the name attribute
    // and increment the year if we're going from December to January
    let today: DateTime<Local> = Local::now();
    let date_string = n.attr("name").unwrap().to_string();
    let mut date = parse_date_string(date_string);

    // If the date is in January but today is in December
    if date.month() < today.month() {
        date = NaiveDate::from_ymd(date.year() + 1, date.month(), date.day())
    }

    return date;
}

fn parse_date_list(n: Node) -> Option<Vec<Show>> {
    let mut shows: Vec<Show> = Vec::new();

    let date_node_collection = n
        .find(Name("a").and(Attr("name", ())))
        .take(1)
        .collect::<Vec<_>>();

    if date_node_collection.len() < 1 {
        return None;
    }

    let date_node = date_node_collection[0];
    let naive_date = parse_date_node(date_node);

    let li_nodes = n.find(Name("ul").descendant(Name("li")));

    for item in li_nodes {
        let anchors = item.find(Name("a")).collect::<Vec<_>>();
        let venue = anchors[0].text();
        let mut artists: Vec<String> = Vec::new();
        for i in &anchors[1..] {
            artists.push(i.text().trim().to_string())
        }
        let details = item.last_child().unwrap().text();
        let show = Show {
            date: naive_date.to_string(),
            artists,
            venue: venue.trim().to_string(),
            details: details.trim().to_string(),
        };
        shows.push(show)
    }
    return Some(shows);
}

fn parse(url: &str) -> Result<Vec<Show>, reqwest::Error> {
    let resp = reqwest::blocking::get(url);
    match resp {
        Ok(resp) => {
            let document = Document::from_read(resp).unwrap();
            let root_list = document.find(Name("ul")).take(1).collect::<Vec<_>>()[0];

            let mut show_vec: Vec<Show> = Vec::new();
            for node in root_list.children() {
                match parse_date_list(node) {
                    Some(v) => show_vec.extend(v),
                    _ => (),
                }
            }

            return Ok(show_vec);
        }
        Err(resp) => {
            println!("Could not parse url.");
            return Err(resp);
        }
    }
}

fn scrape(output_file: &str) -> std::io::Result<()> {
    let mut all_shows: Vec<Show> = Vec::new();

    for url in &[
        "http://www.foopee.com/punk/the-list/by-date.0.html",
        "http://www.foopee.com/punk/the-list/by-date.1.html",
    ] {
        match parse(url) {
            Ok(s) => all_shows.extend(s),
            Err(e) => println!("Failed parsing url: {} \n{}", url, e),
        };
    }

    let file = File::create(output_file)?;
    serde_json::to_writer(file, &all_shows)?;
    Ok(())
}

fn main() -> std::io::Result<()> {
    return scrape("shows.json");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn it_works() {
        let file = "shows.json";
        assert!(scrape(file).is_ok());
        assert!(std::path::Path::new(file).exists());
    }
}
