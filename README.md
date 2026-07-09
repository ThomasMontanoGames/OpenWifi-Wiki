# openwifi Wiki (rebuilt)

A reorganized, public-facing wiki for the [openwifi](https://github.com/open-sdr/openwifi) and [openwifi-hw](https://github.com/open-sdr/openwifi-hw) projects, written for onboarding new contributors. It consolidates the two repositories' READMEs, the project document, all application notes, the image-build guides, and the known-issues list into ten cross-linked pages, with instructions rewritten for clarity.

Built with [MkDocs](https://www.mkdocs.org/) + [Material](https://squidfunk.github.io/mkdocs-material/) and published to GitHub Pages on every push to `master`.

## Pages

| File | Purpose |
|---|---|
| `docs/index.md` | Landing page: what openwifi is, the repos, and a reading path |
| `docs/Getting-Started.md` | Hardware, flashing the SD card, first AP bring-up |
| `docs/Architecture.md` | How Linux, the driver, and the FPGA fit together (read before coding) |
| `docs/Operating-Modes.md` | AP, client, ad-hoc, monitor, packet injection, 802.11b notes |
| `docs/sdrctl-and-Runtime-Control.md` | The `sdrctl` tool, common tricks, and the full register reference |
| `docs/Software-Development-Workflow.md` | Rebuilding the driver, live reload, SD-image builds |
| `docs/FPGA-Development.md` | Bitstream builds, IP cores, simulation, HLS, porting |
| `docs/Research-Features.md` | CSI, CSI radar, CSI fuzzer, IQ capture, loopback, counters |
| `docs/Troubleshooting.md` | Known issues by symptom + debugging tools |
| `docs/FAQ-and-Resources.md` | FAQ, citing, publications, videos, community, license |

Site navigation and structure live in [`mkdocs.yml`](mkdocs.yml).

## Running it locally

```bash
pip install -r requirements.txt
mkdocs serve
```

Then open `http://127.0.0.1:8000`. `mkdocs build --strict` (used in CI) fails the build on broken internal links or anchors.

## Deployment

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds the site and publishes it to GitHub Pages on every push to `master`. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**. The site then lives at `https://thomasmontanogames.github.io/OpenWifi-Wiki/`.

## Notes on images

The original docs reference many diagrams (architecture, CSI/IQ formats, 802.11n figures) stored in the source repos. This rebuilt wiki links out to the repositories for those figures rather than embedding them. If you want the images inline, copy the relevant files from `openwifi/doc/` and `openwifi/doc/app_notes/` into `docs/` and add `![](path)` references where useful.

## Maintenance

The repositories are the source of truth. When they change, update the affected page here. Each page notes which upstream file(s) it derives from, so diffs are easy to track.
