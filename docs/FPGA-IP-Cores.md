# The FPGA IP Cores

This is a reference for the **custom FPGA IP cores** that make up openwifi's hardware design, all living in [`openwifi-hw/ip/`](https://github.com/open-sdr/openwifi-hw/tree/master/ip). If [Architecture](Architecture.md) is the map of how Linux, the driver, and the FPGA fit together, this page zooms into the FPGA half: what each core does, how they chain together into the signal path, and how they expose themselves to the driver.

This is the material you want when you are about to modify the PHY or the real-time MAC — or when you are reading the [register reference](sdrctl-and-Runtime-Control.md) and want to know what is actually on the other end of a register write. For the build/simulate/port workflow, see [FPGA Development](FPGA-Development.md).

## The signal chain

The six cores form a transmit chain and a receive chain that meet at the AD9361 RF front end, with the `xpu` real-time MAC orchestrating everything and `side_ch` tapping the receiver for research capture:

```
                          ┌──────────────────────────────────────────┐
                          │            xpu (real-time MAC)            │
                          │  CSMA/CA · TSF timer · ACK gen/rx · CCA   │
                          │  packet filter · 4× TX-queue gating       │
                          └───▲───────────────┬──────────────────▲────┘
              status/timing   │               │ gating/timing    │ demod status
                              │               ▼                  │
   Linux ──DMA──►  tx_intf ──►│  openofdm_tx ──► [DAC] ──► AD9361 RF ──► [ADC] ──► rx_intf ──► openofdm_rx ──► Linux (DMA)
                   (TX BRAM,   │  (IFFT, FEC,                            (ADC unpack,  (sync, chan-est,
                    CSI fuzzer)│   modulation)                           metadata)      equalize, Viterbi)
                              │                                                             │
                              │                                              csi / equalizer / raw IQ taps
                              │                                                             ▼
                              └──────────────────────────────────────────────────►  side_ch (CSI / IQ capture) ──► Linux (DMA)
```

Every core is an AXI4-Lite slave for control (register bank named `*_s_axi.v`) and, where it moves sample data, an AXI-Stream master/slave for DMA. All are authored by Xianjun Jiao (with Michael Mehari co-authoring `openofdm_tx`). A driver file and its FPGA core usually share a name — `xpu.c` ↔ `xpu.v` — and every register the driver writes (`hw_def.h`) has a matching `slv_regN` in the core's `_s_axi.v`.

| Core | Role | Register bank size | Unit-test benches? |
|---|---|---|---|
| `xpu` | Real-time MAC (CSMA/CA, ACK, TSF, filtering, queue gating) | **64** AXI-Lite regs | yes (`fifo_sample_delay`, `mv_avg`) |
| `openofdm_tx` | 802.11 OFDM transmitter | 32 regs | yes (`test_vec/`) |
| `openofdm_rx` | 802.11 OFDM receiver | (submodule) | yes (`dot11_tb`) |
| `tx_intf` | DAC-side interface + TX BRAM + CSI fuzzer | 32 regs | no |
| `rx_intf` | ADC-side interface + RX DMA | 32 regs | yes (`adc_intf`) |
| `side_ch` | CSI / raw-IQ capture side channel | 32 regs | no |

---

## `xpu` — the real-time MAC

`xpu` (sometimes read as "transceiver/eXtensible processing unit") is the heart of openwifi and the largest core: its register file `xpu_s_axi.v` (48 KB, 64 registers) is the biggest single source file in the IP tree. It implements everything that has to happen in **microseconds** — too fast for the Linux MAC to handle — which is exactly why openwifi can meet 802.11 timing that a pure-software MAC cannot.

What lives inside (`ip/xpu/src/`, 21 Verilog files):

