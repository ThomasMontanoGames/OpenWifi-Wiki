# The FPGA IP Cores

This is a reference for the **custom FPGA IP cores** that make up openwifi's hardware design, all living in [`openwifi-hw/ip/`](https://github.com/open-sdr/openwifi-hw/tree/master/ip). If [Architecture](Architecture.md) is the map of how Linux, the driver, and the FPGA fit together, this page zooms into the FPGA half: what each core does, how they chain together into the signal path, and how they expose themselves to the driver.

This is the material you want when you are about to modify the PHY or the real-time MAC, or when you are reading the [register reference](sdrctl-and-Runtime-Control.md) and want to know what is actually on the other end of a register write. For the build/simulate/port workflow, see [FPGA Development](FPGA-Development.md).

## The signal chain

The six cores form a transmit chain and a receive chain that meet at the AD9361 RF front end, with the `xpu` real-time MAC orchestrating everything and `side_ch` tapping the receiver for research capture.

`tx_intf` and `rx_intf` are **not** links in a straight line between the processor and the converters. Each one sits on **both** sides of its OFDM core: `tx_intf` takes the frame in over DMA, hands the bytes to `openofdm_tx`, takes the modulated IQ back, and is itself what drives the DAC. `rx_intf` takes the IQ in from the ADC, hands it to `openofdm_rx`, takes the decoded bytes back, and DMAs them to Linux.

