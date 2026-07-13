# Specifications (Datasheet)

This page is a **datasheet-style reference** for openwifi: the numbers you need to judge whether it fits your radio, FPGA, and timing budget, collected in one place.

Every figure carries a **footnote** pointing to its source so you can check it. Two conventions to note:

- **The repository is authoritative.** Where a number comes from openwifi's own code, docs, or release notes, the footnote links to it. If a build script or upstream README states something different from this page, trust the upstream repo and please fix this page.
- **Standard-derived values are marked** with the `[802.11]`[^std] footnote. These follow from the IEEE 802.11 standard and the PHY parameters openwifi implements (e.g. 20 MHz OFDM), not from an openwifi-specific measurement.

!!! warning "Configuration matters"
    openwifi is a *modifiable* design. Bandwidth, baseband clock, MAC timing, and even the FPGA resource footprint depend on how you build and configure it. The figures below describe the **default, open-source `master` configuration** on the reference boards unless stated otherwise.

## At a glance

| Parameter | Value |
|---|---|
| Wi-Fi standards | 802.11a / 802.11g / 802.11n (Wi-Fi 4), 20 MHz, single spatial stream[^readme] |
| Channel bandwidth | 20 MHz (also 10 MHz for 802.11p, 2 MHz for 802.11ah-style sub-GHz)[^readme] |
| RF tuning range | 70 MHz – 6 GHz (Analog Devices AD9361/AD9364 front end)[^faq] |
| Baseband transceiver sample rate | 20 Msps (20 MHz mode)[^docreadme] |
| AD9361 ↔ FPGA sample rate | 40 Msps (decimated/interpolated to 20 Msps in the FPGA)[^docreadme] |
| FPGA baseband clock | 100 MHz default (up to 200/240 MHz on high-end boards)[^tcl][^boards] |
| Max PHY rate (open source) | 72.2 Mbps (MCS7, 400 ns short guard interval, theoretical)[^11n] |
| Measured throughput (iperf) | TCP 40–50 Mbps, UDP ~50 Mbps[^readme] |
| TX EVM | −38 dB[^readme] |
| RX sensitivity | −92 dBm @ MCS0, −73 dBm @ MCS7[^readme] |
| Real-time MAC (low MAC) | DCF / CSMA-CA, hardware ACK, retransmission, RTS/CTS, NAV, all in FPGA[^readme] |
| FPGA resource footprint | ~19k LUT, 76.5 BRAM, 121 DSP on Zynq-7020 (ZedBoard)[^release] |

## PHY layer

openwifi implements an OFDM PHY equivalent to 802.11a/g and the single-stream, 20 MHz subset of 802.11n.

| Parameter | Value |
|---|---|
| Modulation | OFDM (BPSK / QPSK / 16-QAM / 64-QAM)[^std] |
| FFT size | 64[^std] |
| Data subcarriers | 52 (802.11n HT); 48 (802.11a/g legacy)[^11n] |
| Occupied bandwidth | 20 MHz (16.6 MHz occupied)[^std] |
| FEC | Convolutional coding, rates 1/2, 2/3, 3/4, **5/6** (5/6 added for HT)[^11n] |
| Guard interval | 800 ns (normal); **400 ns short GI** supported for HT[^11n] |
| OFDM symbol duration | 4 µs (3.6 µs with short GI)[^std] |
| Spatial streams | 1 (SISO); MIMO not supported in open source[^11n] |

