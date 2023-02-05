use serde::Serialize;
use std::fmt;

#[derive(Serialize, Clone)]
pub struct Show {
    pub venue: String,
    pub artists: Vec<String>,
    pub date: String,
    pub details: String,
    pub time: Option<String>,
    pub organizers: Option<String>,
    pub link: Option<String>,
    pub tags: Option<String>,
}

impl fmt::Display for Show {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let artists = self.artists.join(", ");
        write!(
            f,
            "date: {}\nvenue {}\nartists: {}\ndetails: {}\ntime: {}\norganizers: {}\nlink: {}\ntags: {}\n\n",
            self.date,
            self.venue,
            artists,
            self.details,
            self.time.clone().unwrap_or(String::new()),
            self.organizers.clone().unwrap_or(String::new()),
            self.link.clone().unwrap_or(String::new()),
            self.tags.clone().unwrap_or(String::new())
        )
    }
}
