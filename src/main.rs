#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use]
extern crate rocket;

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

fn main() -> Result<(), rocket::config::ConfigError> {
    let config_result = Config::build(Environment::Production)
        .address("0.0.0.0")
        .port(80)
        .finalize();

    match config_result {
        Ok(config) => {
            rocket::custom(config)
                .mount("/", routes![index])
                .mount("/19hz", routes![get_19hz])
                .launch();
            return Ok(());
        }
        Err(config) => Err(config),
    }
}