- **`csma_ca.v`** — the CSMA/CA (DCF) state machine proper. It consumes NAV/DIFS/EIFS enable flags, the contention-window exponent, SIFS/slot/DIFS/backoff timing parameters, MAC-address match, and TX-status feedback to arbitrate channel access exactly per the 802.11 distributed coordination function. This is the hardware DCF, offloaded from `mac80211`.
- **`tx_control.v`** — sequences packet transmission (the largest logic file at 30 KB).
- **`tsf_timer.v`** — the 64-bit TSF (Timing Synchronization Function) counter, the 802.11 clock that timestamps received packets and drives timing-critical MAC operations. Readable via `xpu` regs 58/59, loadable via regs 2/3.
- **`pkt_filter_ctl.v`** — packet address/type filtering (the FPGA side of `openwifi_configure_filter()`; monitor mode opens this fully).
- **`phy_rx_parse.v`** — parses PHY-header fields coming out of the receiver.
- **`rssi.v`, `iq_rssi_to_db.v`, `cca.v`, `dc_rm.v`, `mv_avg*.v`** — clear-channel-assessment / carrier sensing and RSSI measurement (moving-average power, DC removal).
- **`time_slice_gen.v`** — generates the gating for the four hardware TX queues (`slice_en[0:3]`), the mechanism behind [MAC-address time slicing](sdrctl-and-Runtime-Control.md#time-slicing-network-slicing).
- **`spi.v`** — an SPI master used to control the AD9361 TX chain in real time (turning the TX LO/switch on just before a packet and off just after — see [Architecture](Architecture.md#rf-and-baseband-the-frequencyclock-design)).
- **`cw_exp.v`, `tx_on_detection.v`, `edge_to_flip.v`, `fifo_sample_delay.v`, `n_sym_len14_pkt.v`** — contention-window exponent, TX-onset detection, and assorted timing/FIFO helpers.

`xpu` connects to *both* the RF/ADC path (`ddc_i/q`, `mute_adc_out_to_bb`) and the demodulator (`demod_is_ongoing`, `pkt_header_valid`, `fcs_ok`, `pkt_rate`, `pkt_len`), which is why it can implement hardware ACK generation and reception, retransmission, and CCA. It is addressed by the driver as register space `xpu` (category 6) and its git build revision is readable at register 63.

---

## `openofdm_tx` — the OFDM transmitter

Turns a MAC frame into baseband IQ samples. It reads bytes from a 64-bit-wide, 1024-deep TX BRAM (shared with `tx_intf` and `xpu`) and produces I/Q through the full 802.11 transmit chain: scrambling, convolutional encoding, puncturing/interleaving, modulation mapping, pilot and preamble insertion, and an IFFT.

Notable source (`ip/openofdm_tx/src/`, 28 files):

- **`dot11_tx.v`** — the 802.11 TX datapath FSM.
- **The IFFT pipeline** — `ifftmain.v`, `ifftstage.v`, `butterfly.v`, `hwbfly.v`, and partial-product multipliers (`bimpy.v`, `longbimpy.v`).
- **`convenc.v` + `punc_interlv_lut.v`** — convolutional encoder and the punctured-interleave lookup ROMs. `punc_interlv_lut.v` (128 KB) is the largest single file in the whole IP tree — it holds the FEC puncturing/interleaving patterns for every 802.11 MCS.
- **Preamble ROMs** — `l_stf_rom.v` / `l_ltf_rom.v` (legacy short/long training fields) and `ht_stf_rom.v` / `ht_ltf_rom.v` (802.11n HT training fields).
- **`modulation.v`, `crc32_tx.v`, `bitreverse.v`, `dpram.v`, `axi_fifo_bram.v`** — the modulation mapper, frame CRC, and buffering.

Addressed as register space `tx` (category 5); scrambler seeds are at regs 1/2 (default 127).

---

## `openofdm_rx` — the OFDM receiver

The receive counterpart: it detects the preamble, synchronizes, estimates the channel, equalizes, and Viterbi-decodes, handing parsed bytes (`byte_in`, `fcs_ok`, `pkt_rate`, `pkt_len`) up to `xpu` and `rx_intf`. It is the core that most affects **receiver sensitivity** (documented per band/board around −92 dBm at MCS0 / −73 dBm at MCS7 on FMCOMMS2 at 2.4 GHz).

Unlike the other five cores, `openofdm_rx` is a **git submodule** — it lives in the separate [openofdm](https://github.com/open-sdr/openofdm) repo (branch `dot11zynq`, or `dot11zynq_hls` for the HLS variant), and a fresh `openwifi-hw` clone has an empty `ip/openofdm_rx/` until you run `./get_ip_openofdm_rx.sh`. Its simulation entry point is the `dot11_tb` testbench (`dot11_inst → ofdm_decoder_inst → viterbi_inst`), which is also where you see the **Xilinx Viterbi decoder** — the IP whose evaluation license causes a running board's receiver to halt after ~2 hours (see [Troubleshooting](Troubleshooting.md#client-link-problems)).

Addressed as register space `rx` (category 4). Its `signal_watchdog` submodule powers the [openofdm_rx watchdog counters](Research-Features.md#fpga-event-counters), and the driver reads its build revision at register 31. See [FPGA Development → HLS](FPGA-Development.md#high-level-synthesis-hls-modules) for building the channel-estimation and equalizer stages from C++ via Vitis HLS.

---

## `tx_intf` — the transmit RF/DAC interface

Sits between the OFDM transmitter and the AD9361 DAC. It owns the 64-bit-wide, 1024-deep TX BRAM that `openofdm_tx` reads from, packages transmit I/Q for the DAC (via ADI's `axi_ad9361_dac_dma` / `util_ad9361_dac_upack` blocks), streams frame data in over AXI-Stream DMA from the driver, and raises the TX-done interrupt and LEDs (`tx_itrpt_led`, `tx_end_led`).

Two research-relevant pieces live here:

- **`csi_fuzzer.v`** — injects a controlled *artificial* channel response into the transmitter, the hardware behind the [CSI fuzzer](Research-Features.md#csi-fuzzer-privacy-protection) privacy feature (`tx_intf` register 5).
- **`ht_sig_crc_calc.v`** — computes the CRC for the 802.11n HT-SIG field.

Also here: `tx_bit_intf.v` (the raw-bit/PHY-level TX interface, the largest file in this core), `dac_intf.v`, `tx_iq_intf.v` (which holds the 512-sample arbitrary-IQ FIFO), and `tx_status_fifo.v`. Addressed as register space `tx_intf` (category 3); see the [tx_intf register table](sdrctl-and-Runtime-Control.md#tx_intf-fpga-tx-interface).

---

## `rx_intf` — the receive RF/ADC interface

The mirror of `tx_intf`. It unpacks raw ADC samples from the AD9361 (via ADI's `axi_ad9361_adc_dma` / `util_ad9361_adc_pack`), converts them into per-antenna I/Q streams, appends FCS/sequence-number bookkeeping onto received frames (`byte_to_word_fcs_sn_insert.v`), drives status LEDs (`fcs_ok_led`), and DMAs packets plus their metadata up to the processor.

The 16-byte metadata header that `rx_intf` prepends to each received packet is exactly what the driver's `openwifi_rx_interrupt()` parses: TSF timestamp, `rssi_half_db`, AGC status, length, rate index, and the FCS-OK bit. It also exposes 8 debug `trigger_out` signals and supports the FPGA-internal loopback path (`rx_intf` register 3 selects "IQ from `tx_intf`" instead of "IQ from the ADC") used by [self-loopback testing](Research-Features.md#self-loopback-testing). Addressed as register space `rx_intf` (category 2); source in `ip/rx_intf/src/` (11 files) with an `adc_intf` testbench.

---

## `side_ch` — the CSI / IQ capture side channel

openwifi's signature research core. `side_ch` taps into the receiver's I/Q datapath *and* the OFDM demodulator's internal results, buffers them, and streams them out over its own AXI-Stream DMA channel — completely independent of the normal packet RX/TX path. This is what lets you pull per-packet **CSI, equalizer output, frequency offset, raw IQ, AGC gain, and RSSI** up to a PC.

Its inputs (read directly from `side_ch.v` / `side_ch_control.v`) tell the story: TX-side taps (`openofdm_tx_iq0/iq1`, `tx_intf_iq0/iq1`), raw ADC-rate I/Q (`sample0_in`/`sample1_in`), demodulator status (`demod_is_ongoing`, `long/short_preamble_detected`, `ht_unsupport`, `pkt_rate`, `pkt_len`), and — critically — **`csi`/`csi_valid`** and **`equalizer`/`equalizer_valid`**, the per-subcarrier channel estimate and equalizer coefficients from the OFDM receiver. Everything is timestamped against the shared 64-bit TSF (so captures line up with packets) and tagged with RSSI.

`side_ch_control.v` (36 KB) is the capture/trigger FSM implementing the [30+ trigger conditions](Research-Features.md#trigger-conditions-register-8). A `MAX_NUM_DMA_SYMBOL` parameter sizes the internal FIFO — 8192 normally, halved to 4096 on small FPGAs via the `SIDE_CH_LESS_BRAM` macro, which is why Zynq-7020 boards cap capture length lower.

`side_ch` is the odd core out of the build in one way: it is **not** part of the main `sdr.ko` driver — it has its own kernel module `side_ch.ko` (built by `openwifi/driver/side_ch/make_driver.sh`) and its own user-space tool `side_ch_ctl`, because you load and unload it on demand rather than always running it. See [Research Features](Research-Features.md) for the full workflow and the `side_ch_ctl` command grammar.

---

## How a register write reaches a core

Tying it back to the control plane: when you run `sdrctl dev sdr0 set reg xpu 11 16`, the value travels an `nl80211` testmode message → `openwifi_testmode_cmd()` in the driver → the per-core driver API (`xpu_api->reg_write`) → an AXI-Lite write to `slv_reg11` in `xpu_s_axi.v`. The register *category* number is fixed across the whole stack: `rf`=1, `rx_intf`=2, `tx_intf`=3, `rx`=4, `tx`=5, `xpu`=6, and the driver-shadow spaces `drv_rx`=7, `drv_tx`=8, `drv_xpu`=9. The [sdrctl page](sdrctl-and-Runtime-Control.md) documents the registers themselves; this page is what they connect to.
