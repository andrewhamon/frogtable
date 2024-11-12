{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs?ref=nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    let
      mkFrogtable = system: import ./default.nix { pkgs = nixpkgs.legacyPackages.${system}; };
    in
    flake-utils.lib.eachDefaultSystem (system: {
      packages = rec {
        frogtable = mkFrogtable system;
        default = frogtable;
      };
    });
}
