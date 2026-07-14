# Glossary

openwifi sits at the intersection of Wi-Fi (802.11), FPGA/SoC design, and the Linux wireless stack, so the documentation is dense with acronyms from all three worlds. This page defines the terms used across the wiki, with openwifi-specific context where it helps. Use your browser's search, or the site search, to jump to a term.

A-MPDU
:   Aggregated MAC Protocol Data Unit. An 802.11n frame-aggregation method that packs several MPDUs (each with its own header/CRC) into one transmission, so a single error costs only one retransmission. openwifi supports this experimentally (`./wgd.sh 1`). See [Architecture](Architecture.md#what-openwifi-implements-of-80211agn).

A-MSDU
:   Aggregated MAC Service Data Unit. The other 802.11n aggregation method; more efficient on the wire, but one bit error invalidates the whole aggregate. **Not** supported by openwifi.

AD9361
:   The Analog Devices RF transceiver chip openwifi uses as its radio front end. A general-purpose SDR transceiver tunable from 70 MHz to 6 GHz (the AD9364 is the single-channel variant). Driven by the standard Linux IIO driver.

ADC / DAC
:   Analog-to-Digital / Digital-to-Analog Converter. The AD9361's data converters between the analog RF signal and the FPGA's digital IQ samples; `rx_intf` handles the ADC side, `tx_intf` the DAC side.

ADI
:   Analog Devices, Inc. Vendor of the AD9361 and of the [HDL reference design](https://github.com/analogdevicesinc/hdl) that openwifi's FPGA design is built on top of.

AGC
:   Automatic Gain Control. The AD9361 circuit that adjusts receive gain to keep the signal in range. openwifi can capture the AGC gain/lock state per sample during [IQ capture](Research-Features.md#iq-capture).

AIFS
:   Arbitration Interframe Space: the per-access-category idle time a station waits before backoff in the QoS (EDCA) variant of CSMA/CA. Set per TX queue by Linux through the `conf_tx` callback. See [Architecture](Architecture.md#how-the-driver-talks-to-linux-the-mac80211-api).

ATF (BL31)
:   ARM Trusted Firmware. On 64-bit ZynqMP boards (ZCU102) the "BL31" secure-monitor stage is required in the boot chain; it is not needed on 32-bit Zynq-7000 boards.

AXI
:   Advanced eXtensible Interface, the ARM on-chip bus. openwifi's FPGA cores expose control registers over **AXI4-Lite** and move sample data over **AXI-Stream** (DMA). The tight AXI coupling to the processor is what gives openwifi low latency but makes the design platform-specific.

Baseband
:   The signal at (or near) zero frequency, before RF up-conversion. openwifi's Wi-Fi baseband runs at 20 Msps inside the FPGA, derived from the AD9361's 40 Msps IQ stream.

BRAM
:   Block RAM: the FPGA's on-chip memory blocks. openwifi uses BRAM for the TX packet buffer and the side-channel capture FIFO. Small (Zynq-7020) FPGAs have less of it, which is why capture buffers are capped shorter there (the `SIDE_CH_LESS_BRAM` build). See [Supported Boards](Supported-Boards.md).

BSSID
:   Basic Service Set Identifier: the MAC address identifying a Wi-Fi network (the AP's address in infrastructure mode). The FPGA can filter received frames by BSSID.

CCA
:   Clear Channel Assessment. The "is the channel busy?" check in CSMA/CA. openwifi's threshold is configurable (or defeatable) via `sdrctl` (see also **LBT**, below).

CDD
:   Cyclic Delay Diversity: transmitting a 1-sample-delayed copy of the signal on a second antenna to add artificial multipath and improve robustness. openwifi supports a simple CDD via `tx_intf` register 16.

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

DCXO
:   Digitally-Controlled Crystal Oscillator: the AD9361's tunable reference crystal. A board overlay sets its coarse/fine tuning (`adi,dcxo-coarse-and-fine-tune`) to trim the frequency. See [Boot, Kernel & Device Tree](Boot-Kernel-Device-Tree.md#what-a-board-overlay-adds).

Device tree (DTB / DTS / DTSO)
:   The data structure that tells Linux what hardware is present and at which addresses/interrupts. openwifi builds a board's `devicetree.dtb` by layering overlays (`.dtso`) onto a stock board tree. Porting a board is largely a device-tree exercise.

DIFS
:   DCF Interframe Space: the idle time a station waits before starting contention. One of the CSMA timing parameters `xpu` implements (and that can be disabled for experiments).

DMA
:   Direct Memory Access. Moves packets and captured samples between the FPGA and the processor's memory without CPU copying. openwifi uses a TX descriptor ring and an RX cyclic buffer.

EIFS
:   Extended Interframe Space: a longer wait used after a reception error. Configurable/defeatable in `xpu`.

ERP
:   Extended Rate PHY: the 802.11g amendment that brought OFDM to 2.4 GHz. "ERP short-slot" (the shorter 9 µs slot time) is one of the CSMA parameters `xpu` register 4 carries.

EVM
:   Error Vector Magnitude: a measure of modulation accuracy (lower is better). openwifi reaches roughly −38 dB EVM in its best configuration.

FCS
:   Frame Check Sequence: the CRC appended to an 802.11 frame. The FPGA reports FCS pass/fail per received packet; monitor mode passes even bad-FCS frames up.

FDD
:   Frequency Division Duplex. openwifi drives the AD9361 in FDD mode but with identical TX and RX frequencies, gating the TX chain on/off around each packet to avoid self-interference.

FEC
:   Forward Error Correction: the convolutional coding (with puncturing) used by 802.11 OFDM, decoded on receive by a Viterbi decoder.

FFT / IFFT
:   (Inverse) Fast Fourier Transform: the core OFDM operation. `openofdm_tx` uses an IFFT to build the time-domain signal from the subcarriers; the receiver uses an FFT to recover them.

FMC
:   FPGA Mezzanine Card: a standard connector/daughter-card form factor. The AD9361-carrying FMCOMMS2/3/4 cards are FMC modules that plug into the Xilinx dev boards.

FMCOMMS2/3/4
:   Analog Devices FMC daughter-cards carrying the AD9361, used with Xilinx dev boards (ZC706, ZedBoard, ZC702, ZCU102) in several supported openwifi platforms.

FPGA
:   Field-Programmable Gate Array: the reconfigurable logic fabric (inside the Zynq SoC) where openwifi's PHY and real-time MAC live.

FRU
:   Field-Replaceable Unit: here, the identification data in an FMCOMMS board's EEPROM. A wrong or empty FRU EEPROM can crash the host (notably ZCU102); reprogram it with `fru_tools`. See [Troubleshooting](Troubleshooting.md#fmcomms-board-causes-a-linux-crash-badempty-eeprom).

FSBL
:   First Stage Boot Loader. The initial boot stage built from the hardware description; on some boards it (rather than U-Boot SPL) is needed to initialize DDR correctly.

Full duplex
:   Here, the ability to receive while transmitting. openwifi's receiver can hear its own transmission, which enables the [CSI radar](Research-Features.md#csi-radar-full-duplex-self-sensing) and [loopback](Research-Features.md#self-loopback-testing) features.

GEM
:   Gigabit Ethernet MAC: the Zynq PS-side Ethernet controller. Some boards (ANTSDR-E200 / E310 v2) move Ethernet to the PL side instead, to free the processor at high sample rates. See [Supported Boards](Supported-Boards.md#antsdr-e200-microphase).

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

Kuiper (ADI Kuiper)
:   Analog Devices' Debian/Ubuntu-based Linux distribution for its SDR platforms; the classic openwifi runtime environment (the alternative is OpenWrt). See [Building SD Images](Building-SD-Images.md).

LBT
:   Listen Before Talk: the regulatory term for carrier sensing before transmitting. In openwifi the LBT/CCA threshold is a `sdrctl`-tunable register.

LO
:   Local Oscillator: the mixing frequency in the RF chain. openwifi switches the TX LO on just before a packet and off after, so it doesn't interfere with reception.

LuCI
:   The web configuration UI of OpenWrt. openwifi's OpenWrt images expose the radio through LuCI's Network → Wireless page. See [Building SD Images](Building-SD-Images.md#openwrt).

MAC (low / upper)
:   Medium Access Control. openwifi splits it: the **upper MAC** (association, management) runs in Linux `mac80211`; the **low MAC** (real-time CSMA/CA, ACK, timers) runs in the FPGA `xpu` core.

MCS
:   Modulation and Coding Scheme: an index selecting modulation + code rate (and thus data rate). openwifi supports MCS 0–7 (single stream).

MIMO
:   Multiple-Input Multiple-Output: using multiple spatial streams for higher throughput. **Not** supported in the open-source release.

minstrel_ht
:   The default Linux `mac80211` rate-control algorithm, which picks the TX rate/MCS automatically. openwifi lets you override it and pin a fixed rate via `sdrctl`. See [sdrctl](sdrctl-and-Runtime-Control.md#tx-rate-mcs-override).

Monitor mode
:   A receive mode that captures every frame, including control frames and bad-FCS frames. Prerequisite for packet injection and most research captures.

NAV
:   Network Allocation Vector: the virtual carrier-sense timer set by RTS/CTS duration fields. Implemented (and defeatable) in `xpu`.

nl80211 / testmode
:   The netlink interface between user space and `cfg80211`. openwifi's `sdrctl` reaches the driver through the `nl80211` **testmode** command path.

OFDM
:   Orthogonal Frequency-Division Multiplexing: the multi-subcarrier modulation used by 802.11a/g/n. openwifi's PHY is OFDM-only (hence no 802.11b compatibility).

OFDMA
:   Orthogonal Frequency-Division Multiple Access: the 802.11ax (Wi-Fi 6) feature that assigns subcarrier groups to different users at once. Not in the open-source release; explored in openwifi research. See [Wi-Fi 4 & Wi-Fi 6 Features](Wi-Fi-4-and-Wi-Fi-6.md#wi-fi-6-80211ax).

openofdm
:   The open-source 802.11 OFDM receiver project openwifi's `openofdm_rx` core is based on (openwifi's fork lives on the `dot11zynq` branch).

OpenWrt
:   The router-focused embedded Linux distribution. openwifi ships as an OpenWrt kernel module, giving a router-style image with the LuCI web UI. See [Building SD Images](Building-SD-Images.md#openwrt).

PER
:   Packet Error Rate: the fraction of packets lost or received in error. `rx_stat_show.sh` computes it given how many packets the peer sent. See [sdrctl](sdrctl-and-Runtime-Control.md#statistics-via-sysfs).

PHY
:   The physical layer: modulation, coding, and RF. In openwifi the PHY is the `openofdm_tx`/`openofdm_rx` cores plus the AD9361.

PL / PS
:   Programmable Logic / Processing System: the two halves of a Xilinx Zynq SoC. The FPGA fabric is the PL; the ARM cores are the PS. Some boards move Ethernet to the PL side for bandwidth.

PMUFW
:   Platform Management Unit Firmware: a ZynqMP-specific boot component (ZCU102), built alongside the FSBL and ATF.

PPS
:   Pulse Per Second: a once-a-second timing signal (typically from GPS) for precise clock alignment. Boards like the E310 v2 accept an external 10 MHz / PPS reference. See [Supported Boards](Supported-Boards.md#antsdr-e310-v2-microphase).

Preamble
:   The known symbols at the start of an 802.11 packet used for detection, synchronization, and channel estimation (the **STF** and **LTF** training fields).

RSSI
:   Received Signal Strength Indicator: an estimate of received power. openwifi reports a per-packet RSSI (calibrated to dBm) and can capture it during IQ capture.

RTS/CTS
:   Request To Send / Clear To Send: the 802.11 handshake that reserves the channel (via the NAV) before a data frame, mitigating hidden-node collisions. openwifi's `xpu` generates and honors it in hardware, gated by the packet-length threshold (`set_rts_threshold`).

RU (Resource Unit)
:   A group of OFDMA subcarriers (26, 52, 106, or 242 tones in a 20 MHz channel) assigned to one station, so several stations can share a single 802.11ax transmission. Not in the open-source release. See [Wi-Fi 4 & Wi-Fi 6 Features](Wi-Fi-4-and-Wi-Fi-6.md#a-short-80211-primer).

SDR
:   Software-Defined Radio: a radio whose signal processing is done in software/logic rather than fixed hardware. openwifi is a full-stack Wi-Fi design on SDR hardware.

Side channel (`side_ch`)
:   openwifi's FPGA capture engine: it taps the receiver's IQ and the demodulator's internal results (CSI, equalizer) and DMAs them to the host, independent of the normal packet path. See [FPGA IP Cores](FPGA-IP-Cores.md#side_ch-the-csi-iq-capture-side-channel).

SIFS
:   Short Interframe Space: the brief gap before an ACK, 10 µs in 2.4 GHz (802.11g) and 16 µs in 5 GHz (802.11a). Meeting SIFS timing is why the low MAC has to be in hardware.

SoftMAC
:   A Wi-Fi design where the upper MAC runs in host software (Linux `mac80211`) rather than on the chip. openwifi is a SoftMAC design, which is why standard Linux tools work over `sdr0`.

SoC
:   System on Chip. openwifi runs on Xilinx Zynq / Zynq UltraScale+ SoCs, which combine ARM cores (PS) with FPGA fabric (PL).

SODIMM
:   Small Outline DIMM: the pluggable DRAM module used on some boards (e.g. ZCU102). Certain modules fail with the U-Boot SPL DDR bring-up. See [Troubleshooting](Troubleshooting.md#no-uart-output-on-zcu102-under-openwrt).

SoM
:   System on Module: a small board carrying the SoC, RAM, and support circuitry, mounted on a larger carrier. The ADRV9364-Z7020 and ADRV9361-Z7035 are SoMs on the ADRV1CRR carrier.

SPI
:   Serial Peripheral Interface. openwifi drives the AD9361's TX chain in real time over an FPGA-generated SPI link (`spi.v` in `xpu`) for fast TX/RX turnaround.

SPL
:   Secondary Program Loader: U-Boot's first-stage loader. On some 64-bit boards it mis-configures certain DDR modules, so the Xilinx FSBL is used instead. See [Troubleshooting](Troubleshooting.md#no-uart-output-on-zcu102-under-openwrt).

STA
:   Station: the 802.11 standard's term for any device on the link. A client and an access point are both STAs; "STA" is often used specifically for the non-AP client. openwifi runs as either, over `sdr0`. See [Operating Modes](Operating-Modes.md).

sysfs
:   The Linux virtual filesystem exposing kernel/driver variables as files. openwifi exposes its statistics and some controls through sysfs. See [sdrctl](sdrctl-and-Runtime-Control.md#statistics-via-sysfs).

TSF
:   Timing Synchronization Function: the 802.11 64-bit hardware timer. openwifi timestamps every received packet and every captured sample with the TSF, which is how CSI/IQ captures line up with specific packets.

TSN
:   Time-Sensitive Networking: deterministic, scheduled networking. openwifi's MAC-address-based [time slicing](sdrctl-and-Runtime-Control.md#time-slicing-network-slicing) supports TSN-style experiments.

UART
:   Universal Asynchronous Receiver/Transmitter: the serial console. A USB-UART cable is the essential tool for watching boot messages when networking won't come up. See [Troubleshooting](Troubleshooting.md#boot-and-networking).

U-Boot
:   The bootloader that loads the Linux kernel on the board. Part of `BOOT.BIN` alongside the FSBL and FPGA bitstream.

UHD
:   USRP Hardware Driver: Ettus/NI's SDR driver framework. Some MicroPhase boards can run as UHD devices via a separate project; unrelated to openwifi's Wi-Fi operation, but it explains their PL-side Ethernet design.

VCXO
:   Voltage-Controlled Crystal Oscillator: a tunable reference clock. Some boards (E310 v2, SDRPi) add one, with an external reference, for a more stable clock (useful for time-sync/TSN).

VDMA
:   Video DMA: a Xilinx AXI DMA variant for video streams. openwifi doesn't use it, but one kernel patch comments out a VDMA/AXI-HDMI call that otherwise breaks the build once Xilinx AXI DMA is enabled. See [Boot, Kernel & Device Tree](Boot-Kernel-Device-Tree.md#the-kernel-patches).

Viterbi decoder
:   The algorithm/IP that decodes the convolutional FEC on receive. openwifi uses a Xilinx Viterbi decoder IP; its **evaluation license** is why a running board's receiver halts after ~2 hours. See [Troubleshooting](Troubleshooting.md#reception-dies-after-2-hours).

Vivado / Vitis
:   Xilinx's FPGA design tools. openwifi's FPGA build targets **Vivado 2022.2 with Vitis**. Some boards need a paid Vivado license to rebuild the FPGA; the prebuilt images need none.

wpa_supplicant
:   The standard Linux user-space client for joining Wi-Fi networks. openwifi runs stock `wpa_supplicant` over `sdr0` in client mode.

`xpu`
:   openwifi's real-time MAC core (its largest FPGA IP block): CSMA/CA, TSF timer, hardware ACK generation/reception, packet filtering, RSSI/CCA, and TX-queue gating. See [FPGA IP Cores](FPGA-IP-Cores.md#xpu-the-real-time-mac).

Zynq / Zynq UltraScale+ (MPSoC)
:   Xilinx SoC families. **Zynq-7000** is 32-bit (most openwifi boards); **Zynq UltraScale+ / MPSoC** is 64-bit (ZCU102), with a different boot chain.
