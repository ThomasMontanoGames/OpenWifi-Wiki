# openwifi Wiki (rebuilt)

A reorganized, public-facing wiki for the [openwifi](https://github.com/open-sdr/openwifi) and [openwifi-hw](https://github.com/open-sdr/openwifi-hw) projects, written for onboarding new contributors. It consolidates the two repositories' READMEs, the project document, all application notes, the image-build and boot/device-tree details, the FPGA IP-core and per-board hardware detail, a glossary, and the known-issues list into eighteen cross-linked pages, with instructions rewritten for clarity.

Built with [MkDocs](https://www.mkdocs.org/) + [Material](https://squidfunk.github.io/mkdocs-material/) and published to GitHub Pages on every push to `master`.

## Structure

Pages live in `docs/` and are organized into sections defined in [`mkdocs.yml`](mkdocs.yml), which is the authoritative page list and ordering:

- **Getting oriented** — what openwifi is, the repositories, getting started, architecture, and supported boards
- **Using openwifi** — operating modes and the `sdrctl` runtime-control reference
- **Developing** — the software workflow, boot/kernel/device tree, and the FPGA design and IP cores
- **Research** — CSI, IQ capture, and the other research features
- **Application notes** — an index of the upstream application notes
- **Help & Support** — troubleshooting, a glossary, the FAQ, and how to contribute

For the exact page list and order, see [`mkdocs.yml`](mkdocs.yml) or the [live site](https://thomasmontanogames.github.io/OpenWifi-Wiki/). The theme and custom styling live in `mkdocs.yml` and [`docs/assets/stylesheets/extra.css`](docs/assets/stylesheets/extra.css).

## Running it locally

```bash
pip install -r requirements.txt
mkdocs serve
```

Then open `http://127.0.0.1:8000`. `mkdocs build --strict` (used in CI) fails the build on broken internal links or anchors.

## Deployment

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site and publishes it to GitHub Pages on every push to `master`. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**. The site then lives at `https://thomasmontanogames.github.io/OpenWifi-Wiki/`.

## Images and diagrams

Diagrams from the source repos (architecture, CSI/IQ formats, 802.11n figures, board structure, screenshots) are copied into [`docs/assets/img/`](docs/assets/img/) and embedded inline. To refresh or add one, copy the file from `openwifi/doc/`, `openwifi/doc/app_notes/`, or `openwifi-hw/` into `docs/assets/img/` and reference it with `![alt](assets/img/name.ext)`.

Two diagrams — the repository map on the Repositories page and the signal chain on the FPGA IP Cores page — are hand-written inline SVG (theme-aware, no external assets). Edit them directly in the Markdown source.

## Maintenance

The repositories are the source of truth. When they change, update the affected page here. `mkdocs build --strict` fails on any broken internal link or anchor, so run it (or rely on CI) before pushing.
