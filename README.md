# openwifi Wiki (rebuilt)

Documentation for the [openwifi](https://github.com/open-sdr/openwifi) and [openwifi-hw](https://github.com/open-sdr/openwifi-hw) projects, written for onboarding new contributors. It consolidates the two repositories' READMEs, the project document, the application notes, the image-build and boot/device-tree details, the FPGA IP-core and per-board hardware notes, a glossary, and the known-issues list into a set of cross-linked pages, with instructions rewritten for clarity.

Built with [MkDocs](https://www.mkdocs.org/) + [Material](https://squidfunk.github.io/mkdocs-material/) and published to GitHub Pages on every push to `master`.

## Structure

Pages live in `docs/`. Their grouping into sections and their order are defined in [`mkdocs.yml`](mkdocs.yml), which is the single source of truth for the page list; the [live site](https://thomas-montano.github.io/OpenWifi-Wiki/) shows the same structure rendered. Broadly, the pages progress from orientation (what openwifi is, the repositories, getting started, architecture, boards), through everyday use and the `sdrctl` reference, into development (build workflow, boot/kernel/device tree, the FPGA design), research features, an index of the application notes, and help and troubleshooting.

The theme and custom styling live in `mkdocs.yml` and [`docs/assets/stylesheets/extra.css`](docs/assets/stylesheets/extra.css).

## Running it locally

```bash
pip install -r requirements.txt
mkdocs serve
```

Then open `http://127.0.0.1:8000`. `mkdocs build --strict` (used in CI) fails the build on broken internal links or anchors.

## Deployment

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site and publishes it to GitHub Pages on every push to `master`. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**. The site then lives at `https://thomas-montano.github.io/OpenWifi-Wiki/`.

## Images and diagrams

Diagrams from the source repos (architecture, CSI/IQ formats, 802.11n figures, board structure, screenshots) are copied into [`docs/assets/img/`](docs/assets/img/) and embedded inline. To refresh or add one, copy the file from `openwifi/doc/`, `openwifi/doc/app_notes/`, or `openwifi-hw/` into `docs/assets/img/` and reference it with `![alt](assets/img/name.ext)`.

A few diagrams are hand-written inline SVG (theme-aware, no external assets) rather than image files, for example the repository map on the Repositories page and the signal chain on the FPGA IP Cores page. Edit those directly in the Markdown source.

## Maintenance

The repositories are the source of truth. When they change, update the affected page here. `mkdocs build --strict` fails on any broken internal link or anchor, so run it (or rely on CI) before pushing.
