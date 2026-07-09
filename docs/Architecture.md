# Architecture Overview

This page explains how openwifi is put together. Read it before you start modifying code — almost every "how do I…" question becomes obvious once you understand the split between Linux, the driver, and the FPGA. (For *where* each part lives in the source tree, see [The Repositories](Repositories.md); for the FPGA cores in depth, see [FPGA IP Cores](FPGA-IP-Cores.md).)

![openwifi software and FPGA module composition](assets/img/openwifi-detail.jpg)

*openwifi's full composition: software modules (top) and FPGA modules (bottom). The module names in this diagram match the source file names — `xpu`, `openofdm_tx/rx`, `tx_intf`, `rx_intf`, `side_ch` — which is the key to navigating both the code and this wiki.*

## The big picture

openwifi is a **SoftMAC** Wi-Fi design. The word "soft" refers to where the *upper* MAC lives: management, association, and higher-layer logic run in software (Linux `mac80211`), exactly as they do for a commercial SoftMAC chip. What makes openwifi unusual is that the **PHY and the timing-critical low MAC live in FPGA fabric** that you can read, modify, and rebuild.

Layered from top to bottom:

- **Linux user space** — `hostapd`, `wpa_supplicant`, `iw`, `dhclient`, `tcpdump`, plus openwifi's own `sdrctl` tool and helper scripts.
- **Linux kernel: cfg80211 / mac80211** — the generic Linux wireless stack. Handles the upper MAC and calls into the driver through a fixed API.
- **openwifi driver (`driver/sdr.c` and friends)** — a SoftMAC driver that implements the mac80211 API and translates it into FPGA register writes and DMA transfers.
- **FPGA design (the openwifi-hw repo)** — OFDM transmitter and receiver, the CSMA/CA low MAC, and DMA interfaces to the processor.
- **AD9361 RF front end** — the analog radio (70 MHz–6 GHz), connected to the FPGA over the Analog Devices RF interface and controlled in real time over an FPGA-driven SPI link.

Because it registers a normal Linux network interface (`sdr0`), every tool that works with a commercial card works here too. That's the whole point.

## How the driver talks to Linux: the mac80211 API

The Linux `mac80211` subsystem defines a set of callbacks (`ieee80211_ops`) that every SoftMAC driver implements. That shared contract is why one kernel can drive Wi-Fi chips from dozens of vendors. openwifi's `sdr.c` implements the relevant subset. The most important callbacks:

| Callback | When Linux calls it |
|---|---|
| `tx` | There's a packet to transmit |
| `start` / `stop` | The NIC is brought up / down (`ifconfig sdr0 up/down`) |
| `add_interface` / `remove_interface` | A virtual interface is created / deleted |
| `config` | Channel / frequency change (e.g. during a scan) |
| `bss_info_changed` | BSS parameters change (BSSID, TX power, beacon interval…) |
| `conf_tx` | TX parameters change (AIFS, CW_MIN, CW_MAX, TXOP) |
| `configure_filter` | Frame-filtering rules change |
| `set_antenna` / `get_antenna` | Select / read the TX/RX antenna |
| `get_tsf` / `set_tsf` / `reset_tsf` | Read / write / reset the 64-bit TSF hardware timer |
| `set_rts_threshold` | Change the packet length that triggers RTS/CTS |
| `ampdu_action` | A-MPDU (aggregation) operations |
| `testmode_cmd` | Handles `sdrctl` commands (see [sdrctl](sdrctl-and-Runtime-Control.md)) |

When Linux invokes one of these, `sdr.c` does the work by driving the FPGA. It leans on per-block helper "sub-drivers" — `tx_intf_api`, `rx_intf_api`, `openofdm_tx_api`, `openofdm_rx_api`, and `xpu_api` — each of which wraps register access to one FPGA module. These are compiled as separate kernel modules (`tx_intf.ko`, `rx_intf.ko`, …) that `sdr.ko` binds to at load time, which is why `wgd.sh` inserts all of them.

