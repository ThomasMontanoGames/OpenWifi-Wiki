# Architecture Overview

This page explains how openwifi is put together: the split between Linux, the driver, and the FPGA. Read it before you start modifying code. For where each part lives in the source tree, see [The Repositories](Repositories.md). The driver internals are in [The Linux Driver](Driver-Architecture.md), and the FPGA cores in [FPGA IP Cores](FPGA-IP-Cores.md).

![openwifi software and FPGA module composition](assets/img/openwifi-detail.jpg)

*openwifi's full composition: software modules (top) and FPGA modules (bottom). The module names in this diagram match the source file names (`xpu`, `openofdm_tx/rx`, `tx_intf`, `rx_intf`, `side_ch`), which is the key to navigating both the code and this wiki.*

## The big picture

openwifi is a **SoftMAC** Wi-Fi design. The word "soft" refers to where the *upper* MAC lives: management, association, and higher-layer logic run in software (Linux `mac80211`), exactly as they do for a commercial SoftMAC chip. What makes openwifi unusual is that the **PHY and the timing-critical low MAC live in FPGA fabric** that you can read, modify, and rebuild.

Layered from top to bottom:

- **Linux user space**: `hostapd`, `wpa_supplicant`, `iw`, `dhclient`, `tcpdump`, plus openwifi's own `sdrctl` tool and helper scripts. The two Wi-Fi daemons are stock builds that reach the driver only through nl80211 and `mac80211`, never directly (see [hostapd and wpa_supplicant](hostapd-and-wpa_supplicant.md)).
- **Linux kernel: cfg80211 / mac80211**: the generic Linux wireless stack. Handles the upper MAC and calls into the driver through a fixed API.
- **openwifi driver (`driver/sdr.c` and friends)**: a SoftMAC driver that implements the mac80211 API and translates it into FPGA register writes and DMA transfers.
- **FPGA design (the openwifi-hw repo)**: OFDM transmitter and receiver, the CSMA/CA low MAC, and DMA interfaces to the processor.
- **AD9361 RF front end**: the analog radio (70 MHz–6 GHz), connected to the FPGA over the Analog Devices RF interface and controlled in real time over an FPGA-driven SPI link.

Because it registers a normal Linux network interface (`sdr0`), every tool that works with a commercial card works here too, which is the core idea behind openwifi.