!!! note "802.11b is not supported"
    openwifi is OFDM-only; the DSSS/CCK rates of 802.11b are not implemented. An 802.11b `1 Mbps` rate request is converted to `6 Mbps` OFDM.[^docreadme] This is the usual reason a 2.4 GHz client fails to associate. See [Operating Modes → About 802.11b](Operating-Modes.md#about-80211b).

### Data rates

| Mode | Rates | Max (theoretical) |
|---|---|---|
| 802.11a/g (legacy OFDM) | 6, 9, 12, 18, 24, 36, 48, 54 Mbps | 54 Mbps[^std] |
| 802.11n HT (single stream, 20 MHz) | MCS 0–7 | 65 Mbps (800 ns GI) / **72.2 Mbps** (400 ns short GI)[^11n] |

## RF front end

The RF characteristics come from the **Analog Devices AD9361/AD9364** agile transceiver rather than from openwifi itself; openwifi controls it in real time over an FPGA SPI interface. Consult the AD9361 datasheet for full RF specs. The openwifi-relevant facts are:

| Parameter | Value |
|---|---|
| Tuning range | 70 MHz – 6 GHz[^faq] |
| Duplex mode | FDD, same TX and RX frequency; TX LO / RF switch gated per packet for self-interference-free RX[^docreadme] |
| Antenna configurations | 1×1 typical; some boards (AD9361) 2×2-capable[^boards] |
| RF/baseband clock coupling | Baseband clock derived from the AD9361 sample clock, so RF and baseband never drift apart[^docreadme] |

!!! warning "Per-board RF caveats"
    RF performance is board-specific. The ADRV9361-Z7035 has **very low TX power at 5 GHz**, and the stock ANTSDR RF switch **only passes 3–6 GHz**. See [Supported Boards](Supported-Boards.md#board-bring-up-quirks-worth-knowing-up-front).

## MAC-layer timing

openwifi's real-time "low MAC" (the `xpu` core) runs the DCF/CSMA-CA state machine in FPGA fabric, which is what lets it meet 802.11 interframe timing that a software MAC cannot. The timing values are **configurable** through the `xpu` register `slv_reg9` (bit-fields for PHY-RX delay, SIFS, slot time, OFDM symbol time, and preamble+SIG time, in µs); the driver programs standard values per band automatically.[^docreadme]

| Parameter | Value |
|---|---|
| TX→RX turnaround | 0.6 µs[^docreadme] |
| SIFS | **10 µs (2.4 GHz) / 16 µs (5 GHz)**, set per band by the driver[^std][^docreadme] |
| Slot time | 9 µs (short slot) / 20 µs (long slot)[^std] |
| Hardware ACK generation | Yes (in FPGA)[^readme] |
| ACK frame duration (@ 6 Mbps) | 44 µs[^sdrc] |
| Measured ACK gap (RX / TX) | ≈16 µs (320 samples @ 20 Msps) in the app-note IQ capture[^acktiming] |
| Configurable / defeatable | SIFS, DIFS, EIFS, slot time, CW, NAV, ACK, retransmission[^frequent] |

!!! note "SIFS is band-dependent"
    Following the 802.11 standard, openwifi's FPGA low-MAC applies **10 µs SIFS in the 2.4 GHz band and 16 µs in 5 GHz**, selected automatically per channel by the driver (`ad9361_rf_set_channel()`).[^docreadme] The feature-list claim of a "10 µs SIFS"[^readme] refers to the tighter 2.4 GHz case, which a software MAC cannot meet.

    One implementation caveat: the driver computes the HT `duration_id` *header field* with a fixed SIFS = 16 µs regardless of band,[^sdrc] a conservative choice for that field only. It does not change the actual over-the-air SIFS, which the FPGA enforces per band.

## Measured performance

These are the project's published bring-up numbers, measured on **FMCOMMS2 at 2.4 GHz, over cable and over the air**.[^readme] Your results depend on board, RF path, and configuration.

| Metric | Value | Conditions |
|---|---|---|
| TCP throughput (iperf) | 40–50 Mbps | 802.11n[^readme] |
| UDP throughput (iperf) | ~50 Mbps | 802.11n[^readme] |
| TX EVM | −38 dB | FMCOMMS2, 2.4 GHz[^readme] |
| RX sensitivity @ MCS0 | −92 dBm | FMCOMMS2, 2.4 GHz[^readme] |
| RX sensitivity @ MCS7 | −73 dBm | FMCOMMS2, 2.4 GHz[^readme] |

## FPGA implementation

openwifi is built to fit the **lowest-end supported FPGA (Xilinx Zynq-7020)**, so its resource footprint stays small for a full-stack Wi-Fi PHY+MAC.

| Board / device | LUT | BRAM | DSP | Baseband clock |
|---|---|---|---|---|
| ZedBoard, Zynq-7020 (`xc7z020`, speed grade −1) | ~19k | 76.5 | 121 | 100 MHz[^release] |
| ZC706, Zynq-7045 (`xc7z045`) | ~21k | 73.5 | 98 | up to 200 MHz[^release] |

!!! note "These are openwifi-core numbers"
    The utilization above is for the openwifi design. A complete bitstream also includes peripheral logic (DMA, AXI interconnect, the ADI reference design, clocking), so the *total* device utilization is higher. The figures were published in the openwifi release notes; the later `v1.3.0` and `v1.5.0` releases ship full per-core `report_utilization` archives (`*-utilization.zip`) if you need the exact breakdown for a specific version.[^release]

**Clock / speed grade.** The `openofdm_tx` core was optimized so the whole design closes timing at **100 MHz on the low-speed-grade 7020 (−1)**; higher-grade parts run at 200 MHz (the release notes cite the 7035 −2/−2L; the ZC706's Zynq-7045 offers the same 200 MHz option).[^release] The baseband clock is set by `NUM_CLK_PER_US` in `openwifi-hw/boards/openwifi.tcl` (default 100).[^tcl] Per-board options are in [Supported Boards](Supported-Boards.md#the-baseband-clock-per-board).

### To generate exact numbers for your build

Resource and timing reports are **produced by synthesis**, so they are not committed to the repos as static files. For the precise figures on your target board and version:

```bash
# after building the FPGA (see FPGA Development), in Vivado Tcl or the GUI:
report_utilization   -file util.rpt     # LUT / FF / BRAM / DSP
report_timing_summary -file timing.rpt   # Fmax / slack
report_power         -file power.rpt     # on-chip power estimate
```

See [FPGA Development](FPGA-Development.md) for the build flow.

## Not supported in the open-source release

| Feature | Status |
|---|---|
| MIMO (spatial multiplexing) | Not supported[^11n] |
| 40 MHz bandwidth | Not supported[^11n] |
| A-MSDU aggregation | Not supported[^faq] |
| A-MPDU aggregation | Experimental (`./wgd.sh 1`)[^faq] |
| 802.11b (DSSS/CCK) | Not supported (OFDM only)[^docreadme] |
| 802.11ax / Wi-Fi 6 and later | Commercial only ([openwifi.tech](https://openwifi.tech))[^readme] |

!!! info "Two-hour receiver limit on unlicensed Vivado"
    A bitstream built against the **Xilinx Viterbi decoder evaluation license** halts the receiver after ~2 hours; reload the FPGA or use a paid license. This is a toolchain licensing limit, not an openwifi design limit. See [Troubleshooting](Troubleshooting.md#reception-dies-after-2-hours).

## Sources

Every figure on this page traces to one of the footnotes below.

[^readme]: openwifi [`README.md`](https://github.com/open-sdr/openwifi/blob/master/README.md): performance summary (throughput, EVM, sensitivity) and feature list.
[^docreadme]: openwifi [`doc/README.md`](https://github.com/open-sdr/openwifi/blob/master/doc/README.md): the RF/baseband/sampling design (40→20 Msps, 0.6 µs TX/RX turnaround, RF-baseband clock coupling), the `xpu` register descriptions, and the note that `ad9361_rf_set_channel()` configures per-band FPGA settings including SIFS. The band-dependent `sifs = (actual_rx_lo<2500 ? 10 : 16)` logic also appears in [`driver/sdr.c`](https://github.com/open-sdr/openwifi/blob/master/driver/sdr.c).
[^11n]: openwifi [`doc/app_notes/ieee80211n.md`](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/ieee80211n.md): subcarriers, coding rates, guard interval, and the 72.2 Mbps theoretical rate; MIMO and 40 MHz listed as not supported.
[^acktiming]: openwifi [`doc/app_notes/iq_ack_timing.md`](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/iq_ack_timing.md): the measured ≈16 µs self-ACK gap (320 samples at 20 Msps).
[^sdrc]: openwifi [`driver/sdr.c`](https://github.com/open-sdr/openwifi/blob/master/driver/sdr.c): the SIFS and ACK-duration constants used at run time.
[^frequent]: openwifi [`doc/app_notes/frequent_trick.md`](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/frequent_trick.md): how SIFS/DIFS/EIFS/slot/CW/NAV/ACK/retransmission are overridden or disabled.
[^tcl]: openwifi-hw [`boards/openwifi.tcl`](https://github.com/open-sdr/openwifi-hw/blob/master/boards/openwifi.tcl): `NUM_CLK_PER_US`, the FPGA baseband-clock setting (default 100 MHz).
[^release]: openwifi [GitHub Releases](https://github.com/open-sdr/openwifi/releases): FPGA resource-utilization and Fmax/speed-grade statements (release v1.1.0 "taiyuan"; full `report_utilization` archives in v1.3.0 and v1.5.0).
[^std]: **IEEE 802.11**: values that follow from the standard for a 20 MHz OFDM PHY (FFT size, subcarrier counts, symbol/slot timing, legacy rate set), not from an openwifi-specific measurement.
[^faq]: openwifi [FAQ & Resources](FAQ-and-Resources.md#frequently-asked-questions): AD9361 70 MHz–6 GHz tuning, A-MPDU/A-MSDU status.
[^boards]: openwifi wiki [Supported Boards](Supported-Boards.md): per-board SoC, antenna capability, and baseband-clock options.
