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

    buildPhase = ''
      cd src-web
      ${pkgs.bun}/bin/bun install
      ${pkgs.bun}/bin/bun run build
    '';

    installPhase = ''
      mkdir -p $out
      cp -r dist/* $out
    '';

    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-z09fjU/u4NLdofpcYV6Ra+B6qLJrWb/s3El896Y5sTM=";
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

  cargoHash = "sha256-URSC9CY1TN81XjlSGFbYO+4f3WkHaEas71JfOD6dKHU=";
}
