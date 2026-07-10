# openwifi Wiki (rebuilt)

A reorganized, public-facing wiki for the [openwifi](https://github.com/open-sdr/openwifi) and [openwifi-hw](https://github.com/open-sdr/openwifi-hw) projects, written for onboarding new contributors. It consolidates the two repositories' READMEs, the project document, all application notes, the image-build guides, the FPGA IP-core and per-board hardware detail, and the known-issues list into thirteen cross-linked pages, with instructions rewritten for clarity.

Built with [MkDocs](https://www.mkdocs.org/) + [Material](https://squidfunk.github.io/mkdocs-material/) and published to GitHub Pages on every push to `master`.

## Pages

Listed in navigation order (see [`mkdocs.yml`](mkdocs.yml) for the section grouping):

| File | Purpose |
|---|---|
| `docs/index.md` | Landing page: what openwifi is, the repos, and a reading path |
| `docs/Repositories.md` | The four repos, why the project is split, and where to look for anything |
| `docs/Getting-Started.md` | Hardware, flashing the SD card, first AP bring-up |
| `docs/Architecture.md` | How Linux, the driver, and the FPGA fit together (read before coding) |
| `docs/Supported-Boards.md` | Board matrix, per-board hardware notes, and the GPIO/LED debug map |
| `docs/Operating-Modes.md` | AP, client, ad-hoc, monitor, packet injection, 802.11b notes |
| `docs/sdrctl-and-Runtime-Control.md` | The `sdrctl` tool, common tricks, and the full register reference |
| `docs/Software-Development-Workflow.md` | Rebuilding the driver, live reload, SD-image builds |
| `docs/FPGA-Development.md` | Bitstream builds, IP cores, simulation, HLS, porting |
| `docs/FPGA-IP-Cores.md` | The six custom FPGA cores: signal chain, registers, testbenches |
| `docs/Research-Features.md` | CSI, CSI radar, CSI fuzzer, IQ capture, loopback, counters |
| `docs/Troubleshooting.md` | Known issues by symptom + debugging tools |
| `docs/FAQ-and-Resources.md` | FAQ, citing, publications, videos, community, license |

Navigation, theme, and the custom look live in [`mkdocs.yml`](mkdocs.yml) and [`docs/assets/stylesheets/extra.css`](docs/assets/stylesheets/extra.css).

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
