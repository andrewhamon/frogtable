{ pkgs }:
let
  version = (builtins.fromTOML (builtins.readFile ./Cargo.toml)).package.version;
  fs = pkgs.lib.fileset;

  web = pkgs.stdenv.mkDerivation rec {
    name = "frogtable-web-${src}";

    src = fs.toSource {
      root = ./.;
      fileset = fs.unions [ ./src-web ./bindings ];
    };

    buildInputs = with pkgs; [
      nodejs
      bun
    ];

    buildPhase = ''
      cd src-web
      bun install
      patchShebangs --build node_modules/*/bin
      bun run build
    '';

    installPhase = ''
      mkdir -p $out
      cp -r dist/* $out
    '';

    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-xB7IrQ0ITUgWvgLJCGB88MkIhtxZYWyRcJsrF92vszs=";
  };
in
pkgs.rustPlatform.buildRustPackage rec {
  pname = "frogtable";
  inherit version;

  src = fs.toSource {
    root = ./.;
    fileset = fs.unions [ ./Cargo.lock ./Cargo.toml (fs.fileFilter (file: file.hasExt "rs") ./src) ];
  };

  FROGTABLE_WEB_DIST = "${web}";

  cargoHash = "sha256-4e/jQouJfYd2Bej9RFtQhmkWdUIOKSzmlrH43PIsubM=";
}
