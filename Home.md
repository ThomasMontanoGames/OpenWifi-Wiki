# openwifi Wiki

Welcome! This wiki is a reorganized, plain-language guide to **openwifi** — a free and open-source, Linux `mac80211`-compatible, full-stack IEEE 802.11 (Wi-Fi) implementation that runs on SDR (Software Defined Radio) hardware built around Xilinx Zynq SoCs and the Analog Devices AD9361 RF front end.

Unlike a commercial Wi-Fi chip, every layer of openwifi is open and modifiable: the OFDM PHY runs in FPGA fabric, the real-time low MAC (CSMA/CA) runs in FPGA, the driver is a standard Linux SoftMAC driver, and everything above that is the ordinary Linux wireless stack (`hostapd`, `wpa_supplicant`, `iw`, Wireshark, and friends). That makes it a uniquely powerful platform for wireless research, education, and experimentation.

> ⚠️ **Spectrum regulation notice.** Transmitting over the air is regulated everywhere. It is *your* responsibility to comply with your local spectrum regulations. When in doubt, use coaxial cable with attenuators, or a shielded chamber, instead of antennas.

## What openwifi can do

- **802.11a/g/n operation** at 20 MHz bandwidth, with the RF front end tunable anywhere from 70 MHz to 6 GHz (2 MHz mode for 802.11ah-style sub-GHz work and 10 MHz for 802.11p vehicular experiments are also possible).
- **All the usual roles**: Access Point, client (station), ad-hoc, and monitor mode — driven by the standard Linux tools.
- **A real-time low MAC in FPGA**: DCF/CSMA-CA with a 10 µs SIFS, hardware ACK generation, retransmission, RTS/CTS, and NAV — all of it configurable or defeatable for experiments.
- **Research superpowers** a commercial chip won't give you: per-packet CSI extraction, raw IQ capture with dozens of trigger conditions, packet injection and fuzzing, a CSI fuzzer for privacy research, full-duplex self-reception ("Wi-Fi as radar"), and time-sliced FPGA transmit queues for network slicing.
- **Solid performance** in its best configuration (802.11n with A-MPDU aggregation): roughly 40–50 Mbps TCP and ~50 Mbps UDP in iperf, EVM around −38 dB, and receiver sensitivity around −92 dBm at MCS0 / −73 dBm at MCS7 (measured with FMCOMMS2 at 2.4 GHz).

Note: MIMO and 40 MHz bandwidth are *not* supported in the open-source release; 802.11ax and other advanced features are part of the commercial offering at [openwifi.tech](https://openwifi.tech).

## The repositories

| Repository | Contents |
|---|---|
| [openwifi](https://github.com/open-sdr/openwifi) | Linux kernel driver, user-space tools (`sdrctl`, capture scripts, demo scripts), SD-card boot files, documentation |
| [openwifi-hw](https://github.com/open-sdr/openwifi-hw) | FPGA design: the openwifi IP cores plus board-level Vivado projects |
| [openwifi-hw-img](https://github.com/open-sdr/openwifi-hw-img) | Pre-built FPGA bitstreams per board, so you can skip hours of synthesis |
| [openofdm](https://github.com/jhshi/openofdm) (fork: `dot11zynq` branch) | The 802.11 OFDM receiver that openwifi's `openofdm_rx` IP is based on |

## Where to go next

**New to the project?** Read these in order:

1. [Getting Started](Getting-Started.md) — hardware you need, flashing the SD card, bringing up your first openwifi AP.
2. [Architecture Overview](Architecture.md) — how the FPGA, driver, and Linux stack fit together. Required reading before touching code.
3. [Operating Modes](Operating-Modes.md) — AP, client, ad-hoc, monitor, and packet injection walkthroughs.

**Using and controlling the system:**

4. [sdrctl and Runtime Control](sdrctl-and-Runtime-Control.md) — the register interface and the everyday knobs: TX power, rates, gain, CCA, ACK behavior, antenna selection, arbitrary frequencies.

**Developing:**

5. [Software Development Workflow](Software-Development-Workflow.md) — rebuilding the driver, reloading driver + FPGA without rebooting, building full SD images.
6. [FPGA Development](FPGA-Development.md) — building the bitstream from source, modifying and simulating IP cores, HLS, porting to new boards.

**Research features:**

7. [CSI, IQ Capture and Research Features](Research-Features.md) — CSI extraction, CSI radar, CSI fuzzer, IQ capture, loopback testing, counters and statistics.

**When things go wrong:**

8. [Troubleshooting and Known Issues](Troubleshooting.md)
9. [FAQ and Resources](FAQ-and-Resources.md) — 802.11b compatibility, ASIC questions, publications, citing openwifi, licensing, community channels.

## License and attribution

Openwifi is dual-licensed: **AGPLv3** for the open-source release, with commercial licensing available via [openwifi.tech](https://openwifi.tech). The project incorporates third-party components (Analog Devices HDL, Xilinx IP such as the Viterbi decoder, the openofdm receiver) with their own license terms — verify each component's license for your intended use. Openwifi was created at Ghent University / imec (Xianjun Jiao, Michael Mehari, Wei Liu, and contributors) with funding from the EU H2020 ORCA project and NLnet/NGI Zero.

This wiki is a rewritten, restructured companion to the official documentation. The repositories remain the authoritative source; if this wiki and the repos disagree, trust the repos (and please fix the wiki!).
