.PHONY: help install dev run build package package-mac clean

help:
	@echo "Available targets:"
	@echo "  install      Install dependencies"
	@echo "  dev          Run development server with hot reload"
	@echo "  run          Build and run production server (no reload)"
	@echo "  build        Build the React app"
	@echo "  package      Build and package for all platforms"
	@echo "  package-mac  Build and package for macOS (DMG)"
	@echo "  clean        Remove build artifacts"

install:
	npm install

dev:
	npm run dev

run:
	npm run build && npx electron .

build:
	npm run build

package:
	npm run package

package-mac:
	npm run package:mac

clean:
	rm -rf dist release node_modules