<figure class="ow-svgfig">
<svg viewBox="0 0 760 800" width="760" height="800" role="img"
     aria-label="openwifi architecture: software on the ARM cores (PS) drives the openwifi-hw FPGA fabric (PL) over the AXI bus, and the PHY drives the AD9361 RF front end."
     style="max-width:100%;height:auto;color:var(--md-default-fg-color);font-family:var(--md-text-font-family,inherit)">
  <defs>
    <marker id="ow-arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
    </marker>
  </defs>

  <!-- ===== Container: Software (PS) ===== -->
  <rect x="30" y="40" width="700" height="290" rx="12"
        fill="currentColor" fill-opacity="0.025"
        stroke="currentColor" stroke-opacity="0.22" stroke-width="1.2"/>
  <text x="48" y="66" text-anchor="start" font-size="12.5" font-weight="600"
        fill="currentColor" fill-opacity="0.72">Software: Linux on the ARM cores (PS)</text>

  <!-- Container: FPGA fabric (PL) -->
  <rect x="30" y="380" width="700" height="270" rx="12"
        fill="currentColor" fill-opacity="0.025"
        stroke="currentColor" stroke-opacity="0.22" stroke-width="1.2"/>
  <text x="48" y="406" text-anchor="start" font-size="12.5" font-weight="600"
        fill="currentColor" fill-opacity="0.72">FPGA fabric (PL): the openwifi-hw design</text>

  <!-- ===== Connectors (drawn before nodes so borders sit on top) ===== -->
  <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-opacity="0.8">
    <!-- tools -> stack -> drv -->
    <path d="M380,142 V166" marker-end="url(#ow-arrow)"/>
    <path d="M380,224 V248" marker-end="url(#ow-arrow)"/>
    <!-- drv <-> intf : AXI bus (straight, crosses both container borders) -->
    <path d="M380,306 V424" marker-start="url(#ow-arrow)" marker-end="url(#ow-arrow)"/>
    <!-- intf <-> lowmac / phy : right-angle fan-out -->
    <path d="M330,482 V512 H215 V560" marker-start="url(#ow-arrow)" marker-end="url(#ow-arrow)"/>
    <path d="M430,482 V512 H545 V560" marker-start="url(#ow-arrow)" marker-end="url(#ow-arrow)"/>
    <!-- PL fabric <-> rf : the whole FPGA fabric interfaces to RF
         (I/Q via the iq_intf/adc/dac blocks, gain/AGC via xpu) -->
    <path d="M380,650 V712" marker-start="url(#ow-arrow)" marker-end="url(#ow-arrow)"/>
  </g>

  <!-- Edge labels (offset from the lines so nothing strikes through) -->
  <g font-size="11.5" fill="currentColor" fill-opacity="0.7">
    <text x="396" y="356" text-anchor="start">AXI bus:</text>
    <text x="396" y="371" text-anchor="start">register writes + DMA</text>
    <text x="396" y="676" text-anchor="start">I/Q samples ·</text>
    <text x="396" y="691" text-anchor="start">realtime gain/AGC</text>
  </g>

  <!-- ===== Nodes ===== -->
  <g font-size="12.5" text-anchor="middle">
    <!-- PS nodes (teal) -->
    <g>
      <rect x="205" y="84" width="350" height="58" rx="8" fill="#0d9488" fill-opacity="0.12" stroke="#0d9488" stroke-width="1.4"/>
      <text fill="currentColor"><tspan x="380" y="108">User space</tspan><tspan x="380" dy="17">hostapd · wpa_supplicant · iw · tcpdump · sdrctl</tspan></text>
      <rect x="205" y="166" width="350" height="58" rx="8" fill="#0d9488" fill-opacity="0.12" stroke="#0d9488" stroke-width="1.4"/>
      <text fill="currentColor"><tspan x="380" y="190">Kernel: cfg80211 / mac80211</tspan><tspan x="380" dy="17">the upper MAC (association, management)</tspan></text>
      <rect x="205" y="248" width="350" height="58" rx="8" fill="#0d9488" fill-opacity="0.12" stroke="#0d9488" stroke-width="1.4"/>
      <text fill="currentColor"><tspan x="380" y="272">openwifi driver (sdr.c)</tspan><tspan x="380" dy="17">implements the mac80211 API · creates NIC sdr0</tspan></text>
    </g>
    <!-- PL nodes (indigo) -->
    <g>
      <rect x="205" y="424" width="350" height="58" rx="8" fill="#6366f1" fill-opacity="0.12" stroke="#6366f1" stroke-width="1.4"/>
      <text fill="currentColor"><tspan x="380" y="448">tx_intf / rx_intf / side_ch</tspan><tspan x="380" dy="17">DMA + per-packet metadata</tspan></text>
      <rect x="70" y="560" width="290" height="64" rx="8" fill="#6366f1" fill-opacity="0.12" stroke="#6366f1" stroke-width="1.4"/>
      <text fill="currentColor"><tspan x="215" y="587">xpu · real-time low MAC</tspan><tspan x="215" dy="17">CSMA/CA · hardware ACK · TSF timer</tspan></text>
      <rect x="400" y="560" width="290" height="64" rx="8" fill="#6366f1" fill-opacity="0.12" stroke="#6366f1" stroke-width="1.4"/>
      <text fill="currentColor"><tspan x="545" y="587">openofdm_tx / openofdm_rx</tspan><tspan x="545" dy="17">OFDM PHY</tspan></text>
    </g>
    <!-- RF front end (neutral: external analog part) -->
    <rect x="230" y="712" width="300" height="60" rx="8" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.4"/>
    <text fill="currentColor"><tspan x="380" y="737">AD9361 RF front end</tspan><tspan x="380" dy="17">70 MHz–6 GHz</tspan></text>
  </g>
</svg>
<figcaption>The SoftMAC split. <span style="color:#0d9488;font-weight:700">Teal</span> = software on the Linux/ARM cores (PS): the upper MAC and everything above it. <span style="color:#6366f1;font-weight:700">Indigo</span> = the openwifi-hw design in FPGA fabric (PL) you can read and rebuild: the low MAC (<code>xpu</code>) and the PHY. The processor reaches every FPGA core over the AXI bus. The AD9361 RF front end is the external analog radio.</figcaption>
</figure>

