# The openwifi Project and Its Repositories

New to openwifi? Start here. This page explains **what the project is made of**, **why it is split across several repositories**, and, most usefully, **where to look when you need to find something**. Once the repository map makes sense, everything else on this wiki has an obvious home.

## The one-sentence version

openwifi is a full-stack, Linux `mac80211`-compatible IEEE 802.11 (Wi-Fi) implementation for SDR hardware. The **radio PHY and real-time MAC live in FPGA fabric**; the **driver and everything above it are ordinary Linux**. Because those two worlds are developed with completely different tools (Verilog + Vivado vs. C + the kernel build system), they live in **separate repositories**.

## Why more than one repository?

There is not one "openwifi repo"; there are four, each with a distinct job, a distinct toolchain, and a distinct release cadence:

<figure>
<svg viewBox="0 0 920 450" role="img" aria-label="The four openwifi repositories and how they connect: openwifi (driver and tools), openwifi-hw (FPGA design), openwifi-hw-img (prebuilt bitstreams), and openofdm (OFDM receiver submodule)." style="width:100%;height:auto;max-width:1080px;font-family:inherit;font-size:13px">
  <defs>
    <marker id="ow-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fill-opacity="0.55"/>
    </marker>
  </defs>

  <!-- project title bar -->
  <rect x="10" y="8" width="900" height="34" rx="8" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.15"/>
  <text x="460" y="30" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">The openwifi project · open-sdr</text>

  <!-- card 1: openwifi (indigo) -->
  <rect x="10" y="58" width="214" height="240" rx="12" fill="currentColor" fill-opacity="0.03" stroke="#4f5bd5" stroke-opacity="0.45" stroke-width="1.4"/>
  <path d="M10,70 a12,12 0 0 1 12,-12 h190 a12,12 0 0 1 12,12 v28 h-214 z" fill="#4f5bd5"/>
  <text x="117" y="83" text-anchor="middle" font-size="14.5" font-weight="700" fill="#ffffff">openwifi</text>
  <text x="26" y="126" fill="currentColor">Linux driver +</text>
  <text x="26" y="145" fill="currentColor">user-space tools,</text>
  <text x="26" y="164" fill="currentColor">boot files &amp; docs</text>
  <line x1="24" y1="262" x2="210" y2="262" stroke="currentColor" stroke-opacity="0.12"/>
  <text x="26" y="281" font-size="11" font-weight="600" fill="#4f5bd5">C · kernel · bash</text>

  <!-- card 2: openwifi-hw (teal) -->
  <rect x="238" y="58" width="214" height="240" rx="12" fill="currentColor" fill-opacity="0.03" stroke="#0d9488" stroke-opacity="0.45" stroke-width="1.4"/>
  <path d="M238,70 a12,12 0 0 1 12,-12 h190 a12,12 0 0 1 12,12 v28 h-214 z" fill="#0d9488"/>
  <text x="345" y="83" text-anchor="middle" font-size="14.5" font-weight="700" fill="#ffffff">openwifi-hw</text>
  <text x="254" y="126" fill="currentColor">FPGA design:</text>
  <text x="254" y="145" fill="currentColor">custom IP cores +</text>
  <text x="254" y="164" fill="currentColor">per-board Vivado</text>
  <text x="254" y="183" fill="currentColor">projects</text>
  <line x1="252" y1="262" x2="438" y2="262" stroke="currentColor" stroke-opacity="0.12"/>
  <text x="254" y="281" font-size="11" font-weight="600" fill="#0d9488">Verilog · Vivado 2022.2</text>

  <!-- card 3: openwifi-hw-img (amber) -->
  <rect x="466" y="58" width="214" height="240" rx="12" fill="currentColor" fill-opacity="0.03" stroke="#c2740a" stroke-opacity="0.45" stroke-width="1.4"/>
  <path d="M466,70 a12,12 0 0 1 12,-12 h190 a12,12 0 0 1 12,12 v28 h-214 z" fill="#c2740a"/>
  <text x="573" y="83" text-anchor="middle" font-size="13.5" font-weight="700" fill="#ffffff">openwifi-hw-img</text>
  <text x="482" y="126" fill="currentColor">Pre-built</text>
  <text x="482" y="145" fill="currentColor">bitstreams per</text>
  <text x="482" y="164" fill="currentColor">board (.xsa / .bit)</text>
  <line x1="480" y1="262" x2="666" y2="262" stroke="currentColor" stroke-opacity="0.12"/>
  <text x="482" y="281" font-size="11" font-weight="600" fill="#c2740a">none, just download</text>

  <!-- card 4: openofdm (rose) -->
  <rect x="694" y="58" width="214" height="240" rx="12" fill="currentColor" fill-opacity="0.03" stroke="#be3d73" stroke-opacity="0.45" stroke-width="1.4"/>
  <path d="M694,70 a12,12 0 0 1 12,-12 h190 a12,12 0 0 1 12,12 v28 h-214 z" fill="#be3d73"/>
  <text x="801" y="83" text-anchor="middle" font-size="14.5" font-weight="700" fill="#ffffff">openofdm</text>
  <text x="710" y="126" fill="currentColor">802.11 OFDM</text>
  <text x="710" y="145" fill="currentColor">receiver</text>
  <text x="710" y="164" fill="currentColor">(submodule of</text>
  <text x="710" y="183" fill="currentColor">openwifi-hw)</text>
  <line x1="708" y1="262" x2="894" y2="262" stroke="currentColor" stroke-opacity="0.12"/>
  <text x="710" y="281" font-size="11" font-weight="600" fill="#be3d73">Verilog / HLS</text>

  <!-- connectors: each elbow starts and ends on a card's bottom edge, arrowheads landing on the boxes -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none">
    <!-- openwifi <-> openwifi-hw : shared register map (bidirectional) -->
    <path d="M200,298 V338 H270 V298" marker-start="url(#ow-arrow)" marker-end="url(#ow-arrow)"/>
    <!-- openwifi -> openwifi-hw-img : build scripts pull bitstreams -->
    <path d="M120,298 V388 H573 V298" marker-end="url(#ow-arrow)"/>
    <!-- openofdm -> openwifi-hw : vendored as submodule -->
    <path d="M801,298 V434 H380 V298" marker-end="url(#ow-arrow)"/>
  </g>
  <text x="235" y="354" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity="0.85">shared register map (driver ↔ FPGA)</text>
  <text x="346" y="381" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity="0.85">build scripts pull the prebuilt bitstreams</text>
  <text x="590" y="427" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity="0.85">vendored as a git submodule → ip/openofdm_rx</text>