<figure>
<svg viewBox="0 0 880 470" role="img" aria-label="openwifi FPGA signal chain. The main chain runs Linux to tx_intf to DAC to AD9361 RF to ADC to rx_intf to Linux. openofdm_tx hangs off tx_intf below it: tx_intf hands it the frame bytes and it hands back modulated IQ, which tx_intf sends on to the DAC. openofdm_rx hangs off rx_intf below it: rx_intf hands it the ADC IQ and it hands back decoded bytes, which rx_intf DMAs up to Linux. The xpu real-time MAC sits above the chain and side_ch taps the receiver to capture CSI and IQ." style="width:100%;height:auto;max-width:1080px;font-family:inherit;font-size:13px">
  <defs>
    <marker id="ipc-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fill-opacity="0.6"/>
    </marker>
  </defs>

  <!-- xpu: the orchestrator, on top -->
  <rect x="97" y="40" width="686" height="58" rx="12" fill="#c2740a" fill-opacity="0.08" stroke="#c2740a" stroke-opacity="0.6" stroke-width="1.5"/>
  <text x="440" y="65" text-anchor="middle" font-size="14" font-weight="700" fill="#c2740a">xpu · real-time MAC</text>
  <text x="440" y="85" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.8">CSMA/CA · TSF timer · ACK gen/rx · CCA · packet filter · 4× TX-queue gating</text>

  <!-- xpu to the two interface cores -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.5" fill="none">
    <line x1="263" y1="188" x2="263" y2="98" marker-start="url(#ipc-arrow)" marker-end="url(#ipc-arrow)"/>
    <line x1="617" y1="188" x2="617" y2="98" marker-end="url(#ipc-arrow)"/>
  </g>
  <text x="271" y="132" font-size="10" fill="currentColor" fill-opacity="0.75">queue gating ·</text>
  <text x="271" y="144" font-size="10" fill="currentColor" fill-opacity="0.75">ACK into TX BRAM</text>
  <text x="609" y="132" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.75">ADC IQ for</text>
  <text x="609" y="144" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.75">CCA / RSSI</text>

  <!-- xpu to the two OFDM cores, routed around the outside -->
  <g stroke="currentColor" stroke-opacity="0.5" stroke-width="1.4" fill="none">
    <path d="M197,328 H64 V70 H97" marker-end="url(#ipc-arrow)"/>
    <path d="M683,328 H816 V70 H783" marker-end="url(#ipc-arrow)"/>
  </g>
  <text x="72" y="294" font-size="10" fill="currentColor" fill-opacity="0.75">tx start / done</text>
  <text x="808" y="294" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.75">demod status</text>

  <!-- main chain: Linux · tx_intf · DAC · AD9361 · ADC · rx_intf · Linux (y=214) -->
  <g stroke="currentColor" stroke-opacity="0.6" stroke-width="1.6" fill="none">
    <line x1="177" y1="214" x2="211" y2="214" marker-end="url(#ipc-arrow)"/>
    <line x1="315" y1="214" x2="335" y2="214" marker-end="url(#ipc-arrow)"/>
    <line x1="379" y1="214" x2="397" y2="214" marker-end="url(#ipc-arrow)"/>
    <line x1="483" y1="214" x2="501" y2="214" marker-end="url(#ipc-arrow)"/>
    <line x1="545" y1="214" x2="565" y2="214" marker-end="url(#ipc-arrow)"/>
    <line x1="669" y1="214" x2="703" y2="214" marker-end="url(#ipc-arrow)"/>
  </g>
  <text x="194" y="206" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">DMA</text>
  <text x="686" y="206" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.6">DMA</text>

  <!-- Linux (TX) -->
  <rect x="97" y="188" width="80" height="52" rx="10" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.3"/>
  <text x="137" y="218" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Linux</text>
  <!-- tx_intf (teal) -->
  <rect x="211" y="188" width="104" height="52" rx="10" fill="#0d9488" fill-opacity="0.05" stroke="#0d9488" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="263" y="209" text-anchor="middle" font-size="13" font-weight="700" fill="#0d9488">tx_intf</text>
  <text x="263" y="224" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">TX BRAM · DAC feed</text>
  <!-- DAC (external, dashed) -->
  <rect x="335" y="194" width="44" height="40" rx="20" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.2" stroke-dasharray="4 3"/>
  <text x="357" y="218" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.85">DAC</text>
  <!-- AD9361 (external, dashed) -->
  <rect x="397" y="194" width="86" height="40" rx="20" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.4" stroke-dasharray="4 3"/>
  <text x="440" y="218" text-anchor="middle" font-size="11.5" font-weight="600" fill="currentColor">AD9361 RF</text>
  <!-- ADC (external, dashed) -->
  <rect x="501" y="194" width="44" height="40" rx="20" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.2" stroke-dasharray="4 3"/>
  <text x="523" y="218" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.85">ADC</text>
  <!-- rx_intf (indigo) -->
  <rect x="565" y="188" width="104" height="52" rx="10" fill="#4f5bd5" fill-opacity="0.05" stroke="#4f5bd5" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="617" y="209" text-anchor="middle" font-size="13" font-weight="700" fill="#4f5bd5">rx_intf</text>
  <text x="617" y="224" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">ADC unpack · metadata</text>
  <!-- Linux (RX) -->
  <rect x="703" y="188" width="80" height="52" rx="10" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.3"/>
  <text x="743" y="218" text-anchor="middle" font-size="12" font-weight="600" fill="currentColor">Linux</text>

  <!-- the two OFDM cores hang off their interface core -->
  <g stroke="currentColor" stroke-opacity="0.6" stroke-width="1.6" fill="none">
    <line x1="239" y1="240" x2="239" y2="300" marker-end="url(#ipc-arrow)"/>
    <line x1="287" y1="300" x2="287" y2="240" marker-end="url(#ipc-arrow)"/>
    <line x1="593" y1="240" x2="593" y2="300" marker-end="url(#ipc-arrow)"/>
    <line x1="641" y1="300" x2="641" y2="240" marker-end="url(#ipc-arrow)"/>
  </g>
  <text x="233" y="274" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.75">frame bytes</text>
  <text x="293" y="274" font-size="10" fill="currentColor" fill-opacity="0.75">IQ</text>
  <text x="587" y="274" text-anchor="end" font-size="10" fill="currentColor" fill-opacity="0.75">IQ</text>
  <text x="647" y="274" font-size="10" fill="currentColor" fill-opacity="0.75">bytes · fcs_ok</text>

  <!-- openofdm_tx (teal) -->
  <rect x="197" y="300" width="132" height="56" rx="10" fill="#0d9488" fill-opacity="0.05" stroke="#0d9488" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="263" y="323" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0d9488">openofdm_tx</text>
  <text x="263" y="339" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">FEC · mod · IFFT</text>
  <!-- openofdm_rx (indigo) -->
  <rect x="551" y="300" width="132" height="56" rx="10" fill="#4f5bd5" fill-opacity="0.05" stroke="#4f5bd5" stroke-opacity="0.5" stroke-width="1.3"/>
  <text x="617" y="323" text-anchor="middle" font-size="12" font-weight="700" fill="#4f5bd5">openofdm_rx</text>
  <text x="617" y="339" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">sync · eq · Viterbi</text>

  <!-- side_ch tap + box -->
  <path d="M617,356 V374 H440 V392" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.5" fill="none" marker-end="url(#ipc-arrow)"/>
  <text x="528" y="368" text-anchor="middle" font-size="10.5" fill="currentColor" fill-opacity="0.8">CSI · equalizer · raw IQ taps</text>
  <rect x="340" y="392" width="200" height="54" rx="12" fill="#be3d73" fill-opacity="0.06" stroke="#be3d73" stroke-opacity="0.55" stroke-width="1.5"/>
  <text x="440" y="417" text-anchor="middle" font-size="13" font-weight="700" fill="#be3d73">side_ch · CSI / IQ capture</text>
  <text x="440" y="434" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">per-packet CSI, equalizer, raw IQ</text>
  <line x1="340" y1="419" x2="250" y2="419" stroke="currentColor" stroke-opacity="0.6" stroke-width="1.6" marker-end="url(#ipc-arrow)" fill="none"/>
  <text x="295" y="411" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">DMA → Linux</text>
</svg>
<figcaption><em>The openwifi FPGA signal chain. Solid boxes are openwifi IP cores (teal = transmit, indigo = receive), and dashed pills are the external AD9361 RF front end. The row through the middle is the path to and from the radio, and each OFDM core hangs off its interface core: <code>tx_intf</code> feeds <code>openofdm_tx</code> the frame bytes and sends the IQ it gets back to the DAC, <code>rx_intf</code> feeds <code>openofdm_rx</code> the ADC IQ and DMAs the bytes it gets back to Linux. The <strong>xpu</strong> real-time MAC orchestrates timing and channel access, while <strong>side_ch</strong> taps the receiver to stream CSI/IQ to the host.</em></figcaption>
</figure>

Every core is an AXI4-Lite slave for control (register bank named `*_s_axi.v`) and, where it moves sample data, an AXI-Stream master/slave for DMA. All are authored by Xianjun Jiao (with Michael Mehari co-authoring `openofdm_tx`). A driver file and its FPGA core usually share a name (`xpu.c` ↔ `xpu.v`), and every register the driver writes (`hw_def.h`) has a matching `slv_regN` in the core's `_s_axi.v`.

| Core | Role | Register bank size | Unit-test benches? |
|---|---|---|---|
| `xpu` | Real-time MAC (CSMA/CA, ACK, TSF, filtering, queue gating) | **64** AXI-Lite regs | yes (`fifo_sample_delay`, `mv_avg`) |
| `openofdm_tx` | 802.11 OFDM transmitter | 32 regs | yes (`test_vec/`) |
| `openofdm_rx` | 802.11 OFDM receiver | (submodule) | yes (`dot11_tb`) |
| `tx_intf` | DAC-side interface + TX BRAM + CSI fuzzer | 32 regs | no |
| `rx_intf` | ADC-side interface + RX DMA | 32 regs | yes (`adc_intf`) |
| `side_ch` | CSI / raw-IQ capture side channel | 32 regs | no |

---

## `xpu`: the real-time MAC

`xpu` (sometimes read as "transceiver/eXtensible processing unit") is the central core of openwifi and the largest: its register file `xpu_s_axi.v` (48 KB, 64 registers) is the biggest register bank of any core, and twice the size of the other cores' banks. It implements everything that has to happen in **microseconds** (too fast for the Linux MAC to handle), which is why openwifi can meet 802.11 timing that a pure-software MAC cannot.

What lives inside (`ip/xpu/src/`, 21 Verilog files):

- **`csma_ca.v`**: the CSMA/CA (DCF) state machine proper. It consumes NAV/DIFS/EIFS enable flags, the contention-window exponent, SIFS/slot/DIFS/backoff timing parameters, MAC-address match, and TX-status feedback to arbitrate channel access exactly per the 802.11 distributed coordination function. This is the hardware DCF, offloaded from `mac80211`.
- **`tx_control.v`**: sequences packet transmission (the largest logic file at 30 KB).
- **`tsf_timer.v`**: the 64-bit TSF (Timing Synchronization Function) counter, the 802.11 clock that timestamps received packets and drives timing-critical MAC operations. Readable via `xpu` regs 58/59, loadable via regs 2/3.
- **`pkt_filter_ctl.v`**: packet address/type filtering (the FPGA side of `openwifi_configure_filter()`, which monitor mode opens fully).
- **`phy_rx_parse.v`**: parses PHY-header fields coming out of the receiver.
- **`rssi.v`, `iq_rssi_to_db.v`, `cca.v`, `dc_rm.v`, `mv_avg*.v`**: clear-channel-assessment / carrier sensing and RSSI measurement (moving-average power, DC removal).
- **`time_slice_gen.v`**: generates the gating for the four hardware TX queues (`slice_en[0:3]`), the mechanism behind [MAC-address time slicing](sdrctl-and-Runtime-Control.md#time-slicing-network-slicing).
- **`spi.v`**: an SPI master used to control the AD9361 TX chain in real time (turning the TX LO/switch on just before a packet and off just after, see [Architecture](Architecture.md#rf-and-baseband-the-frequencyclock-design)).
- **`cw_exp.v`, `tx_on_detection.v`, `edge_to_flip.v`, `fifo_sample_delay.v`, `n_sym_len14_pkt.v`**: contention-window exponent, TX-onset detection, and assorted timing/FIFO helpers.

`xpu` connects to *both* the RF/ADC path (`ddc_i/q`, `mute_adc_out_to_bb`) and the demodulator (`demod_is_ongoing`, `pkt_header_valid`, `fcs_ok`, `pkt_rate`, `pkt_len`), which is why it can implement hardware ACK generation and reception, retransmission, and CCA. It is addressed by the driver as register space `xpu` (category 6) and its git build revision is readable at register 63.

---

## `openofdm_tx`: the OFDM transmitter

Turns a MAC frame into baseband IQ samples. It reads bytes from a 64-bit-wide, 1024-deep TX BRAM (shared with `tx_intf` and `xpu`) and produces I/Q through the full 802.11 transmit chain: scrambling, convolutional encoding, puncturing/interleaving, modulation mapping, pilot and preamble insertion, and an IFFT.

Notable source (`ip/openofdm_tx/src/`, 28 files):

- **`dot11_tx.v`**: the 802.11 TX datapath FSM.
- **The IFFT pipeline**: `ifftmain.v`, `ifftstage.v`, `butterfly.v`, `hwbfly.v`, and partial-product multipliers (`bimpy.v`, `longbimpy.v`).
- **`convenc.v` + `punc_interlv_lut.v`**: convolutional encoder and the punctured-interleave lookup ROMs. `punc_interlv_lut.v` (128 KB) is the largest single file in the whole IP tree, holding the FEC puncturing/interleaving patterns for every 802.11 MCS.
- **Preamble ROMs**: `l_stf_rom.v` / `l_ltf_rom.v` (legacy short/long training fields) and `ht_stf_rom.v` / `ht_ltf_rom.v` (802.11n HT training fields).
- **`modulation.v`, `crc32_tx.v`, `bitreverse.v`, `dpram.v`, `axi_fifo_bram.v`**: the modulation mapper, frame CRC, and buffering.

Addressed as register space `tx` (category 5). Scrambler seeds are at regs 1/2 (default 127).

---

## `openofdm_rx`: the OFDM receiver

The receive counterpart: it detects the preamble, synchronizes, estimates the channel, equalizes, and Viterbi-decodes, handing parsed bytes (`byte_in`, `fcs_ok`, `pkt_rate`, `pkt_len`) up to `xpu` and `rx_intf`. It is the core that most affects **receiver sensitivity** (documented per band/board around −92 dBm at MCS0 / −73 dBm at MCS7 on FMCOMMS2 at 2.4 GHz).

Unlike the other five cores, `openofdm_rx` is a **git submodule**: it lives in the separate [openofdm](https://github.com/open-sdr/openofdm) repo (branch `dot11zynq`, or `dot11zynq_hls` for the HLS variant), and a fresh `openwifi-hw` clone has an empty `ip/openofdm_rx/` until you run `./get_ip_openofdm_rx.sh`. Its simulation entry point is the `dot11_tb` testbench (`dot11_inst → ofdm_decoder_inst → viterbi_inst`), which is also where you find the **Xilinx Viterbi decoder**, the IP whose evaluation license causes a running board's receiver to halt after ~2 hours (see [Troubleshooting](Troubleshooting.md#reception-dies-after-2-hours)).

Addressed as register space `rx` (category 4). Its `signal_watchdog` submodule powers the [openofdm_rx watchdog counters](Research-Features.md#fpga-event-counters), and the driver reads its build revision at register 31. See [FPGA Development → HLS](FPGA-Development.md#high-level-synthesis-hls-modules) for building the channel-estimation and equalizer stages from C++ via Vitis HLS.

---

## `tx_intf`: the transmit RF/DAC interface

Sits between the OFDM transmitter and the AD9361 DAC. It owns the 64-bit-wide, 1024-deep TX BRAM that `openofdm_tx` reads from, packages transmit I/Q for the DAC (via ADI's `axi_ad9361_dac_dma` / `util_ad9361_dac_upack` blocks), streams frame data in over AXI-Stream DMA from the driver, and raises the TX-done interrupt and LEDs (`tx_itrpt_led`, `tx_end_led`).

Two research-relevant pieces live here:

- **`csi_fuzzer.v`**: injects a controlled *artificial* channel response into the transmitter, the hardware behind the [CSI fuzzer](Research-Features.md#csi-fuzzer-privacy-protection) privacy feature (`tx_intf` register 5).
- **`ht_sig_crc_calc.v`**: computes the CRC for the 802.11n HT-SIG field.

Also here: `tx_bit_intf.v` (the raw-bit/PHY-level TX interface, the largest file in this core), `dac_intf.v`, `tx_iq_intf.v` (which holds the 512-sample arbitrary-IQ FIFO), and `tx_status_fifo.v`. Addressed as register space `tx_intf` (category 3). See the [tx_intf register table](sdrctl-and-Runtime-Control.md#tx_intf-fpga-tx-interface).

---

## `rx_intf`: the receive RF/ADC interface

The mirror of `tx_intf`. It unpacks raw ADC samples from the AD9361 (via ADI's `axi_ad9361_adc_dma` / `util_ad9361_adc_pack`), converts them into per-antenna I/Q streams, appends FCS/sequence-number bookkeeping onto received frames (`byte_to_word_fcs_sn_insert.v`), drives status LEDs (`fcs_ok_led`), and DMAs packets plus their metadata up to the processor.

The 16-byte metadata header that `rx_intf` prepends to each received packet is exactly what the driver's `openwifi_rx_interrupt()` parses: TSF timestamp, `rssi_half_db`, AGC status, length, rate index, and the FCS-OK bit. It also exposes 8 debug `trigger_out` signals and supports the FPGA-internal loopback path (`rx_intf` register 3 selects "IQ from `tx_intf`" instead of "IQ from the ADC") used by [self-loopback testing](Research-Features.md#self-loopback-testing). Addressed as register space `rx_intf` (category 2), with source in `ip/rx_intf/src/` (11 files) and an `adc_intf` testbench.

---

## `side_ch`: the CSI / IQ capture side channel

This is openwifi's research capture core. `side_ch` taps into the receiver's I/Q datapath *and* the OFDM demodulator's internal results, buffers them, and streams them out over its own AXI-Stream DMA channel, completely independent of the normal packet RX/TX path. This is what lets you pull per-packet **CSI, equalizer output, frequency offset, raw IQ, AGC gain, and RSSI** up to a PC.

Its inputs (read directly from `side_ch.v` / `side_ch_control.v`) show what it can reach: TX-side taps (`openofdm_tx_iq0/iq1`, `tx_intf_iq0/iq1`), raw ADC-rate I/Q (`sample0_in`/`sample1_in`), demodulator status (`demod_is_ongoing`, `long/short_preamble_detected`, `ht_unsupport`, `pkt_rate`, `pkt_len`), and most importantly **`csi`/`csi_valid`** and **`equalizer`/`equalizer_valid`**, the per-subcarrier channel estimate and equalizer coefficients from the OFDM receiver. Everything is timestamped against the shared 64-bit TSF (so captures line up with packets) and tagged with RSSI.

`side_ch_control.v` (36 KB) is the capture/trigger FSM implementing the [32 trigger conditions](side_ch_ctl-and-the-Side-Channel.md#trigger-reference-register-8). A `MAX_NUM_DMA_SYMBOL` parameter sizes the internal FIFO: 8192 normally, halved to 4096 on small FPGAs via the `SIDE_CH_LESS_BRAM` macro, which is why Zynq-7020 boards cap capture length lower.

`side_ch` differs from the other cores in one way: it is **not** part of the main `sdr.ko` driver. It has its own kernel module `side_ch.ko` (built by `openwifi/driver/side_ch/make_driver.sh`) and its own user-space tool `side_ch_ctl`, because you load and unload it on demand rather than always running it. See [Research Features](Research-Features.md) for the full workflow, and [side_ch_ctl and the Side Channel](side_ch_ctl-and-the-Side-Channel.md) for the command grammar and the register map.

---

## How a register write reaches a core

Tying it back to the control plane: when you run `sdrctl dev sdr0 set reg xpu 11 16`, the value travels an `nl80211` testmode message → `openwifi_testmode_cmd()` in the driver → the per-core driver API (`xpu_api->reg_write`) → an AXI-Lite write to `slv_reg11` in `xpu_s_axi.v`. The register *category* number is fixed across the whole stack: `rf`=1, `rx_intf`=2, `tx_intf`=3, `rx`=4, `tx`=5, `xpu`=6, and the driver-shadow spaces `drv_rx`=7, `drv_tx`=8, `drv_xpu`=9. The [sdrctl page](sdrctl-and-Runtime-Control.md) documents the registers themselves. This page is what they connect to.
