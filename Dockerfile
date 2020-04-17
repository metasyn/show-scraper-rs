FROM ekidd/rust-musl-builder as builder

# Get that nightly
RUN rustup toolchain install nightly
RUN rustup target add x86_64-unknown-linux-musl --toolchain=nightly

# Build
COPY src src
COPY Cargo.toml .
COPY Cargo.lock .
# Lets get fully static binaries with musl!
RUN cargo +nightly build --release

FROM alpine:latest
WORKDIR /opt
EXPOSE 80

COPY --from=builder /home/rust/src/target/x86_64-unknown-linux-musl/release/show-scraper /opt/show-scraper

COPY favicon.ico /opt

CMD /opt/show-scraper
