#![feature(proc_macro_hygiene, decl_macro)]

#[macro_use]
extern crate rocket;

use rocket::response::content;

mod parser;

#[get("/")]
fn index() -> Result<content::Json<std::string::String>, serde_json::Error> {
    return match parser::scrape_shows_to_json() {
        Ok(resp) => Ok(content::Json(resp)),
        Err(resp) => Err(resp),
    };
}

fn main() {
    rocket::ignite().mount("/", routes![index]).launch();
}
