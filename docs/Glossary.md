# Glossary

openwifi sits at the intersection of Wi-Fi (802.11), FPGA/SoC design, and the Linux wireless stack, so the documentation is dense with acronyms from all three worlds. This page defines the terms used across the wiki, with openwifi-specific context where it helps. Use your browser's search, or the site search, to jump to a term.

A-MPDU
:   Aggregated MAC Protocol Data Unit. An 802.11n frame-aggregation method that packs several MPDUs (each with its own header/CRC) into one transmission, so a single error costs only one retransmission. openwifi supports this experimentally (`./wgd.sh 1`). See [Architecture](Architecture.md#what-openwifi-implements-of-80211agn).

A-MSDU
:   Aggregated MAC Service Data Unit. The other 802.11n aggregation method; more efficient on the wire, but one bit error invalidates the whole aggregate. **Not** supported by openwifi.

AD9361
:   The Analog Devices RF transceiver chip openwifi uses as its radio front end. A general-purpose SDR transceiver tunable from 70 MHz to 6 GHz (the AD9364 is the single-channel variant). Driven by the standard Linux IIO driver.

ADI
:   Analog Devices, Inc. Vendor of the AD9361 and of the [HDL reference design](https://github.com/analogdevicesinc/hdl) that openwifi's FPGA design is built on top of.

AGC
:   Automatic Gain Control. The AD9361 circuit that adjusts receive gain to keep the signal in range. openwifi can capture the AGC gain/lock state per sample during [IQ capture](Research-Features.md#iq-capture).

ATF (BL31)
:   ARM Trusted Firmware. On 64-bit ZynqMP boards (ZCU102) the "BL31" secure-monitor stage is required in the boot chain; it is not needed on 32-bit Zynq-7000 boards.

AXI
:   Advanced eXtensible Interface, the ARM on-chip bus. openwifi's FPGA cores expose control registers over **AXI4-Lite** and move sample data over **AXI-Stream** (DMA). The tight AXI coupling to the processor is what gives openwifi low latency but makes the design platform-specific.

Baseband
:   The signal at (or near) zero frequency, before RF up-conversion. openwifi's Wi-Fi baseband runs at 20 Msps inside the FPGA, derived from the AD9361's 40 Msps IQ stream.

BSSID
:   Basic Service Set Identifier: the MAC address identifying a Wi-Fi network (the AP's address in infrastructure mode). The FPGA can filter received frames by BSSID.

CCA
:   Clear Channel Assessment. The "is the channel busy?" check in CSMA/CA. openwifi's threshold is configurable (or defeatable) via `sdrctl` (see also **LBT**, below).

cfg80211 / mac80211
:   The two layers of the Linux kernel wireless stack. `cfg80211` is the configuration API; `mac80211` is the SoftMAC layer that openwifi's driver plugs into. See [Architecture](Architecture.md#how-the-driver-talks-to-linux-the-mac80211-api).

CSI
:   Channel State Information: the per-subcarrier channel response the receiver estimates. openwifi can stream CSI (plus frequency offset and equalizer output) to a PC. The project also puns it as "Chip State Information." See [Research Features](Research-Features.md#csi-channel-state-information).

CSMA/CA
:   Carrier-Sense Multiple Access with Collision Avoidance: the 802.11 channel-access mechanism (the DCF). openwifi implements it in the FPGA's `xpu` core so it can meet microsecond timing.

CW
:   Contention Window. The range from which CSMA/CA picks a random backoff. Per-queue CWmin/CWmax are configurable via `sdrctl`.

DCF
:   Distributed Coordination Function: the standard's name for the CSMA/CA-based channel-access method. Implemented in `csma_ca.v` inside `xpu`.

Device tree (DTB / DTS / DTSO)
:   The data structure that tells Linux what hardware is present and at which addresses/interrupts. openwifi builds a board's `devicetree.dtb` by layering overlays (`.dtso`) onto a stock board tree. Porting a board is largely a device-tree exercise.

DIFS
:   DCF Interframe Space: the idle time a station waits before starting contention. One of the CSMA timing parameters `xpu` implements (and that can be disabled for experiments).

DMA
:   Direct Memory Access. Moves packets and captured samples between the FPGA and the processor's memory without CPU copying. openwifi uses a TX descriptor ring and an RX cyclic buffer.

EIFS
:   Extended Interframe Space: a longer wait used after a reception error. Configurable/defeatable in `xpu`.

EVM
:   Error Vector Magnitude: a measure of modulation accuracy (lower is better). openwifi reaches roughly −38 dB EVM in its best configuration.

FCS
:   Frame Check Sequence: the CRC appended to an 802.11 frame. The FPGA reports FCS pass/fail per received packet; monitor mode passes even bad-FCS frames up.

FDD
:   Frequency Division Duplex. openwifi drives the AD9361 in FDD mode but with identical TX and RX frequencies, gating the TX chain on/off around each packet to avoid self-interference.

FEC
:   Forward Error Correction: the convolutional coding (with puncturing) used by 802.11 OFDM, decoded on receive by a Viterbi decoder.

FMCOMMS2/3/4
:   Analog Devices FMC daughter-cards carrying the AD9361, used with Xilinx dev boards (ZC706, ZedBoard, ZC702, ZCU102) in several supported openwifi platforms.

FPGA
:   Field-Programmable Gate Array: the reconfigurable logic fabric (inside the Zynq SoC) where openwifi's PHY and real-time MAC live.

FSBL
:   First Stage Boot Loader. The initial boot stage built from the hardware description; on some boards it (rather than U-Boot SPL) is needed to initialize DDR correctly.

Full duplex
:   Here, the ability to receive while transmitting. openwifi's receiver can hear its own transmission, which enables the [CSI radar](Research-Features.md#csi-radar-full-duplex-self-sensing) and [loopback](Research-Features.md#self-loopback-testing) features.

Guard interval (GI)
:   The cyclic-prefix gap between OFDM symbols that absorbs multipath. 802.11n adds a **short GI** (400 ns vs 800 ns) for higher throughput; openwifi supports it.

HLS
:   High-Level Synthesis: generating FPGA logic from C++ (via Vitis HLS). openwifi's channel-estimation and equalizer stages are available as HLS modules. See [FPGA Development](FPGA-Development.md#high-level-synthesis-hls-modules).

hostapd
:   The standard Linux user-space daemon that turns a Wi-Fi interface into an access point. openwifi runs stock `hostapd` over `sdr0`.

HT
:   High Throughput: the 802.11n feature set. Related terms: **HT-SIG** (the 11n signal field), **STF/LTF** (short/long training fields in the preamble).

IBSS
:   Independent Basic Service Set: 802.11 ad-hoc mode, where stations talk peer-to-peer without an AP. See [Operating Modes](Operating-Modes.md#ad-hoc-ibss).

IIO
:   Industrial I/O: the Linux subsystem (and driver) used to control the AD9361 (gains, sample rate, LO frequency) via sysfs.

ILA
:   Integrated Logic Analyzer: a Xilinx debug core inserted into the FPGA to observe internal signals in real time. openwifi can build with ILA cores enabled. See [FPGA Development](FPGA-Development.md#debugging-on-hardware).

IQ samples
:   In-phase/Quadrature samples: the complex representation of a baseband signal. openwifi can capture raw IQ (with rich triggering) via the side channel.

LBT
:   Listen Before Talk: the regulatory term for carrier sensing before transmitting. In openwifi the LBT/CCA threshold is a `sdrctl`-tunable register.

LO
:   Local Oscillator: the mixing frequency in the RF chain. openwifi switches the TX LO on just before a packet and off after, so it doesn't interfere with reception.

MAC (low / upper)
:   Medium Access Control. openwifi splits it: the **upper MAC** (association, management) runs in Linux `mac80211`; the **low MAC** (real-time CSMA/CA, ACK, timers) runs in the FPGA `xpu` core.

MCS
:   Modulation and Coding Scheme: an index selecting modulation + code rate (and thus data rate). openwifi supports MCS 0–7 (single stream).

MIMO
:   Multiple-Input Multiple-Output: using multiple spatial streams for higher throughput. **Not** supported in the open-source release.

Monitor mode
:   A receive mode that captures every frame, including control frames and bad-FCS frames. Prerequisite for packet injection and most research captures.

NAV
:   Network Allocation Vector: the virtual carrier-sense timer set by RTS/CTS duration fields. Implemented (and defeatable) in `xpu`.

nl80211 / testmode
:   The netlink interface between user space and `cfg80211`. openwifi's `sdrctl` reaches the driver through the `nl80211` **testmode** command path.

OFDM
:   Orthogonal Frequency-Division Multiplexing: the multi-subcarrier modulation used by 802.11a/g/n. openwifi's PHY is OFDM-only (hence no 802.11b compatibility).

openofdm
:   The open-source 802.11 OFDM receiver project openwifi's `openofdm_rx` core is based on (openwifi's fork lives on the `dot11zynq` branch).

PHY
:   The physical layer: modulation, coding, and RF. In openwifi the PHY is the `openofdm_tx`/`openofdm_rx` cores plus the AD9361.

PL / PS
:   Programmable Logic / Processing System: the two halves of a Xilinx Zynq SoC. The FPGA fabric is the PL; the ARM cores are the PS. Some boards move Ethernet to the PL side for bandwidth.

PMUFW
:   Platform Management Unit Firmware: a ZynqMP-specific boot component (ZCU102), built alongside the FSBL and ATF.

Preamble
:   The known symbols at the start of an 802.11 packet used for detection, synchronization, and channel estimation (the **STF** and **LTF** training fields).

RSSI
:   Received Signal Strength Indicator: an estimate of received power. openwifi reports a per-packet RSSI (calibrated to dBm) and can capture it during IQ capture.

SDR
:   Software-Defined Radio: a radio whose signal processing is done in software/logic rather than fixed hardware. openwifi is a full-stack Wi-Fi design on SDR hardware.

Side channel (`side_ch`)
:   openwifi's FPGA capture engine: it taps the receiver's IQ and the demodulator's internal results (CSI, equalizer) and DMAs them to the host, independent of the normal packet path. See [FPGA IP Cores](FPGA-IP-Cores.md#side_ch-the-csi-iq-capture-side-channel).

SIFS
:   Short Interframe Space: the brief (nominally ~16 µs, ~10 µs achievable) gap before an ACK. Meeting SIFS timing is why the low MAC has to be in hardware.

SoftMAC
:   A Wi-Fi design where the upper MAC runs in host software (Linux `mac80211`) rather than on the chip. openwifi is a SoftMAC design, which is why standard Linux tools work over `sdr0`.

SoC
:   System on Chip. openwifi runs on Xilinx Zynq / Zynq UltraScale+ SoCs, which combine ARM cores (PS) with FPGA fabric (PL).

SPI
:   Serial Peripheral Interface. openwifi drives the AD9361's TX chain in real time over an FPGA-generated SPI link (`spi.v` in `xpu`) for fast TX/RX turnaround.

sysfs
:   The Linux virtual filesystem exposing kernel/driver variables as files. openwifi exposes its statistics and some controls through sysfs. See [sdrctl](sdrctl-and-Runtime-Control.md#statistics-via-sysfs).

TSF
:   Timing Synchronization Function: the 802.11 64-bit hardware timer. openwifi timestamps every received packet and every captured sample with the TSF, which is how CSI/IQ captures line up with specific packets.

TSN
:   Time-Sensitive Networking: deterministic, scheduled networking. openwifi's MAC-address-based [time slicing](sdrctl-and-Runtime-Control.md#time-slicing-network-slicing) supports TSN-style experiments.

U-Boot
:   The bootloader that loads the Linux kernel on the board. Part of `BOOT.BIN` alongside the FSBL and FPGA bitstream.

VCXO
:   Voltage-Controlled Crystal Oscillator: a tunable reference clock. Some boards (E310 v2, SDRPi) add one, with an external reference, for a more stable clock (useful for time-sync/TSN).

Viterbi decoder
:   The algorithm/IP that decodes the convolutional FEC on receive. openwifi uses a Xilinx Viterbi decoder IP; its **evaluation license** is why a running board's receiver halts after ~2 hours. See [Troubleshooting](Troubleshooting.md#client-link-problems).

Vivado / Vitis
:   Xilinx's FPGA design tools. openwifi's FPGA build targets **Vivado 2022.2 with Vitis**. Some boards need a paid Vivado license to rebuild the FPGA; the prebuilt images need none.

wpa_supplicant
:   The standard Linux user-space client for joining Wi-Fi networks. openwifi runs stock `wpa_supplicant` over `sdr0` in client mode.

`xpu`
:   openwifi's real-time MAC core (its largest FPGA IP block): CSMA/CA, TSF timer, hardware ACK generation/reception, packet filtering, RSSI/CCA, and TX-queue gating. See [FPGA IP Cores](FPGA-IP-Cores.md#xpu-the-real-time-mac).

Zynq / Zynq UltraScale+ (MPSoC)
:   Xilinx SoC families. **Zynq-7000** is 32-bit (most openwifi boards); **Zynq UltraScale+ / MPSoC** is 64-bit (ZCU102), with a different boot chain.
