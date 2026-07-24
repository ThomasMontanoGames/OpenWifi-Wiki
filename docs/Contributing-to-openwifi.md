# Contributing to openwifi

openwifi is an open project and welcomes contributions: driver fixes, FPGA improvements, new board support, and documentation. This page covers the one legal prerequisite (the CLA), how to set up a development environment, which repository a change belongs in, and where to reach the community. Each repo's own `CONTRIBUTING.md` is the authoritative source. For changes to this wiki rather than to openwifi, see [Contributing to this wiki](#contributing-to-this-wiki) at the end of this page.

## 1. Sign the CLA first

Before your **first** contribution to any openwifi repository, you must sign a **Contributor License Agreement** (generated with the [Project Harmony](http://www.harmonyagreements.org/) framework) and email it to **`Filip.Louagie@UGent.be`**:

- **Individual CLA**: for contributions you make personally.
- **Entity CLA**: if you contribute on behalf of a company or organization.

The forms are linked from each repository's `CONTRIBUTING.md` (for example, [openwifi/CONTRIBUTING.md](https://github.com/open-sdr/openwifi/blob/master/CONTRIBUTING.md)). It's a one-time step and covers all the openwifi repos.

## 2. Set up a development environment

- **Clone the repos you'll work in** (see [The Repositories](Repositories.md) for what lives where): [openwifi](https://github.com/open-sdr/openwifi) for the driver/software, [openwifi-hw](https://github.com/open-sdr/openwifi-hw) for the FPGA. Prebuilt bitstreams are in [openwifi-hw-img](https://github.com/open-sdr/openwifi-hw-img).
- **Tools:** **Vivado 2022.2 with Vitis** for FPGA and kernel builds, plus host packages `flex bison libssl-dev device-tree-compiler u-boot-tools`. Some boards need a paid Vivado license to rebuild the FPGA, while Zynq-7020 boards use the free tier (see [Supported Boards](Supported-Boards.md)).
- **Environment variables** most build scripts expect: `XILINX_DIR`, `OPENWIFI_HW_IMG_DIR`, `BOARD_NAME` (see [Environment Setup → Environment variables](Development-Environment-Setup.md#environment-variables)).
- **Build guides:** [Software Development Workflow](Software-Development-Workflow.md) (driver + live reload), [FPGA Development](FPGA-Development.md) (bitstream, IP cores, simulation), [Boot, Kernel & Device Tree](Boot-Kernel-Device-Tree.md), and [Building SD Images](Building-SD-Images.md).
- **No hardware?** The imec [w-iLab.t testbed](https://doc.ilabt.imec.be/ilabt/wilab/tutorials/openwifi.html) offers remote access to openwifi boards.

## 3. Which repository does my change belong in?

openwifi is [split across several repos](Repositories.md) by toolchain, so the first question is which one to target:

| Your change | Repository |
|---|---|
| Driver, `sdrctl`/user-space tools, scripts, boot files, docs | [openwifi](https://github.com/open-sdr/openwifi) |
| The PHY or real-time MAC (Verilog IP cores), board Vivado projects | [openwifi-hw](https://github.com/open-sdr/openwifi-hw) |
| A prebuilt bitstream for a board | [openwifi-hw-img](https://github.com/open-sdr/openwifi-hw-img) |
| The OFDM receiver internals | [openofdm](https://github.com/open-sdr/openofdm) (`dot11zynq` branch) |

!!! warning "Keep the driver and FPGA register maps in sync"
    If your change touches a register, the driver side (`openwifi/driver/hw_def.h`) and the FPGA side (the core's `*_s_axi.v` in `openwifi-hw/ip/`) must agree, because they are two halves of the same contract. See [FPGA IP Cores](FPGA-IP-Cores.md#how-a-register-write-reaches-a-core).

## 4. Propose the change

- **Discuss large changes first** on the relevant repo's [Discussions](https://github.com/open-sdr/openwifi/discussions) or [Issues](https://github.com/open-sdr/openwifi/issues) so effort isn't wasted.
- **Match the surrounding code style** and keep changes focused.
- **Open a pull request** against the relevant repository, referencing any related issue. Make sure the CLA (step 1) is on file first.

## 5. Community and support

- **Discussions:** <https://github.com/open-sdr/openwifi/discussions>
- **Issues:** [openwifi](https://github.com/open-sdr/openwifi/issues) and [openwifi-hw](https://github.com/open-sdr/openwifi-hw/issues)
- **Mailing list:** <https://lists.ugent.be/wws/subscribe/openwifi>
- **Windows dev tips:** the [Tips for Windows users](https://github.com/open-sdr/openwifi/discussions/341) thread
- **Commercial support & advanced features:** <https://openwifi.tech>

See [FAQ & Resources](FAQ-and-Resources.md#community-and-support) for the full list.

## 6. Licensing

openwifi is dual-licensed: **AGPLv3** for the open-source release, with commercial licensing via [openwifi.tech](https://openwifi.tech). Individual files may be GPL-2.0-or-later or BSD-3-Clause, and vendored third-party components carry their own terms. Your contributions are accepted under the project's license, which is what the CLA in step 1 formalizes. See [FAQ → License](FAQ-and-Resources.md#license).

## Contributing to this wiki

This wiki rewrites and reorganizes the documentation in the openwifi repositories. It is not the project's official documentation, and the repositories are always the source of truth. If the wiki and a repo disagree, trust the repo, and fixing the wiki to match is itself a welcome contribution. The wiki lives in its own repository and is edited via pull request there. The pages are plain Markdown built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/), and `mkdocs build --strict` must pass.
