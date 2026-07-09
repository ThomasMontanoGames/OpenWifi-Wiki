# openwifi Wiki (rebuilt)

A reorganized, public-facing wiki for the [openwifi](https://github.com/open-sdr/openwifi) and [openwifi-hw](https://github.com/open-sdr/openwifi-hw) projects, written for onboarding new contributors. It consolidates the two repositories' READMEs, the project document, all application notes, the image-build guides, and the known-issues list into nine cross-linked pages, with instructions rewritten for clarity.

## Pages

| File | Purpose |
|---|---|
| `Home.md` | Landing page: what openwifi is, the repos, and a reading path |
| `Getting-Started.md` | Hardware, flashing the SD card, first AP bring-up |
| `Architecture.md` | How Linux, the driver, and the FPGA fit together (read before coding) |
| `Operating-Modes.md` | AP, client, ad-hoc, monitor, packet injection, 802.11b notes |
| `sdrctl-and-Runtime-Control.md` | The `sdrctl` tool, common tricks, and the full register reference |
| `Software-Development-Workflow.md` | Rebuilding the driver, live reload, SD-image builds |
| `FPGA-Development.md` | Bitstream builds, IP cores, simulation, HLS, porting |
| `Research-Features.md` | CSI, CSI radar, CSI fuzzer, IQ capture, loopback, counters |
| `Troubleshooting.md` | Known issues by symptom + debugging tools |
| `FAQ-and-Resources.md` | FAQ, citing, publications, videos, community, license |
| `_Sidebar.md` | Navigation (used by GitHub wikis) |

## How to host it

**GitHub wiki (simplest).** GitHub wikis are their own git repo. Clone it, drop these files in, push:

```bash
git clone https://github.com/<you>/<repo>.wiki.git
cp *.md <repo>.wiki/
cd <repo>.wiki && git add . && git commit -m "Import rebuilt wiki" && git push
```

`Home.md` becomes the landing page and `_Sidebar.md` becomes the navigation automatically. (GitHub wiki page names come from the filename, so the intra-page links here use `.md` targets that resolve correctly once imported.)

**Static-site generators** (MkDocs, Docusaurus, Jekyll, Hugo). All pages are plain CommonMark and work as-is. For MkDocs, add each page to `nav:` in `mkdocs.yml`; the `_Sidebar.md` file can be ignored or used as a nav reference.

**Plain rendering.** Any Markdown viewer will render them; the internal links assume the files sit in the same directory.

## Notes on images

The original docs reference many diagrams (architecture, CSI/IQ formats, 802.11n figures) stored in the source repos. This rebuilt wiki links out to the repositories for those figures rather than embedding them. If you host publicly and want the images inline, copy the relevant files from `openwifi/doc/` and `openwifi/doc/app_notes/` and add `![](path)` references where useful.

## Maintenance

The repositories are the source of truth. When they change, update the affected page here. Each page notes which upstream file(s) it derives from, so diffs are easy to track.
