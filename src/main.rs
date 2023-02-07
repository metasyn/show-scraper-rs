#[macro_use]
extern crate rocket;

use rocket::fairing::{Fairing, Info, Kind};
use rocket::fs::{relative, FileServer};
use rocket::http::Header;
use rocket::{Request, Response};

use rocket::serde::json::Json;

mod common;
mod lib19hz;
mod libfoopee;

use common::Show;

#[get("/foopee")]
async fn get_foopee() -> Json<Vec<Show>> {
    Json(libfoopee::scrape().await)
}

#[get("/19hz")]
async fn get_19hz() -> Json<Vec<Show>> {
    Json(lib19hz::scrape().await)
}

pub struct CORS;

#[rocket::async_trait]
impl Fairing for CORS {
    fn info(&self) -> Info {
        Info {
            name: "Add CORS headers to responses",
            kind: Kind::Response,
        }
    }

    async fn on_response<'r>(&self, _request: &'r Request<'_>, response: &mut Response<'r>) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new(
            "Access-Control-Allow-Methods",
            "POST, GET, PATCH, OPTIONS",
        ));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
    }
}

#[launch]
fn rocket() -> _ {
    rocket::build()
        .attach(CORS)
        .mount("/shows/scrape", routes![get_foopee, get_19hz])
        .mount("/shows", FileServer::from(relative!("public")))
}
