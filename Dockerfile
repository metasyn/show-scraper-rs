FROM rustlang/rust:nightly-slim as builder
WORKDIR /usr/src/show-scraper
RUN apt-get update && apt-get install pkg-config libssl-dev -yq
COPY . .
RUN --mount=type=cache,target=/usr/src/show-scraper/target \
  cargo install --path .
#
FROM debian:bullseye-slim
COPY --from=builder /usr/local/cargo/bin/show-scraper /usr/local/bin/show-scraper
ADD public public
CMD ["show-scraper"]
