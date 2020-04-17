# show-scraper
![](https://github.com/metasyn/show-scraper-rs/workflows/rust/badge.svg)

This is a simple application I wrote to learn a little more about rust. It:

* scrapes [The List](http://www.foopee.com/punk/the-list/)
* wraps up the results into a small webserver that returns a json blob

# routes

There is only one route: `/` (on port 80). It returns a json blob of shows. Thats it!

# docker

There is also a dockerfile for building and automatically published image: `metasyn/show-scraper`