## How the driver talks to Linux: the mac80211 API

The Linux `mac80211` subsystem defines a set of callbacks (`ieee80211_ops`) that every SoftMAC driver implements. That shared contract is why one kernel can drive Wi-Fi chips from dozens of vendors. openwifi's `sdr.c` implements the relevant subset: `tx` to send a frame, `start` / `stop` when the NIC goes up or down, `config` on a channel change, `get_tsf` / `set_tsf` for the hardware timer, `testmode_cmd` for [sdrctl](sdrctl-and-Runtime-Control.md), and around a dozen more. The [full callback table is on the driver page](Driver-Architecture.md#the-mac80211-callback-surface).

When Linux invokes one of these, `sdr.c` does the work by driving the FPGA. It uses per-block helper "sub-drivers" (`tx_intf_api`, `rx_intf_api`, `openofdm_tx_api`, `openofdm_rx_api`, and `xpu_api`), each of which wraps register access to one FPGA module. These are compiled as separate kernel modules (`tx_intf.ko`, `rx_intf.ko`, …) that `sdr.ko` binds to at load time, which is why `wgd.sh` inserts all of them.

openwifi is a Linux **platform driver** (not PCI or USB): it binds to a device-tree node with `compatible = "sdr,sdr"`, and the device tree is what tells Linux the AXI addresses and interrupts of every FPGA block, which is why [porting a board](FPGA-Development.md#porting-to-a-new-board) is largely a device-tree exercise. Separately, the AD9361 RF chip is driven by the standard Analog Devices IIO driver rather than by openwifi: the driver finds it on the SPI bus at probe time and calls into it (`ad9361_set_tx_atten`, `ad9361_do_calib_run`), which is why some [patches to the ADI kernel](Boot-Kernel-Device-Tree.md#the-kernel-patches) are needed (see [Software Development Workflow](Software-Development-Workflow.md#rebuilding-the-driver)).

For the probe sequence, board auto-detection, the TX rings and RX cyclic buffer, the received-packet metadata format, and the register category encoding, see [The Linux Driver](Driver-Architecture.md).

## The FPGA modules

The FPGA design decomposes into modules whose names match their source files (in `openwifi-hw/ip/`). These five names cover most of the register documentation:

- **`openofdm_tx`**: the OFDM transmitter. Turns a MAC frame into baseband IQ samples (PHY header, pilots, scrambling, modulation). Based on original openwifi work.
- **`openofdm_rx`**: the OFDM receiver. Detects the preamble, synchronizes, estimates the channel, equalizes, and decodes (including a Xilinx Viterbi decoder). Derived from the [openofdm](https://github.com/open-sdr/openofdm) project (originally by [jhshi](https://github.com/jhshi/openofdm), with openwifi's improvements on the `dot11zynq` branch).
- **`tx_intf`**: the transmit interface: DMA from the processor into per-queue FIFOs, the TX BRAM that `openofdm_tx` reads the frame out of, the DAC feed that carries the modulated IQ back out, per-packet PHY configuration, and the four hardware TX queues.
- **`rx_intf`**: the receive interface: unpacks the ADC samples into IQ streams for `openofdm_rx`, takes the decoded packets and side-channel data back, attaches metadata (TSF timestamp, RSSI, length, MCS, FCS status), and DMAs them up to the processor.
- **`xpu`**: the "eXtensible Processing Unit," which holds the **real-time low MAC**: the CSMA/CA state machine, NAV, DIFS/SIFS/EIFS timing, the TSF timer, hardware ACK generation and reception, retransmission, RTS/CTS, packet filtering, and the time-slicing gates for the TX queues. Anything that has to happen within microseconds is implemented in `xpu`.

There's also a **`side_ch`** (side channel) module used for research features (CSI and IQ capture), described on the [Research Features](Research-Features.md) page.

The processor reaches these modules over the ARM **AXI bus**. Each module exposes a bank of registers (`slv_regN` in the Verilog), whose addresses are defined in `driver/hw_def.h`. This AXI coupling is what gives openwifi very low processor↔PHY latency, and also what makes the design fairly platform-specific.

For a core-by-core walkthrough, see the dedicated [FPGA IP Cores](FPGA-IP-Cores.md) page: the submodules inside `xpu` (the CSMA/CA state machine, TSF timer, hardware SPI to the AD9361), the OFDM transmit and receive chains, and how a register write travels from `sdrctl` all the way to a `slv_regN`.

openwifi's FPGA design is built **on top of the [Analog Devices HDL reference design](https://github.com/analogdevicesinc/hdl)** (vendored as the `adi-hdl` submodule of openwifi-hw): ADI provides the AD9361 interfacing IP, DMA engines, and board plumbing, and openwifi inserts its own cores into that design. This is why [porting to a new board](FPGA-Development.md#porting-to-a-new-board) is framed as "diff openwifi against the matching ADI reference design."

## Packet flow at a glance

The transmit lane runs left to right from Linux out to the antenna, and the receive lane runs back. Note where the two interface cores sit: `tx_intf` and `rx_intf` are the cores that touch the AD9361 converters, and the OFDM cores hang off them rather than sitting between them and the radio.

<figure>
<svg viewBox="0 0 920 400" role="img" aria-label="openwifi packet flow. Transmit lane: Linux mac80211 to openwifi_tx to tx_intf (four TX queues) to the DAC and the AD9361. openofdm_tx sits above tx_intf, which hands it the frame bytes and gets modulated IQ back. Receive lane: the AD9361 through the ADC to rx_intf, then to the openwifi rx interrupt and back up to Linux. openofdm_rx sits below rx_intf, which hands it the ADC IQ and gets decoded bytes back." style="width:100%;height:auto;max-width:1000px;font-family:inherit;font-size:13px">
  <defs>
    <marker id="pf-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fill-opacity="0.6"/>
    </marker>
  </defs>

  <!-- lane labels -->
  <text x="72" y="112" text-anchor="middle" font-size="10" font-weight="700" fill="#0d9488" letter-spacing="0.08em">TRANSMIT →</text>
  <text x="72" y="298" text-anchor="middle" font-size="10" font-weight="700" fill="#4f5bd5" letter-spacing="0.08em">← RECEIVE</text>

  <!-- endpoints (span both lanes) -->
  <rect x="12" y="124" width="120" height="152" rx="12" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3"/>
  <text x="72" y="194" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">Linux</text>
  <text x="72" y="212" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.7">mac80211</text>
  <rect x="788" y="124" width="120" height="152" rx="12" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.3" stroke-dasharray="4 3"/>
  <text x="848" y="194" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">AD9361 RF</text>
  <text x="848" y="212" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.7">→ antenna</text>

  <!-- TX lane arrows -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none">
    <line x1="132" y1="150" x2="160" y2="150" marker-end="url(#pf-arrow)"/>
    <line x1="298" y1="150" x2="330" y2="150" marker-end="url(#pf-arrow)"/>
    <line x1="468" y1="150" x2="540" y2="150" marker-end="url(#pf-arrow)"/>
    <line x1="600" y1="150" x2="788" y2="150" marker-end="url(#pf-arrow)"/>
  </g>
  <!-- TX boxes (teal) -->
  <rect x="160" y="124" width="138" height="52" rx="10" fill="#0d9488" fill-opacity="0.05" stroke="#0d9488" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="229" y="145" text-anchor="middle" font-size="12" font-weight="700" fill="#0d9488">openwifi_tx()</text>
  <text x="229" y="160" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">driver builds config</text>
  <rect x="330" y="124" width="138" height="52" rx="10" fill="#0d9488" fill-opacity="0.05" stroke="#0d9488" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="399" y="145" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0d9488">tx_intf</text>
  <text x="399" y="160" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">4 TX queues, DMA</text>
  <rect x="540" y="132" width="60" height="36" rx="18" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.2" stroke-dasharray="4 3"/>
  <text x="570" y="155" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.85">DAC</text>

  <!-- openofdm_tx hangs off tx_intf -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none">
    <line x1="370" y1="124" x2="370" y2="88" marker-end="url(#pf-arrow)"/>
    <line x1="428" y1="88" x2="428" y2="124" marker-end="url(#pf-arrow)"/>
  </g>
  <text x="364" y="110" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.75">frame bytes</text>
  <text x="434" y="110" font-size="10" fill="currentColor" fill-opacity="0.75">IQ</text>
  <rect x="330" y="36" width="138" height="52" rx="10" fill="#0d9488" fill-opacity="0.05" stroke="#0d9488" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="399" y="57" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0d9488">openofdm_tx</text>
  <text x="399" y="72" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">OFDM modulate</text>

  <!-- RX lane arrows (right to left) -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none">
    <line x1="788" y1="250" x2="600" y2="250" marker-end="url(#pf-arrow)"/>
    <line x1="540" y1="250" x2="468" y2="250" marker-end="url(#pf-arrow)"/>
    <line x1="330" y1="250" x2="298" y2="250" marker-end="url(#pf-arrow)"/>
    <line x1="160" y1="250" x2="132" y2="250" marker-end="url(#pf-arrow)"/>
  </g>
  <!-- RX boxes (indigo) -->
  <rect x="540" y="232" width="60" height="36" rx="18" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.2" stroke-dasharray="4 3"/>
  <text x="570" y="255" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.85">ADC</text>
  <rect x="330" y="224" width="138" height="52" rx="10" fill="#4f5bd5" fill-opacity="0.05" stroke="#4f5bd5" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="399" y="245" text-anchor="middle" font-size="12.5" font-weight="700" fill="#4f5bd5">rx_intf</text>
  <text x="399" y="260" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">+ metadata · DMA</text>
  <rect x="160" y="224" width="138" height="52" rx="10" fill="#4f5bd5" fill-opacity="0.05" stroke="#4f5bd5" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="229" y="245" text-anchor="middle" font-size="12" font-weight="700" fill="#4f5bd5">rx interrupt</text>
  <text x="229" y="260" text-anchor="middle" font-size="8.5" fill="currentColor" fill-opacity="0.7">openwifi_rx_interrupt</text>

  <!-- openofdm_rx hangs off rx_intf -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none">
    <line x1="370" y1="276" x2="370" y2="312" marker-end="url(#pf-arrow)"/>
    <line x1="428" y1="312" x2="428" y2="276" marker-end="url(#pf-arrow)"/>
  </g>
  <text x="364" y="298" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.75">ADC IQ</text>
  <text x="434" y="298" font-size="10" fill="currentColor" fill-opacity="0.75">decoded bytes</text>
  <rect x="330" y="312" width="138" height="52" rx="10" fill="#4f5bd5" fill-opacity="0.05" stroke="#4f5bd5" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="399" y="333" text-anchor="middle" font-size="12.5" font-weight="700" fill="#4f5bd5">openofdm_rx</text>
  <text x="399" y="348" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">sync · decode</text>
</svg>
<figcaption><em>The packet path. <strong>Teal is transmit:</strong> the driver's <code>openwifi_tx()</code> DMAs a frame into one of <code>tx_intf</code>'s four TX queues, <code>openofdm_tx</code> reads the bytes out and hands modulated IQ back, and <code>tx_intf</code> drives the DAC. The <code>xpu</code> core releases the packet when CSMA/CA allows, then raises <code>openwifi_tx_interrupt</code> with the result. <strong>Indigo is receive:</strong> <code>rx_intf</code> takes the IQ from the ADC and passes it to <code>openofdm_rx</code>, which decodes and hands the bytes back, then <code>rx_intf</code> attaches TSF/RSSI/MCS/FCS metadata and DMAs the frame up to <code>openwifi_rx_interrupt</code>.</em></figcaption>
</figure>

## The receive path, step by step

1. A signal arrives at the AD9361 and is delivered to the FPGA as ADC samples. `rx_intf` unpacks them into per-antenna IQ streams and feeds them to the demodulator.
2. `openofdm_rx` detects, synchronizes, and decodes it, and hands the bytes back to `rx_intf`. Whether the FCS/CRC passes or fails, the packet is offered up if the current [frame-filtering rules](sdrctl-and-Runtime-Control.md#xpu-low-mac) allow it (in monitor mode, everything is allowed, even bad-CRC frames and control frames like ACKs).
3. `rx_intf` writes the packet plus metadata into a DMA buffer and raises an interrupt.
4. The driver's `openwifi_rx_interrupt()` runs: it pulls the raw buffer, parses out the inserted metadata (TSF timestamp, raw RSSI that it corrects to dBm per band/channel, length, MCS, FCS-valid flag), and hands the packet and its metadata to Linux via `ieee80211_rx_irqsafe()`.

The [exact 16-byte metadata layout](Driver-Architecture.md#the-receive-path-inside-the-driver) is on the driver page, including the detail that the FCS-OK bit is carried in the last byte of the frame rather than in the header.

## The transmit path, step by step

1. Linux `mac80211` calls `openwifi_tx()` with a frame to send.
2. The driver reads what it needs from the 802.11 header and mac80211 metadata: length and MCS, unicast vs broadcast, whether an ACK is required and the maximum number of retransmissions the FPGA may attempt, which TX queue / time slice to use, whether RTS/CTS or CTS-to-self protection applies, and whether the driver should insert a sequence number.
3. It picks one of four TX rings (by Linux priority, or by destination MAC when time slicing is active) and writes the frame into a buffer descriptor.
4. It writes the per-packet FPGA configuration (so the FPGA generates the right PHY header, etc.) and fires a DMA transfer into one of the four FPGA TX queues. The packet may not go out immediately: the FPGA sends it when the channel and the CSMA state machine allow.
5. When it is released, `openofdm_tx` reads the frame out of the TX BRAM inside `tx_intf` and hands the modulated IQ back, and `tx_intf` drives it into the DAC.
6. When the FPGA finishes sending, it raises an interrupt. `openwifi_tx_interrupt()` reads back the result (success or failure, meaning whether an ACK was received, and how many retransmissions happened) and reports it to Linux via `ieee80211_tx_status_irqsafe()`.

The ring sizes, the index cross-checking, and the queue-mapping hook are covered on [The Linux Driver](Driver-Architecture.md#the-transmit-path-inside-the-driver).

## The TSF timestamp

The 64-bit TSF (Timing Synchronization Function) timer is defined by the 802.11 standard and implemented in the FPGA. When a packet's PHY header is received, the FPGA samples the TSF value and attaches it to the packet's DMA buffer. The driver forwards it to Linux, which is why you see a consistent TSF timestamp in Wireshark/tcpdump. That same TSF value is the key that lets you line up side-channel data (CSI, IQ) with specific packets, since they share one time base. (See [this discussion](https://github.com/open-sdr/openwifi/discussions/344) for the matching recipe.)

## RF and baseband: the frequency/clock design

openwifi drives the AD9361 in **FDD mode with identical TX and RX frequencies**, and controls the AD9361 TX chain in real time over an FPGA SPI link (`openwifi-hw/ip/xpu/src/spi.v`). The TX local oscillator (or an RF switch) is turned **on just before** a transmit packet and **off just after** it, with two consequences:

- **No LO leakage during receive**, so the receiver does not interfere with itself, which enables full-duplex self-reception (the basis of the CSI radar and loopback features).
- **Fast TX/RX turnaround** (~0.6 µs), which is what makes the tight SIFS and hardware ACK timing achievable (SIFS is 10 µs in 2.4 GHz and 16 µs in 5 GHz).

The AD9361↔FPGA IQ rate is 40 Msps, decimated/interpolated inside the FPGA to the 20 Msps the Wi-Fi baseband uses. The **FPGA baseband clock is derived from the AD9361 clock**, so RF and baseband never drift relative to each other. This design (replacing the older "offset tuning" approach) is what gives openwifi its good EVM, spectral mask conformance, sensitivity, and RSSI accuracy.

![Baseband clock derived from the AD9361 clock](assets/img/bb-clk.jpg)

*The FPGA baseband clock is generated from the AD9361 sample clock, so the two never drift. The exact clock frequency per board is the `NUM_CLK_PER_US` parameter discussed in [Supported Boards](Supported-Boards.md#the-baseband-clock-per-board).*

The configuration points of this RF/digital chain are spread across the AD9361 registers, the driver's `.c` files, and the FPGA `.v` modules:

![RF and digital IF chain configuration points](assets/img/rf-digital-if-chain-config.jpg)

## What openwifi implements of 802.11a/g/n

openwifi implements 802.11a/g (legacy OFDM) and a **single-stream 20 MHz subset of 802.11n (Wi-Fi 4)**. Which 11n improvements it does and doesn't have sets its performance envelope. 802.11n added five PHY improvements on top of 802.11a/g's 54 Mbps ceiling:

| 802.11n improvement | Effect | openwifi? |
|---|---|---|
| **More subcarriers** (48 → 52 data) | 54 → 58.5 Mbps | ✅ yes |
| **Higher FEC rate** (3/4 → 5/6) | 58.5 → 65 Mbps | ✅ yes |
| **Short guard interval** (800 → 400 ns) | 65 → 72.2 Mbps | ✅ yes |
| **MIMO** (up to 4 spatial streams) | 72.2 → 288.9 Mbps | ❌ no |
| **40 MHz bandwidth** (108 data subcarriers) | 288.9 → 600 Mbps | ❌ no |

So the open-source release reaches a **theoretical 72.2 Mbps single-stream**, not the full-11n 600 Mbps (which requires 4×4 MIMO + 40 MHz).

<figure markdown>
![48 vs 52 OFDM data subcarriers](assets/img/subcarriers.png){ width="650" }
<figcaption>More data subcarriers (48 → 52): openwifi implements this.</figcaption>
</figure>

<figure markdown>
![800 ns vs 400 ns guard interval](assets/img/guard-interval.png){ width="650" }
<figcaption>Short guard interval (800 → 400 ns): openwifi implements this.</figcaption>
</figure>

On the **MAC** side, 802.11n added frame aggregation. There are two flavors: **A-MSDU** (efficient, but one bit error invalidates the whole aggregate) and **A-MPDU** (per-subframe headers, so a single error only costs one retransmission, which is the more widely adopted choice).

![A-MPDU vs A-MSDU aggregation](assets/img/mpdu-aggr.png){ width="650" }

openwifi supports **A-MPDU aggregation experimentally** (`./wgd.sh 1`, which sets `test_mode` bit 0). A-MSDU is not supported. Background and the full derivation are in the [802.11n app note](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/ieee80211n.md). For how to enable and verify these features in practice, and where Wi-Fi 6 stands, see [Wi-Fi 4 & Wi-Fi 6 Features](Wi-Fi-4-and-Wi-Fi-6.md).

## Where the source lives

| Component | Location |
|---|---|
| Driver (main) | `openwifi/driver/sdr.c`, `sdr.h` |
| Per-block driver APIs | `openwifi/driver/{tx_intf,rx_intf,openofdm_tx,openofdm_rx,xpu}/` |
| Side channel (separate module) | `openwifi/driver/side_ch/` |
| Register addresses | `openwifi/driver/hw_def.h` |
| sdrctl ↔ driver glue | `openwifi/driver/sdrctl_intf.c` |
| sysfs interface | `openwifi/driver/sysfs_intf.c` |
| `sdrctl` tool source | `openwifi/user_space/sdrctl_src/` |
| Helper scripts & demos | `openwifi/user_space/` |
| FPGA IP cores | `openwifi-hw/ip/{openofdm_tx,openofdm_rx,tx_intf,rx_intf,xpu,side_ch}/` |
| Board-level FPGA projects | `openwifi-hw/boards/<board_name>/` |

One convention to note: a driver file and its FPGA counterpart usually share a name (`xpu.c` ↔ `xpu.v`), and each FPGA register is `slv_regN` in the `.v` file. The register tables on the [sdrctl](sdrctl-and-Runtime-Control.md) page always point back to these.

## Two communication channels between driver and user space

1. **`sdrctl`**: an `nl80211` testmode command, routed through the standard `nl80211 → cfg80211 → mac80211` path and handled by `openwifi_testmode_cmd()` in `sdrctl_intf.c`. Best for issuing commands and reading/writing registers.
2. **sysfs**: driver variables exposed as virtual files (via `sysfs_intf.c`). Best for statistics and for scripts. On the ZCU102 these files live under `/sys/devices/platform/fpga-axi@0/fpga-axi@0:sdr`, on other boards under `/sys/devices/soc0/fpga-axi@0/fpga-axi@0:sdr`.

Both are described in detail on [The Linux Driver](Driver-Architecture.md#two-channels-to-user-space), including how the register category is packed into the upper 16 bits of the address and which categories never reach the FPGA.