</svg>
<figcaption><em>The four openwifi repositories and how they connect. The two you clone day-to-day are <strong>openwifi</strong> and <strong>openwifi-hw</strong>; the other two are consumed automatically.</em></figcaption>
</figure>

| Repository | What it holds | When you touch it |
|---|---|---|
| **[openwifi](https://github.com/open-sdr/openwifi)** | The Linux kernel driver, `sdrctl` and other user-space tools, capture/demo scripts, SD-card boot files (kernel patches, device trees, U-Boot), and **all the documentation** | Rebuilding the driver, changing runtime behavior, writing scripts, flashing/booting a board, reading app notes |
| **[openwifi-hw](https://github.com/open-sdr/openwifi-hw)** | The **FPGA design**: openwifi's custom IP cores (`xpu`, `openofdm_tx`, `tx_intf`, `rx_intf`, `side_ch`, and the `openofdm_rx` submodule) plus a Vivado project per supported board | Modifying the PHY or real-time MAC, adding a board, rebuilding the bitstream |
| **[openwifi-hw-img](https://github.com/open-sdr/openwifi-hw-img)** | **Pre-built FPGA bitstreams** for each board (`.xsa`, bitstream, ILA `.ltx`, init files under `boards/<board_name>/sdk/`), plus the CLA/doc PDFs | You want a working bitstream *without* installing Vivado or waiting hours for synthesis |
| **[openofdm](https://github.com/open-sdr/openofdm)** | The 802.11 **OFDM receiver** that `openofdm_rx` is based on. openwifi's improvements live on the `dot11zynq` branch (and `dot11zynq_hls` for the HLS variant). Originally by [jhshi](https://github.com/jhshi/openofdm) | Deep receiver work (synchronization, channel estimation, Viterbi decode); usually you just let the build script fetch it |

The two you will clone and work with day to day are **openwifi** and **openwifi-hw**. The other two are consumed automatically: `openwifi-hw-img` by the software build scripts, and `openofdm` as a git submodule of `openwifi-hw`.

!!! tip "The `board_name` thread ties it all together"
    The same `board_name` string (e.g. `zed_fmcs2`, `zcu102_fmcs2`) names a board in **all** the repos: `openwifi-hw/boards/$BOARD_NAME/` (FPGA project), `openwifi-hw-img/boards/$BOARD_NAME/sdk/` (prebuilt bitstream), and `openwifi/kernel_boot/boards/$BOARD_NAME/` (boot files + device tree). Set `export BOARD_NAME=...` once and every build script uses it. See [Supported Boards](Supported-Boards.md).

## How the pieces fit at build and run time

- **At run time**, only the `openwifi` repo's artifacts run on the board: the FPGA bitstream (`system_top.bit.bin`), the kernel driver (`sdr.ko` and friends), and the user-space tools. The bitstream originally came from `openwifi-hw` (or was downloaded from `openwifi-hw-img`).
- **At build time**, the driver must agree with the FPGA on the **register map**. That contract is expressed in two mirror-image places: `openwifi/driver/hw_def.h` (the addresses the driver writes) and each core's `*_s_axi.v` in `openwifi-hw/ip/` (the registers the FPGA implements). A driver file and its FPGA counterpart usually even share a name (`xpu.c` ↔ `xpu.v`). This is why the two repos are versioned together in spirit even though they are separate in git.
- **The submodule chain**: `openwifi-hw` pulls in two submodules. [`analogdevicesinc/hdl`](https://github.com/analogdevicesinc/hdl) (the Analog Devices FPGA reference design openwifi is built on top of, pinned to tag `2022_R2`) sits at `adi-hdl/`, and `openofdm` (branch `dot11zynq`) sits at `ip/openofdm_rx/`. A fresh `openwifi-hw` clone has these as **empty directories** until you run `./prepare_adi_lib.sh` and `./get_ip_openofdm_rx.sh` (or `git submodule update --init`).

## Versions this wiki targets

openwifi pins several toolchains and upstream projects, and they intentionally **don't all share a version number**. A 2022-era FPGA toolchain paired with a current kernel is normal here. If a build script or upstream README states a version different from the table below, **trust the upstream repo**: treat this as a snapshot from the last reconciliation with upstream (**11 July 2026**), and bumping it when upstream moves is a welcome contribution.

| Component | Target version | Set / pinned in | Notes |
|---|---|---|---|
| Vivado + Vitis | **2022.2** (needs `Vitis`, not `Vitis_HLS`) | openwifi-hw build scripts | Free tier suffices for Zynq-7020 boards; ZC706 / ZCU102 / Z7035 / RFSoC4x2 need a license to *rebuild* the FPGA. See [FPGA Development](FPGA-Development.md#prerequisites). |
| ADI HDL reference design (`adi-hdl` submodule) | tag **`2022_R2`** | `openwifi-hw` submodule pin | The FPGA design is built on top of it (`prepare_adi_lib.sh`). |
| ADI Linux kernel (`adi-linux` / `adi-linux-64`) | branch **`2026_R1`**, Linux **6.12** | `prepare_kernel.sh` | Patched by `ad9361_v6_12.patch`. See [Boot, Kernel & Device Tree](Boot-Kernel-Device-Tree.md#the-kernel). |
| `openofdm` receiver (submodule) | branch **`dot11zynq`** (HLS variant **`dot11zynq_hls`**) | `get_ip_openofdm_rx.sh` | Backs the `openofdm_rx` core. |
| ADI Kuiper base image | **2023-12-13 release** (`image_2023-12-13-ADI-Kuiper-full.zip`, tagged `2022_r2`) | flashed manually | Just the starting rootfs; you build a current kernel on top. See [Building SD Images](Building-SD-Images.md#adi-kuiper-build-from-scratch). |
| OpenWrt (alternative to Kuiper) | branch **`nlnet`** = OpenWrt **24.10**, Linux **6.6**, mac80211 **6.12** | `openwrt-openwifi` repo | Docker-only build, no Vivado. See [Building SD Images](Building-SD-Images.md#openwrt). |
| Xilinx Viterbi decoder | **evaluation license** | Vivado IP catalog | The eval license halts a running receiver after ~2 hours; a paid license removes the limit. |
| Build-host OS | **Ubuntu 18 / 20 / 22 LTS** | not pinned | Ubuntu 24 needs `libtinfo5` installed manually (see [FPGA Development](FPGA-Development.md#prerequisites)). |

!!! note "Driver and FPGA ship as a matched set"
    openwifi's releases are codenamed (for example `v1.5.0` *shahecheng*, `v1.2.0` *leuven*) and version the driver and the FPGA design **together**, because the two sides share a register-map contract (`driver/hw_def.h` on the driver side, each core's `*_s_axi.v` on the FPGA side). Run a driver against the bitstream from the **same** release rather than mixing across versions; the `wgd.sh` hot-reload flow exists to swap matched driver + FPGA pairs on a running board without rebooting (see [Software Development Workflow](Software-Development-Workflow.md)). There is no formal cross-version compatibility matrix, so when in doubt, match versions. The full release history and notes live on the [openwifi releases page](https://github.com/open-sdr/openwifi/releases).

## Where do I look for…?

A quick index from "I need to change X" to "open this repo/directory."

### …runtime behavior (rates, power, CCA, ACK, slicing)
`openwifi/user_space/`: dozens of helper scripts wrap `sdrctl` register writes. Start with the [sdrctl & Runtime Control](sdrctl-and-Runtime-Control.md) page. The tool itself is `openwifi/user_space/sdrctl_src/`.

### …the driver / how Linux talks to the hardware
`openwifi/driver/`: `sdr.c` (the `mac80211` driver), `sdrctl_intf.c` (the `sdrctl` netlink handler), `sysfs_intf.c` (statistics), `hw_def.h` (register addresses). See [Architecture](Architecture.md).

### …the PHY (OFDM modulation/demodulation) or the real-time MAC (CSMA/CA, ACK, TSF)
`openwifi-hw/ip/`: one directory per IP core. `xpu/` is the real-time MAC, `openofdm_tx/` and `openofdm_rx/` are the PHY, `tx_intf/`/`rx_intf/` are the RF/DAC/ADC interfaces, `side_ch/` is CSI/IQ capture. See [FPGA IP Cores](FPGA-IP-Cores.md).

### …CSI / IQ capture (the research features)
Three places cooperate: `openwifi-hw/ip/side_ch/` (the FPGA capture engine), `openwifi/driver/side_ch/` (the `side_ch.ko` kernel module), and `openwifi/user_space/side_ch_ctl_src/` (the `side_ch_ctl` tool plus the Python/MATLAB display scripts). See [Research Features](Research-Features.md).

### …how a board boots (kernel, device tree, U-Boot, BOOT.BIN)
`openwifi/kernel_boot/`: per-board boot artifacts under `boards/<board_name>/`, kernel patches, and the device-tree overlay machinery (`construct_device_tree.sh`, `openwifi_32_ad9361.dtso` / `openwifi_64_ad9361.dtso`). See [Boot, Kernel & Device Tree](Boot-Kernel-Device-Tree.md).

### …adding or porting a board
Both repos: `openwifi-hw/boards/<board_name>/` (Vivado project) and `openwifi/kernel_boot/boards/<board_name>/` (device tree + boot files). See [FPGA Development → Porting to a new board](FPGA-Development.md#porting-to-a-new-board).

### …a prebuilt bitstream (skip synthesis)
[`openwifi-hw-img`](https://github.com/open-sdr/openwifi-hw-img), `boards/<board_name>/sdk/`.

### …the authoritative docs / app notes
`openwifi/doc/` and `openwifi/doc/app_notes/`. This wiki is a reorganized companion to those files; when the wiki and the repo disagree, trust the repo (and please fix the wiki).

## Repository directory maps

For quick orientation, here is the top-level layout of the two repos you will work in.

**openwifi** (driver + software + docs):

```
openwifi/
├── driver/            # Linux kernel driver (sdr.c, hw_def.h, sdrctl_intf.c, sysfs_intf.c, per-core sub-drivers)
├── user_space/        # sdrctl, side_ch_ctl, inject_80211, ~70 helper scripts, demo configs
│   ├── sdrctl_src/         # the sdrctl CLI
│   ├── side_ch_ctl_src/    # side_ch_ctl + Python/MATLAB CSI/IQ display scripts
│   ├── inject_80211/       # packet injection + analyze_80211
│   └── arbitrary_iq_gen/   # generate arbitrary TX IQ waveforms
├── kernel_boot/       # SD-card boot files: per-board device trees, U-Boot, kernel patches/config
│   └── boards/             # one directory per board_name
├── doc/               # architecture reference, app notes, known issues, publications, videos
│   ├── app_notes/          # CSI, IQ, fuzzer, radar, injection, 802.11n, HLS, etc.
│   ├── img_build_instruction/  # Kuiper and OpenWrt SD-image build guides
│   └── known_issue/            # notter.md: the canonical troubleshooting list
└── README.md
```

**openwifi-hw** (FPGA design):

```
openwifi-hw/
├── ip/                # the custom openwifi IP cores (the heart of the design)
│   ├── xpu/                # real-time MAC: CSMA/CA, ACK, TSF, TX-queue gating, RSSI/CCA
│   ├── openofdm_tx/        # 802.11 OFDM transmitter (IFFT, FEC, modulation, preambles)
│   ├── openofdm_rx/        # 802.11 OFDM receiver (submodule → openofdm, dot11zynq branch)
│   ├── tx_intf/            # DAC-side interface + TX BRAM + CSI fuzzer
│   ├── rx_intf/            # ADC-side interface + RX DMA
│   └── side_ch/            # CSI / raw-IQ capture side channel
├── boards/            # one Vivado project per board_name (system.bd, .xdc, system_top.v, TCL)
├── adi-hdl/           # submodule → analogdevicesinc/hdl (ADI reference design), tag 2022_R2
├── prepare_adi_lib.sh, prepare_adi_board_ip.sh, get_ip_openofdm_rx.sh
├── gpio_led.md        # which FPGA signals are routed to board LEDs / PMOD test points
└── README.md
```

## Licensing and contributing across the repos

All openwifi repositories are **dual-licensed**: [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html) for the open-source release, with commercial/advanced-feature licensing available via [openwifi.tech](https://openwifi.tech). Individual files may be GPL-2.0-or-later or BSD-3-Clause, and vendored third-party components (Analog Devices HDL, the Xilinx Viterbi decoder, openofdm) carry their own terms, so check per-file headers for your use case.

Contributing to **any** repo requires signing a Contributor License Agreement (Individual or Entity, generated via the [Project Harmony](http://www.harmonyagreements.org/) framework) and emailing it to `Filip.Louagie@UGent.be` before your first contribution. See each repo's `CONTRIBUTING.md`.

The project originated at **Ghent University / imec** (Xianjun Jiao, Wei Liu, Michael Mehari, and contributors), funded by the EU H2020 [ORCA project](https://www.orca-project.eu/) (grant 732174) and [NLnet](https://nlnet.nl/)/NGI Zero. See [FAQ & Resources](FAQ-and-Resources.md) for citation info and the publication list.
