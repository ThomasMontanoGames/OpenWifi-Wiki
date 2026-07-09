# The openwifi Project and Its Repositories

New to openwifi? Start here. This page explains **what the project is made of**, **why it is split across several repositories**, and — most usefully — **where to look when you need to find something**. Once the repository map makes sense, everything else on this wiki has an obvious home.

## The one-sentence version

openwifi is a full-stack, Linux `mac80211`-compatible IEEE 802.11 (Wi-Fi) implementation for SDR hardware. The **radio PHY and real-time MAC live in FPGA fabric**; the **driver and everything above it are ordinary Linux**. Because those two worlds are developed with completely different tools (Verilog + Vivado vs. C + the kernel build system), they live in **separate repositories**.

## Why more than one repository?

There is not one "openwifi repo" — there are four, each with a distinct job, a distinct toolchain, and a distinct release cadence:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     The openwifi project (open-sdr)                   │
├──────────────────┬───────────────────┬───────────────┬──────────────┤
│    openwifi      │   openwifi-hw     │ openwifi-hw-img│   openofdm   │
│                  │                   │               │              │
│ Linux driver +   │ FPGA design       │ Pre-built     │ 802.11 OFDM  │
│ user-space tools │ (Verilog/HLS IP + │ bitstreams    │ receiver     │
│ + boot files +   │ per-board Vivado  │ per board     │ (submodule   │
│ docs             │ projects)         │ (.xsa/.bit)   │ of -hw)      │
│                  │                   │               │              │
│ Tools: C, kernel │ Tools: Verilog,   │ Tools: none — │ Tools:       │
│ build, bash      │ Vivado 2022.2     │ just download │ Verilog/HLS  │
└──────────────────┴───────────────────┴───────────────┴──────────────┘
        │                   │                   │              │
        └── driver builds ──┘                   │              └── vendored into
            against the FPGA's register map     │                  openwifi-hw/ip/openofdm_rx
                                                 │
        openwifi's build scripts pull bitstreams from here ──┘
