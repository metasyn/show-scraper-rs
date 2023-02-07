set export

build:
  cargo build
  bun run esbuild src/app.ts --bundle --sourcemap --outfile=public/out.js

watch:
  bun run src/app.ts --watch --bundle --sourcemap --outfile=public/out.js

release:
  cargo build --release
  bun run esbuild src/app.ts --bundle --minify --drop:debugger --tree-shaking=true --sourcemap --outfile=public/out.js
