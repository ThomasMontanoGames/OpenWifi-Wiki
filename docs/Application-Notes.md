# Application Notes

openwifi ships a set of **application notes** in [`openwifi/doc/app_notes/`](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/README.md): short, task-focused write-ups for specific scenarios and modes. Their material is spread across the thematic wiki pages ([Operating Modes](Operating-Modes.md), [Research Features](Research-Features.md), [sdrctl](sdrctl-and-Runtime-Control.md), and so on), and this page indexes every note in one place.

Each entry below expands to a short summary and the note's key figures. Use **Read more** to jump to the full section on that topic, or **Original note** to open the app note on GitHub.

## Getting on the air: two-SDR links

??? note "Communication between two SDR boards: AP and client mode"
    Step-by-step for an access-point + client link between two openwifi boards using stock `hostapd` and `wpa_supplicant`. Covers confirming beacon transmission via `/proc/interrupts`, associating the client, and getting an IP over the link.

    [Read more →](Operating-Modes.md#access-point) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/ap-client-two-sdr.md)

??? note "Communication between two SDR boards: ad-hoc mode"
    Bring two boards into the same 802.11 ad-hoc (IBSS) cell with `sdr-ad-hoc-up.sh`, confirm both nodes converge on the same Cell ID, and ping across. Includes the antenna-isolation and 5 GHz TX-power caveats.

    [Read more →](Operating-Modes.md#ad-hoc-ibss) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/ad-hoc-two-sdr.md)

## CSI and sensing

??? note "From CSI (Channel State Information) to CSI (Chip State Information)"
    Per-packet CSI (timestamp, frequency offset, channel response, and equalizer output) streamed to a PC through the FPGA side channel. Shows the data path, the 64-bit packet format, how to filter captures by MAC address, and the display scripts.

    [Read more →](Research-Features.md#csi-channel-state-information) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/csi.md)

    ![CSI side-channel architecture](assets/img/csi-architecture.jpg)
    ![CSI information format](assets/img/csi-information-format.jpg)
    ![Live CSI display](assets/img/csi-screen-shot.jpg)

??? note "WiFi CSI radar via self CSI capturing"
    Full-duplex "Wi-Fi radar": with a TX and an RX antenna, the CSI of openwifi's own transmitted signal reflects changes in the environment. Unmute self-reception (`xpu 1 1`), inject a stream of packets to sound the channel, and watch the CSI waterfall change as people or objects move.

    [Read more →](Research-Features.md#csi-radar-full-duplex-self-sensing) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/radar-self-csi.md)

    ![Wi-Fi CSI radar concept](assets/img/openwifi-radar.jpg)
    ![CSI radar waterfall](assets/img/csi-screen-shot-radar-matlab.jpg)

??? note "CSI fuzzer"
    Inject a controlled *artificial* channel response at the transmitter so an eavesdropper's CSI-based sensing is corrupted while normal communication continues. Includes commands to sweep and apply fuzzer parameters and to watch the effect via self-monitoring.

    [Read more →](Research-Features.md#csi-fuzzer-privacy-protection) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/csi_fuzzer.md)

    ![CSI fuzzer: before vs. with the fuzzer](assets/img/csi-fuzzer-system-before-vs-now.png)
    ![CSI fuzzer principle](assets/img/csi-fuzzer-principle.png)

## IQ capture

??? note "Capture IQ sample, AGC gain, RSSI with many trigger conditions"
    Capture raw baseband IQ plus the AD9361 AGC gain/lock status and RSSI, windowed around any of 30+ trigger conditions. Also compares the FPGA's frequency-offset estimate against a Python calculation.

    [Read more →](Research-Features.md#iq-capture) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/iq.md)

    ![IQ side-channel architecture](assets/img/iq-architecture.jpg)
    ![IQ information format](assets/img/iq-information-format.jpg)
    ![IQ capture parameters](assets/img/iq-capture-parameter.jpg)
    ![Live IQ display](assets/img/iq-screen-shot.jpg)

??? note "ACK timing verification by IQ capture"
    Trigger IQ capture on the ACK-send event to directly measure the Rx-ACK-GAP and Tx-ACK-GAP against the ~16 µs SIFS across MCS and packet lengths.

    [Read more →](Research-Features.md#ack-timing-measurement) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/iq_ack_timing.md)

    ![Two packets ~16 µs apart, the ACK timing](assets/img/iq-ack-timing-screen-shot.jpg)
    ![MATLAB Tx-ACK-GAP analysis](assets/img/iq-ack-timing-matlab-tx-ack-gap.jpg)

??? note "Capture dual-antenna TX/RX IQ (collision capture and TX IQ)"
    Capture IQ from a second *monitoring* antenna coherently alongside the main antenna. Placed near a peer node, the monitoring antenna catches collisions (moments when both link ends transmit at once) via a dedicated collision trigger. The note also includes two quick starts for capturing the board's own TX IQ from inside the FPGA, one fired by a transmit-start trigger and one free-running.

    [Read more →](Research-Features.md#dual-antenna-iq-collision-capture) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/iq_2ant.md)

    ![Dual-antenna collision-capture setup](assets/img/iq_2ant-setup.png)
    ![Dual-antenna capture: rx0 vs rx1](assets/img/iq_2ant-screen-shot.jpg)

??? note "Wi-Fi packet, CSI and IQ self-loopback test"
    Verify the TX→RX path end-to-end at the packet, CSI, and IQ level, either over the air (antennas close together) or entirely inside the FPGA. The FPGA-internal loopback provides a distortion-free "golden" reference.

    [Read more →](Research-Features.md#self-loopback-testing) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/packet-iq-self-loopback-test.md)

    ![Self-loopback principle](assets/img/openwifi-loopback-principle.jpg)
    ![Over-the-air self-loopback IQ](assets/img/openwifi-iq-loopback.jpg)
    ![FPGA-internal loopback CSI](assets/img/openwifi-csi-fpga-loopback.jpg)

## Injection and fuzzing

??? note "802.11 packet injection and fuzzing"
    Build and use the `inject_80211` tool to craft and transmit arbitrary 802.11 frames in monitor mode, control whether the FPGA generates ACKs, and run link-performance sweeps that are analyzed offline with `analyze_80211`.

    [Read more →](Operating-Modes.md#packet-injection-and-fuzzing) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/inject_80211.md)

??? note "owfuzz: a Wi-Fi protocol fuzzing tool (external)"
    A third-party 802.11 protocol fuzzer built on openwifi, with a published list of discovered vulnerabilities. Hosted outside the openwifi repos.

    [Read more →](Operating-Modes.md#packet-injection-and-fuzzing) · [Project ↗](https://github.com/alipay/WiFi-Protocol-Fuzzing-Tool) · [Discovered vulnerabilities ↗](https://github.com/alipay/Owfuzz#discovered-vulnerabilities)

## Standards background

??? note "IEEE 802.11n (Wi-Fi 4)"
    Background on the five 802.11n PHY improvements (more subcarriers, higher FEC, short guard interval, MIMO, 40 MHz) and frame aggregation, with a throughput derivation, and which parts openwifi implements: 52 subcarriers, 5/6 FEC, short GI, and experimental A-MPDU.

    [Read more →](Architecture.md#what-openwifi-implements-of-80211agn) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/ieee80211n.md)

    ![48 vs 52 OFDM data subcarriers](assets/img/subcarriers.png){ width="620" }
    ![800 ns vs 400 ns guard interval](assets/img/guard-interval.png){ width="620" }
    ![A-MPDU vs A-MSDU aggregation](assets/img/mpdu-aggr.png){ width="620" }

## Counters and statistics

??? note "Access counter/statistics in FPGA"
    Read FPGA-level event counters directly: the `openofdm_rx` watchdog counters (abnormal-signal events) and the side-channel PHY RX/TX event counters (preamble detected, TX start/done, FCS-good-for-me, and more), all via register reads.

    [Read more →](Research-Features.md#fpga-event-counters) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/perf_counter.md)

??? note "Access counter/statistics in driver"
    Enable, read, filter, and clear driver-level TX/RX statistics exposed through sysfs: per-packet success/fail counts, realtime MCS, AGC gain, per-peer filtering, and PER calculation.

    [Read more →](sdrctl-and-Runtime-Control.md#statistics-via-sysfs) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/driver_stat.md)

## Runtime control and dev workflow

??? note "Frequent tricks: Gain / Att / Frequency / CCA / LBT / CSMA / CW / Sensitivity"
    A cookbook of everyday runtime overrides: TX power and attenuation, RX gain, CCA/LBT threshold, NAV/DIFS/EIFS/CW, ACK and retransmission control, antenna selection, frequency restriction and arbitrary tuning, TX rate, and arbitrary IQ transmission.

    [Read more →](sdrctl-and-Runtime-Control.md#common-runtime-tasks-the-frequent-tricks) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/frequent_trick.md)

??? note "Driver and FPGA dynamic reloading"
    Hot-reload the driver and/or FPGA bitstream on a running board with `wgd.sh`: no reboot, no power cycle, and keep several driver/FPGA variants side by side for quick switching.

    [Read more →](Software-Development-Workflow.md#reloading-driver-and-fpga-without-rebooting) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/drv_fpga_dynamic_loading.md)

## FPGA

??? note "Build FPGA with High-Level Synthesis modules"
    Build the receiver's channel-estimation (`ch_gain_cal`) and equalizer (`equalizer`) stages from C++ via Vitis HLS instead of hand-written Verilog, which can speed up algorithm development. Based on an FCCM 2023 poster.

    [Read more →](FPGA-Development.md#high-level-synthesis-hls-modules) · [Original note ↗](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/hls.md)

## Remote access

??? note "Use openwifi on the w-iLab.t testbed remotely (external)"
    No hardware? The imec w-iLab.t testbed offers remote access to openwifi-ready boards, including JTAG boot instead of SD-card boot. Hosted on the imec documentation site.

    [Read more →](Supported-Boards.md#no-hardware-use-the-testbed) · [Tutorial ↗](https://doc.ilabt.imec.be/ilabt/wilab/tutorials/openwifi.html)
