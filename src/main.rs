#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use]
extern crate rocket;

use rocket::fairing::{Fairing, Info, Kind};
use rocket::http::Header;
use rocket::{Request, Response};

use rocket::config::{Config, Environment};
use rocket::response::content;

mod common;
mod lib19hz;
mod parser;

#[get("/")]
fn index() -> Result<content::Json<std::string::String>, serde_json::Error> {
    return match parser::scrape_shows_to_json() {
        Ok(resp) => Ok(content::Json(resp)),
        Err(resp) => Err(resp),
    };
}

#[get("/")]
fn get_19hz() -> Result<content::Json<std::string::String>, serde_json::Error> {
    return match lib19hz::scrape_shows_to_json() {
        Ok(resp) => Ok(content::Json(resp)),
        Err(resp) => Err(resp),
    };
}

pub struct CORS;

impl Fairing for CORS {
    fn info(&self) -> Info {
        Info {
            name: "Add CORS headers to responses",
            kind: Kind::Response,
        }
    }

    fn on_response(&self, _: &Request, response: &mut Response) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new(
            "Access-Control-Allow-Methods",
            "POST, GET, PATCH, OPTIONS",
        ));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
    }
}

fn main() -> Result<(), rocket::config::ConfigError> {
    let config_result = Config::build(Environment::Production)
        .address("0.0.0.0")
        .port(
            std::env::var("ROCKET_PORT")
                .map(|x| x.parse::<u16>().unwrap())
                .unwrap_or(80),
        )
        .finalize();

    match config_result {
        Ok(config) => {
            rocket::custom(config)
                .attach(CORS)
                .mount("/", routes![index])
                .mount("/19hz", routes![get_19hz])
                .launch();
            return Ok(());
        }
        Err(config) => Err(config),
    }
}