```

| Repository | What it holds | When you touch it |
|---|---|---|
| **[openwifi](https://github.com/open-sdr/openwifi)** | The Linux kernel driver, `sdrctl` and other user-space tools, capture/demo scripts, SD-card boot files (kernel patches, device trees, u-boot), and **all the documentation** | Rebuilding the driver, changing runtime behavior, writing scripts, flashing/booting a board, reading app notes |
| **[openwifi-hw](https://github.com/open-sdr/openwifi-hw)** | The **FPGA design**: openwifi's custom IP cores (`xpu`, `openofdm_tx`, `tx_intf`, `rx_intf`, `side_ch`, and the `openofdm_rx` submodule) plus a Vivado project per supported board | Modifying the PHY or real-time MAC, adding a board, rebuilding the bitstream |
| **[openwifi-hw-img](https://github.com/open-sdr/openwifi-hw-img)** | **Pre-built FPGA bitstreams** for each board (`.xsa`, bitstream, ILA `.ltx`, init files under `boards/<board_name>/sdk/`), plus the CLA/doc PDFs | You want a working bitstream *without* installing Vivado or waiting hours for synthesis |
| **[openofdm](https://github.com/open-sdr/openofdm)** | The 802.11 **OFDM receiver** that `openofdm_rx` is based on. openwifi's improvements live on the `dot11zynq` branch (and `dot11zynq_hls` for the HLS variant). Originally by [jhshi](https://github.com/jhshi/openofdm) | Deep receiver work (synchronization, channel estimation, Viterbi decode); usually you just let the build script fetch it |

The two you will clone and work in day-to-day are **openwifi** and **openwifi-hw**. The other two are consumed automatically: `openwifi-hw-img` by the software build scripts, and `openofdm` as a git submodule of `openwifi-hw`.

!!! tip "The `board_name` thread ties it all together"
    The same `board_name` string (e.g. `zed_fmcs2`, `zcu102_fmcs2`) names a board in **all** the repos: `openwifi-hw/boards/$BOARD_NAME/` (FPGA project), `openwifi-hw-img/boards/$BOARD_NAME/sdk/` (prebuilt bitstream), and `openwifi/kernel_boot/boards/$BOARD_NAME/` (boot files + device tree). Set `export BOARD_NAME=...` once and every build script uses it. See [Supported Boards](Supported-Boards.md).

## How the pieces fit at build and run time

- **At run time**, only the `openwifi` repo's artifacts run on the board: the FPGA bitstream (`system_top.bit.bin`), the kernel driver (`sdr.ko` and friends), and the user-space tools. The bitstream originally came from `openwifi-hw` (or was downloaded from `openwifi-hw-img`).
- **At build time**, the driver must agree with the FPGA on the **register map**. That contract is expressed in two mirror-image places: `openwifi/driver/hw_def.h` (the addresses the driver writes) and each core's `*_s_axi.v` in `openwifi-hw/ip/` (the registers the FPGA implements). A driver file and its FPGA counterpart usually even share a name — `xpu.c` ↔ `xpu.v`. This is why the two repos are versioned together in spirit even though they are separate in git.
- **The submodule chain**: `openwifi-hw` pulls in two submodules — [`analogdevicesinc/hdl`](https://github.com/analogdevicesinc/hdl) (the Analog Devices FPGA reference design openwifi is built on top of, pinned to tag `2022_R2`) as `adi-hdl/`, and `openofdm` (branch `dot11zynq`) as `ip/openofdm_rx/`. A fresh `openwifi-hw` clone has these as **empty directories** until you run `./prepare_adi_lib.sh` and `./get_ip_openofdm_rx.sh` (or `git submodule update --init`).

## Where do I look for…?

A quick index from "I need to change X" to "open this repo/directory."

### …runtime behavior (rates, power, CCA, ACK, slicing)
`openwifi/user_space/` — dozens of helper scripts wrap `sdrctl` register writes. Start with the [sdrctl & Runtime Control](sdrctl-and-Runtime-Control.md) page. The tool itself is `openwifi/user_space/sdrctl_src/`.

### …the driver / how Linux talks to the hardware
`openwifi/driver/` — `sdr.c` (the `mac80211` driver), `sdrctl_intf.c` (the `sdrctl` netlink handler), `sysfs_intf.c` (statistics), `hw_def.h` (register addresses). See [Architecture](Architecture.md).

### …the PHY (OFDM modulation/demodulation) or the real-time MAC (CSMA/CA, ACK, TSF)
`openwifi-hw/ip/` — one directory per IP core. `xpu/` is the real-time MAC, `openofdm_tx/` and `openofdm_rx/` are the PHY, `tx_intf/`/`rx_intf/` are the RF/DAC/ADC interfaces, `side_ch/` is CSI/IQ capture. See [FPGA IP Cores](FPGA-IP-Cores.md).

### …CSI / IQ capture (the research features)
Three places cooperate: `openwifi-hw/ip/side_ch/` (the FPGA capture engine), `openwifi/driver/side_ch/` (the `side_ch.ko` kernel module), and `openwifi/user_space/side_ch_ctl_src/` (the `side_ch_ctl` tool plus the Python/MATLAB display scripts). See [Research Features](Research-Features.md).

### …how a board boots (kernel, device tree, u-boot, BOOT.BIN)
`openwifi/kernel_boot/` — per-board boot artifacts under `boards/<board_name>/`, kernel patches, and the device-tree overlay machinery (`construct_device_tree.sh`, `openwifi_32_ad9361.dtso` / `openwifi_64_ad9361.dtso`). See [Software Development Workflow](Software-Development-Workflow.md).

### …adding or porting a board
Both repos: `openwifi-hw/boards/<board_name>/` (Vivado project) and `openwifi/kernel_boot/boards/<board_name>/` (device tree + boot files). See [FPGA Development → Porting to a new board](FPGA-Development.md#porting-to-a-new-board).

### …a prebuilt bitstream (skip synthesis)
[`openwifi-hw-img`](https://github.com/open-sdr/openwifi-hw-img), `boards/<board_name>/sdk/`.

### …the authoritative docs / app notes
`openwifi/doc/` and `openwifi/doc/app_notes/`. This wiki is a reorganized companion to those files — when the wiki and the repo disagree, trust the repo (and please fix the wiki).

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
├── kernel_boot/       # SD-card boot files: per-board device trees, u-boot, kernel patches/config
│   └── boards/             # one directory per board_name
├── doc/               # architecture reference, app notes, known issues, publications, videos
│   ├── app_notes/          # CSI, IQ, fuzzer, radar, injection, 802.11n, HLS, etc.
│   ├── img_build_instruction/  # Kuiper and OpenWrt SD-image build guides
│   └── known_issue/            # notter.md — the canonical troubleshooting list
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

All openwifi repositories are **dual-licensed**: [AGPLv3](https://www.gnu.org/licenses/agpl-3.0.en.html) for the open-source release, with commercial/advanced-feature licensing available via [openwifi.tech](https://openwifi.tech). Individual files may be GPL-2.0-or-later or BSD-3-Clause, and vendored third-party components (Analog Devices HDL, the Xilinx Viterbi decoder, openofdm) carry their own terms — check per-file headers for your use case.

Contributing to **any** repo requires signing a Contributor License Agreement (Individual or Entity, generated via the [Project Harmony](http://www.harmonyagreements.org/) framework) and emailing it to `Filip.Louagie@UGent.be` before your first contribution. See each repo's `CONTRIBUTING.md`.

The project originated at **Ghent University / imec** (Xianjun Jiao, Wei Liu, Michael Mehari, and contributors), funded by the EU H2020 [ORCA project](https://www.orca-project.eu/) (grant 732174) and [NLnet](https://nlnet.nl/)/NGI Zero. See [FAQ & Resources](FAQ-and-Resources.md) for citation info and the publication list.