A few implementation facts worth knowing:

- openwifi is a Linux **platform driver** (not PCI or USB): it binds to a device-tree node with `compatible = "sdr,sdr"`. The device tree is what tells Linux the AXI addresses and interrupts of every FPGA block — which is why [porting a board](FPGA-Development.md#porting-to-a-new-board) is largely a device-tree exercise.
- At probe time (`openwifi_dev_probe()`) the driver reads the device-tree `model` string to detect the **hardware type** (`ZYNQ_AD9361`, `ZYNQMP_AD9361`, `RFSOC4X2`) and whether it's a **small or large FPGA** — the latter is how features like capture-buffer length adapt per board automatically.
- The AD9361 RF chip is itself driven by the standard Analog Devices IIO driver; openwifi finds it on the SPI bus and calls into it (e.g. `ad9361_set_tx_atten`, `ad9361_rf_set_channel`). This is also why some patches to the ADI kernel are needed — see [Software Development Workflow](Software-Development-Workflow.md#rebuilding-the-driver).
- TX uses a 64-entry DMA ring of buffer descriptors; RX uses a cyclic DMA buffer. The driver keeps write/read indices so the running `openwifi_tx()`, the FPGA, and the interrupt handler can cross-check each other.

## The FPGA modules

The FPGA design decomposes into modules whose names match their source files (in `openwifi-hw/ip/`). Understanding these five names unlocks most of the register documentation:

- **`openofdm_tx`** — the OFDM transmitter. Turns a MAC frame into baseband IQ samples (PHY header, pilots, scrambling, modulation). Based on original openwifi work.
- **`openofdm_rx`** — the OFDM receiver. Detects the preamble, synchronizes, estimates the channel, equalizes, and decodes (including a Xilinx Viterbi decoder). Derived from the [openofdm](https://github.com/jhshi/openofdm) project (openwifi's improvements live on the `dot11zynq` branch of the fork).
- **`tx_intf`** — the transmit interface: DMA from the processor into per-queue FIFOs, the DAC feed, per-packet PHY configuration, and the four hardware TX queues.
- **`rx_intf`** — the receive interface: takes decoded packets and side-channel data, attaches metadata (TSF timestamp, RSSI, length, MCS, FCS status), and DMAs them up to the processor.
- **`xpu`** — the "eXtensible Processing Unit," which holds the **real-time low MAC**: the CSMA/CA state machine, NAV, DIFS/SIFS/EIFS timing, the TSF timer, hardware ACK generation and reception, retransmission, RTS/CTS, packet filtering, and the time-slicing gates for the TX queues. If a behavior has to happen in microseconds, it's in `xpu`.

There's also a **`side_ch`** (side channel) module used for research features — CSI and IQ capture — described on the [Research Features](Research-Features.md) page.

The processor reaches these modules over the ARM **AXI bus**. Each module exposes a bank of registers (`slv_regN` in the Verilog), whose addresses are defined in `driver/hw_def.h`. This AXI coupling is what gives openwifi very low processor↔PHY latency — and also what makes the design fairly platform-specific.

For a core-by-core walkthrough — the submodules inside `xpu` (the CSMA/CA state machine, TSF timer, hardware SPI to the AD9361), the OFDM transmit and receive chains, and how a register write travels from `sdrctl` all the way to a `slv_regN` — see the dedicated [FPGA IP Cores](FPGA-IP-Cores.md) page.

openwifi's FPGA design is built **on top of the [Analog Devices HDL reference design](https://github.com/analogdevicesinc/hdl)** (vendored as the `adi-hdl` submodule of openwifi-hw): ADI provides the AD9361 interfacing IP, DMA engines, and board plumbing, and openwifi inserts its own cores into that design. This is why [porting to a new board](FPGA-Development.md#porting-to-a-new-board) is framed as "diff openwifi against the matching ADI reference design."

## The receive path, step by step

1. A signal arrives at the AD9361 and is delivered to the FPGA as IQ samples.
2. `openofdm_rx` detects, synchronizes, and decodes it. Whether the FCS/CRC passes or fails, the packet is offered up if the current frame-filtering rules allow it (in monitor mode, everything is allowed — even bad-CRC frames and control frames like ACKs).
3. `rx_intf` writes the packet plus metadata into a DMA buffer and raises an interrupt.
4. The driver's `openwifi_rx_interrupt()` runs: it pulls the raw buffer, parses out the inserted metadata (TSF timestamp, raw RSSI which is then corrected to dBm per band/channel, length, MCS, FCS-valid flag), and hands the packet and its metadata to Linux via `ieee80211_rx_irqsafe()`.

## The transmit path, step by step

1. Linux `mac80211` calls `openwifi_tx()` with a frame to send.
2. The driver reads what it needs from the 802.11 header and mac80211 metadata: length and MCS; unicast vs broadcast; whether an ACK is required and the maximum number of retransmissions the FPGA may attempt; which TX queue / time slice to use; whether RTS/CTS or CTS-to-self protection applies; whether the driver should insert a sequence number.
3. It maintains an internal write index (`ring->bd_wr_idx`) so that the active `openwifi_tx()`, the FPGA, and the later interrupt handler can cross-check each other.
4. It writes the per-packet FPGA configuration (so the FPGA generates the right PHY header, etc.) and fires a DMA transfer into one of the four FPGA TX queues. The packet may not go out immediately — the FPGA sends it when the channel and the CSMA state machine allow.
5. When the FPGA finishes sending, it raises an interrupt. `openwifi_tx_interrupt()` reads back the result (success/failure — i.e. was an ACK received — and how many retransmissions happened) and reports it to Linux via `ieee80211_tx_status_irqsafe()`.

## The TSF timestamp

The 64-bit TSF (Timing Synchronization Function) timer is defined by the 802.11 standard and implemented in the FPGA. When a packet's PHY header is received, the FPGA samples the TSF value and attaches it to the packet's DMA buffer; the driver forwards it to Linux, which is why you see a consistent TSF timestamp in Wireshark/tcpdump. That same TSF value is the key that lets you line up side-channel data (CSI, IQ) with specific packets — they share one time base. (See [this discussion](https://github.com/open-sdr/openwifi/discussions/344) for the matching recipe.)

## RF and baseband: the frequency/clock design

openwifi drives the AD9361 in **FDD mode with identical TX and RX frequencies**, and controls the AD9361 TX chain in real time over an FPGA SPI link (`openwifi-hw/ip/xpu/src/spi.v`). The TX local oscillator (or an RF switch) is turned **on just before** a transmit packet and **off just after** it. Two consequences follow:

- **No LO leakage during receive**, so the receiver isn't self-interfered — this is what enables full-duplex self-reception (the basis of the CSI radar and loopback features).
- **Fast TX/RX turnaround** (~0.6 µs), which is what makes the 10 µs SIFS and hardware ACK timing achievable.

The AD9361↔FPGA IQ rate is 40 Msps, decimated/interpolated inside the FPGA to the 20 Msps the WiFi baseband uses. Crucially, the **FPGA baseband clock is derived from the AD9361 clock**, so RF and baseband never drift relative to each other. This design (replacing the older "offset tuning" approach) is what gives openwifi its good EVM, spectral mask conformance, sensitivity, and RSSI accuracy.

![Baseband clock derived from the AD9361 clock](assets/img/bb-clk.jpg)

*The FPGA baseband clock is generated from the AD9361 sample clock, so the two never drift. The exact clock frequency per board is the `NUM_CLK_PER_US` knob discussed in [Supported Boards](Supported-Boards.md#the-baseband-clock-per-board).*

The configuration points of this RF/digital chain are spread across the AD9361 registers, the driver's `.c` files, and the FPGA `.v` modules:

![RF and digital IF chain configuration points](assets/img/rf-digital-if-chain-config.jpg)

## What openwifi implements of 802.11a/g/n

openwifi implements 802.11a/g (legacy OFDM) and a **single-stream 20 MHz subset of 802.11n (Wi-Fi 4)**. Understanding which 11n improvements it does and doesn't have explains its performance envelope. 802.11n added five PHY improvements on top of 802.11a/g's 54 Mbps ceiling:

| 802.11n improvement | Effect | openwifi? |
|---|---|---|
| **More subcarriers** (48 → 52 data) | 54 → 58.5 Mbps | ✅ yes |
| **Higher FEC rate** (3/4 → 5/6) | 58.5 → 65 Mbps | ✅ yes |
| **Short guard interval** (800 → 400 ns) | 65 → 72.2 Mbps | ✅ yes |
| **MIMO** (up to 4 spatial streams) | 72.2 → 288.9 Mbps | ❌ no |
| **40 MHz bandwidth** (108 data subcarriers) | 288.9 → 600 Mbps | ❌ no |

So the open-source release reaches a **theoretical 72.2 Mbps single-stream**, not the full-11n 600 Mbps (which requires 4×4 MIMO + 40 MHz).

<figure markdown>
![48 vs 52 OFDM data subcarriers](assets/img/subcarriers.png){ width="440" }
<figcaption>More data subcarriers (48 → 52): openwifi implements this.</figcaption>
</figure>

<figure markdown>
![800 ns vs 400 ns guard interval](assets/img/guard-interval.png){ width="440" }
<figcaption>Short guard interval (800 → 400 ns): openwifi implements this.</figcaption>
</figure>

On the **MAC** side, 802.11n added frame aggregation. There are two flavors: **A-MSDU** (efficient, but one bit error invalidates the whole aggregate) and **A-MPDU** (per-subframe headers, so a single error only costs one retransmission — the more widely adopted choice).

![A-MPDU vs A-MSDU aggregation](assets/img/mpdu-aggr.png)

openwifi supports **A-MPDU aggregation experimentally** (`./wgd.sh 1`, which sets `test_mode` bit 0); A-MSDU is not supported. Background and the full derivation are in the [802.11n app note](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/ieee80211n.md).

## Where the source lives

| Component | Location |
|---|---|
| Driver (main) | `openwifi/driver/sdr.c`, `sdr.h` |
| Per-block driver APIs | `openwifi/driver/{tx_intf,rx_intf,openofdm_tx,openofdm_rx,xpu,side_ch}/` |
| Register addresses | `openwifi/driver/hw_def.h` |
| sdrctl ↔ driver glue | `openwifi/driver/sdrctl_intf.c` |
| sysfs interface | `openwifi/driver/sysfs_intf.c` |
| `sdrctl` tool source | `openwifi/user_space/sdrctl_src/` |
| Helper scripts & demos | `openwifi/user_space/` |
| FPGA IP cores | `openwifi-hw/ip/{openofdm_tx,openofdm_rx,tx_intf,rx_intf,xpu,side_ch}/` |
| Board-level FPGA projects | `openwifi-hw/boards/<board_name>/` |

A useful convention: a driver file and its FPGA counterpart usually share a name (`xpu.c` ↔ `xpu.v`), and each FPGA register is `slv_regN` in the `.v` file. The register tables on the [sdrctl](sdrctl-and-Runtime-Control.md) page always point back to these.

## Two communication channels between driver and user space

1. **`sdrctl`** — an `nl80211` testmode command, routed through the standard `nl80211 → cfg80211 → mac80211` path and handled by `openwifi_testmode_cmd()` in `sdrctl_intf.c`. Best for issuing commands and reading/writing registers.
2. **sysfs** — driver variables exposed as virtual files (via `sysfs_intf.c`). Best for statistics and for scripts. On the ZCU102 these files live under `/sys/devices/platform/fpga-axi@0/fpga-axi@0:sdr`; on other boards under `/sys/devices/soc0/fpga-axi@0/fpga-axi@0:sdr`.
