*[A-MPDU]: Aggregated MAC Protocol Data Unit: an 802.11n frame-aggregation method (experimental in openwifi).
*[A-MSDU]: Aggregated MAC Service Data Unit: the other 802.11n aggregation method (not supported by openwifi).
*[AD9361]: Analog Devices RF transceiver chip openwifi uses as its radio front end (70 MHz to 6 GHz).
*[AD9364]: Single-channel variant of the AD9361 RF transceiver.
*[ADC]: Analog-to-Digital Converter: turns the analog RF signal into digital IQ samples.
*[DAC]: Digital-to-Analog Converter: turns digital IQ samples back into an analog signal.
*[ADI]: Analog Devices, Inc.: vendor of the AD9361 and the HDL reference design openwifi builds on.
*[AGC]: Automatic Gain Control: the AD9361 circuit that adjusts receive gain to keep the signal in range.
*[AIFS]: Arbitration Interframe Space: the per-access-category idle time before backoff in EDCA/QoS CSMA/CA.
*[AID]: Association Identifier: the 802.11 identifier an AP assigns a station, used to address it in MU/trigger frames.
*[ATF]: ARM Trusted Firmware: the BL31 secure-monitor boot stage required on 64-bit ZynqMP boards.
*[AXI]: Advanced eXtensible Interface: the ARM on-chip bus openwifi cores use for registers and sample data.
*[BCC]: Binary Convolutional Coding: the standard's name for the punctured convolutional FEC 802.11a/g/n uses.
*[BSR]: Buffer Status Report: an 802.11ax report of a station's pending uplink data, solicited by a trigger frame.
*[BSRP]: Buffer Status Report Poll: the 802.11ax trigger frame type (4) an AP sends to ask stations how much uplink data they hold.
*[BRAM]: Block RAM: the FPGA's on-chip memory, used for the TX buffer and capture FIFO.
*[BSSID]: Basic Service Set Identifier: the MAC address identifying a Wi-Fi network (the AP in infrastructure mode).
*[CCA]: Clear Channel Assessment: the "is the channel busy?" check in CSMA/CA (configurable via sdrctl).
*[Co-OFDMA]: Coordinated OFDMA: an openwifi research feature where multiple APs coordinate their OFDMA transmissions.
*[CCDF]: Complementary Cumulative Distribution Function: the curve of how often a measured value exceeds each level, used by 802.11 conformance limits.
*[CRUA]: an openwifi 802.11ax scheduler feature performing real-time RU puncturing with per-RU clear-channel assessment.
*[CDD]: Cyclic Delay Diversity: sending a delayed copy on a second antenna to add artificial multipath.
*[cfg80211]: The Linux kernel wireless configuration API.
*[mac80211]: The Linux kernel SoftMAC layer that openwifi's driver plugs into.
*[MU-MIMO]: Multi-User MIMO: serving several stations at once on the same subcarriers via spatial streams (optional in 802.11ax).
*[CSI]: Channel State Information: the per-subcarrier channel response the receiver estimates.
*[CSMA/CA]: Carrier-Sense Multiple Access with Collision Avoidance: the 802.11 channel-access method (the DCF).
*[CW]: Contention Window: the range CSMA/CA picks a random backoff from (CWmin/CWmax configurable).
*[CWmin]: Minimum contention window for CSMA/CA backoff.
*[CWmax]: Maximum contention window for CSMA/CA backoff.
*[DCF]: Distributed Coordination Function: the standard's CSMA/CA-based channel-access method.
*[DCM]: Dual Carrier Modulation: an optional 802.11ax mode that duplicates data across subcarrier pairs for robustness.
*[DCXO]: Digitally-Controlled Crystal Oscillator: the AD9361's tunable reference crystal.
*[DTB]: Device Tree Blob: the compiled description of the board's hardware for Linux.
*[DTS]: Device Tree Source: the human-readable device-tree description.
*[DTSO]: Device Tree Source Overlay: an overlay layered onto a stock board device tree.
*[DIFS]: DCF Interframe Space: the idle time a station waits before starting contention.
*[DMA]: Direct Memory Access: moves packets/samples between FPGA and memory without CPU copying.
*[EIFS]: Extended Interframe Space: a longer wait used after a reception error.
*[ERP]: Extended Rate PHY: the 802.11g amendment that brought OFDM to 2.4 GHz.
*[EVM]: Error Vector Magnitude: a measure of modulation accuracy (lower is better).
*[FCS]: Frame Check Sequence: the CRC appended to an 802.11 frame.
*[FDD]: Frequency Division Duplex: openwifi drives the AD9361 in FDD but with identical TX/RX frequencies.
*[FEC]: Forward Error Correction: the convolutional coding used by 802.11 OFDM, decoded by Viterbi.
*[FFT]: Fast Fourier Transform: the receiver operation that recovers OFDM subcarriers.
*[IFFT]: Inverse Fast Fourier Transform: builds the OFDM time-domain signal from subcarriers.
*[FMC]: FPGA Mezzanine Card: a standard connector/daughter-card form factor.
*[FMCOMMS2]: Analog Devices FMC daughter-card carrying the AD9361.
*[FMCOMMS3]: Analog Devices FMC daughter-card carrying the AD9361.
*[FMCOMMS4]: Analog Devices FMC daughter-card carrying the AD9361 (single-channel).
*[FPGA]: Field-Programmable Gate Array: the reconfigurable logic where openwifi's PHY and real-time MAC live.
*[FRU]: Field-Replaceable Unit: identification data in an FMCOMMS board's EEPROM.
*[FSBL]: First Stage Boot Loader: the initial boot stage built from the hardware description.
*[FSM]: Finite State Machine: sequential logic that steps through a fixed set of states (e.g. the side channel's capture FSM).
*[GEM]: Gigabit Ethernet MAC: the Zynq PS-side Ethernet controller.
*[GI]: Guard Interval: the cyclic-prefix gap between OFDM symbols that absorbs multipath.
*[HLS]: High-Level Synthesis: generating FPGA logic from C++ (via Vitis HLS).
*[hostapd]: The standard Linux daemon that turns a Wi-Fi interface into an access point.
*[HE]: High Efficiency: the 802.11ax (Wi-Fi 6) feature set (not in the open-source release).
*[HE-SU]: High Efficiency Single User: an 802.11ax PPDU carrying one station's data over the whole RU.
*[HE-MU]: High Efficiency Multi User: an 802.11ax downlink OFDMA PPDU carrying several stations at once.
*[HE-TB]: High Efficiency Trigger-Based: an 802.11ax uplink PPDU sent in response to an AP trigger frame.
*[HE-SIG]: The 802.11ax signal fields (HE-SIG-A and HE-SIG-B) in the preamble.
*[HE-STF]: HE Short Training Field: the 802.11ax preamble field for packet detection and AGC.
*[HE-LTF]: HE Long Training Field: the 802.11ax preamble field for channel estimation (1x/2x/4x variants).
*[HTC]: HT Control field: the frame-header field carrying control information such as 802.11ax buffer-status reports.
*[HT]: High Throughput: the 802.11n feature set.
*[HT-SIG]: The 802.11n signal field in the preamble.
*[IBSS]: Independent Basic Service Set: 802.11 ad-hoc mode (peer-to-peer, no AP).
*[IIO]: Industrial I/O: the Linux subsystem used to control the AD9361 via sysfs.
*[ILA]: Integrated Logic Analyzer: a Xilinx debug core for observing internal FPGA signals.
*[IQ]: In-phase/Quadrature: the complex representation of a baseband signal.
*[Kuiper]: Analog Devices' Debian/Ubuntu-based Linux distribution for its SDR platforms.
*[LBT]: Listen Before Talk: the regulatory term for carrier sensing before transmitting.
*[LDPC]: Low-Density Parity-Check: the high-performance FEC 802.11ax uses in place of convolutional coding in many cases.
*[PPDU]: PLCP Protocol Data Unit: a complete PHY-layer frame (preamble plus payload) as sent on the air.
*[LO]: Local Oscillator: the mixing frequency in the RF chain.
*[LTF]: Long Training Field: preamble symbols used for channel estimation.
*[LuCI]: The web configuration UI of OpenWrt.
*[MAC]: Medium Access Control: split in openwifi between Linux (upper) and the FPGA xpu (low).
*[MCS]: Modulation and Coding Scheme: an index selecting modulation + code rate (openwifi supports 0-7).
*[MIMO]: Multiple-Input Multiple-Output: multiple spatial streams (not supported in the open-source release).
*[MPDU]: MAC Protocol Data Unit: a single 802.11 MAC frame; several MPDUs are packed together in an A-MPDU.
*[minstrel_ht]: The default Linux mac80211 rate-control algorithm.
*[NAV]: Network Allocation Vector: the virtual carrier-sense timer set by RTS/CTS.
*[nl80211]: The netlink interface between user space and cfg80211 (openwifi's sdrctl uses its testmode path).
*[OFDM]: Orthogonal Frequency-Division Multiplexing: the modulation used by 802.11a/g/n.
*[OFDMA]: Orthogonal Frequency-Division Multiple Access: the 802.11ax feature (not in the open-source release).
*[openofdm]: The open-source 802.11 OFDM receiver openwifi's openofdm_rx core is based on.
*[OpenWrt]: The router-focused embedded Linux distribution; openwifi ships as an OpenWrt kernel module.
*[PER]: Packet Error Rate: the fraction of packets lost or received in error.
*[PHY]: The physical layer: modulation, coding, and RF (openofdm cores plus the AD9361).
*[PL]: Programmable Logic: the FPGA-fabric half of a Xilinx Zynq SoC.
*[PS]: Processing System: the ARM-core half of a Xilinx Zynq SoC.
*[PMUFW]: Platform Management Unit Firmware: a ZynqMP-specific boot component (ZCU102).
*[PPS]: Pulse Per Second: a once-a-second timing signal (typically from GPS).
*[RSSI]: Received Signal Strength Indicator: an estimate of received power (per-packet in openwifi).
*[RTS/CTS]: Request To Send / Clear To Send: the 802.11 handshake that reserves the channel via the NAV.
*[RU]: Resource Unit: a group of OFDMA subcarriers assigned to one station in 802.11ax (not in the open-source release).
*[SDR]: Software-Defined Radio: signal processing done in software/logic rather than fixed hardware.
*[side_ch]: openwifi's FPGA capture engine, tapping IQ and demodulator results independently of the packet path.
*[SIFS]: Short Interframe Space: the brief gap before an ACK (10 us at 2.4 GHz, 16 us at 5 GHz).
*[SoftMAC]: A Wi-Fi design where the upper MAC runs in host software (Linux mac80211).
*[SoC]: System on Chip: openwifi runs on Xilinx Zynq / Zynq UltraScale+ SoCs.
*[SODIMM]: Small Outline DIMM: the pluggable DRAM module used on some boards.
*[SoM]: System on Module: a small board carrying the SoC, RAM, and support circuitry.
*[SPI]: Serial Peripheral Interface: openwifi drives the AD9361's TX chain over an FPGA-generated SPI link.
*[SPL]: Secondary Program Loader: U-Boot's first-stage loader.
*[STA]: Station: any 802.11 device (a client, or an AP), the standard's term for a participant on the link.
*[STF]: Short Training Field: preamble symbols used for packet detection and synchronization.
*[STBC]: Space-Time Block Coding: an optional transmit-diversity scheme spreading data across space and time.
*[sysfs]: The Linux virtual filesystem exposing kernel/driver variables as files.
*[TSF]: Timing Synchronization Function: the 802.11 64-bit hardware timer.
*[TSN]: Time-Sensitive Networking: deterministic, scheduled networking.
*[TWT]: Target Wake Time: the 802.11ax scheduled power-saving mechanism.
*[UART]: Universal Asynchronous Receiver/Transmitter: the serial console.
*[U-Boot]: The bootloader that loads the Linux kernel on the board.
*[UHD]: USRP Hardware Driver: Ettus/NI's SDR driver framework (unrelated to openwifi's Wi-Fi operation).
*[VCXO]: Voltage-Controlled Crystal Oscillator: a tunable reference clock on some boards.
*[VDMA]: Video DMA: a Xilinx AXI DMA variant openwifi doesn't use (but one kernel patch works around it).
*[VHT]: Very High Throughput: the 802.11ac (Wi-Fi 5) feature set (not implemented by openwifi).
*[Viterbi]: The decoder for the convolutional FEC on receive (its eval license halts RX after ~2 hours).
*[Vivado]: Xilinx's FPGA design tool (openwifi targets Vivado 2022.2).
*[Vitis]: Xilinx's software/HLS design tool, used alongside Vivado.
*[wpa_supplicant]: The standard Linux client for joining Wi-Fi networks.
*[xpu]: openwifi's real-time MAC core: CSMA/CA, TSF, hardware ACK, filtering, and TX-queue gating.
*[Zynq]: Xilinx SoC family combining ARM cores (PS) with FPGA fabric (PL); Zynq-7000 is 32-bit.
*[MPSoC]: Zynq UltraScale+ (MPSoC): Xilinx's 64-bit SoC family (ZCU102).
