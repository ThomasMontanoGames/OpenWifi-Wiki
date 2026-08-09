# sdrctl and Runtime Control

`sdrctl` is openwifi's own command-line tool for the things standard Linux Wi-Fi tools can't reach: FPGA registers, arbitrary TX/RX frequencies, TX attenuation, and MAC-address-based time slicing. It's implemented as an `nl80211` testmode command and reaches the driver (`openwifi_testmode_cmd()` in `sdrctl_intf.c`) through the normal `nl80211 → cfg80211 → mac80211` path.

All commands run **on the board**, from the `openwifi` directory.

## Command forms

**Parameters** (high-level settings like time slices):

```bash
sdrctl dev sdr0 get <para_name>
sdrctl dev sdr0 set <para_name> <value>
```

**Registers** (direct access to a driver or FPGA module):

```bash
sdrctl dev sdr0 get reg <module_name> <reg_idx>
sdrctl dev sdr0 set reg <module_name> <reg_idx> <value>
```

!!! warning "Linux may overwrite registers you set by hand"
    Some registers are written by the driver in real time under mac80211's direction. If you set those by hand, Linux may overwrite them (or your value may destabilize things). When a table says "auto set by …," treat manual writes as experiment-only.

## Module names

| `module_name` | What it controls | Defined in |
|---|---|---|
| `drv_rx`, `drv_tx`, `drv_xpu` | Driver-side behavior for RX / TX / low-MAC | `sdr.c` (`drv_*_reg_val`) |
| `rf` | AD9361 RF front end (the driver forwards these to the AD9361 rather than to an FPGA core) | `sdr.h` (`rf_reg_val`) |
| `rx_intf`, `tx_intf` | FPGA RX / TX interface modules | `hw_def.h` ↔ `rx_intf.v` / `tx_intf.v` |
| `rx`, `tx` | FPGA OFDM receiver / transmitter (`openofdm_rx` / `openofdm_tx`) | `hw_def.h` ↔ `openofdm_rx.v` / `openofdm_tx.v` |
| `xpu` | FPGA low MAC (CSMA/CA, timers, ACK, filtering, slicing) | `hw_def.h` ↔ `xpu.v` |

The convention throughout: FPGA register *N* for module `foo` is `slv_regN` in `foo.v`. When a table here is too terse, open that `.v` file (or the matching `.c`) and search for `slv_regN`.

---

## Common runtime tasks (the "frequent tricks")

These are the day-to-day knobs, most with a convenience script in `user_space/` and the underlying `sdrctl` command shown where useful.

### TX power / attenuation

```bash
./sdrctl dev sdr0 set reg rf 0 20000     # 20 dB attenuation (unit: dB×1000). Default 0 dB.
```

For an initial attenuation at driver-load time, load with `insmod sdr.ko init_tx_att=20000` (you can edit the `insmod` line at the end of `wgd.sh`). To *increase* TX power beyond default you can raise `tx_intf` register 13 (digital IQ gain), though too much hurts EVM and long-packet quality, or add an external PA.

!!! warning "Do not connect two boards by cable during setup"
    AD9361 tuning can emit strong TX that damages the other board's RX. Bring both sides up first, apply attenuation, then connect the cable.

### TX rate / MCS override

By default Linux's `minstrel_ht` picks the rate. To pin it:

```bash
./sdrctl dev sdr0 set reg drv_tx 0 N   # non-HT: 0=auto, 4..11 = 6,9,12,18,24,36,48,54 Mbps
./sdrctl dev sdr0 set reg drv_tx 1 N   # HT:     0=auto, 4..11 = 6.5,13,19.5,26,39,52,58.5,65 Mbps
```

For HT short-GI, add 16 to `N`.

### RX gain

Normally the AD9361 AGC handles this. For experiments:

```bash
./set_rx_gain_manual.sh 30    # switch to manual, set 30 dB
./set_rx_gain_auto.sh         # back to AGC
```

To choose a good manual value, run under AGC, enable stats (`./stat_enable.sh`), read the actual AGC gain of received packets (`./rx_gain_show.sh`), then subtract the band offset: **−14 dB** at 5220 MHz, **−5 dB** in 2.4 GHz. (For example: observed AGC gain 34 → set `20` at 5 GHz, or `29` at 2.4 GHz.)

### Antenna selection

```bash
./sdrctl dev sdr0 set reg drv_tx 4 1    # TX antenna: 0=ant0 (default), 1=ant1
./sdrctl dev sdr0 set reg drv_rx 4 1    # RX antenna: 0=ant0 (default), 1=ant1
```

### CCA / LBT (listen-before-talk) threshold

The driver auto-sets a per-channel threshold. To inspect and override:

```bash
./set_lbt_th.sh          # show current threshold (see dmesg)
./set_lbt_th.sh 70       # fixed −70 dBm threshold (disables driver auto-setting)
./set_lbt_th.sh 0        # restore driver auto control
./set_lbt_th.sh 1        # effectively disable CCA (−1 dBm ⇒ channel always "idle")
```

### Receiver sensitivity ("action threshold")

Sometimes *too* sensitive is bad, because the receiver chases weak background packets instead of your target. Ignore signals below a threshold:

```bash
./sdrctl dev sdr0 set reg drv_rx 0 70   # ignore anything weaker than −70 dBm
```

### CSMA/CA internals: NAV, DIFS, EIFS, CW

Convenience scripts read state with no argument, disable with `1`, enable with `0`:

```bash
./nav_disable.sh 1     # pretend NAV has always counted down to 0
./difs_disable.sh 1    # skip DIFS waiting
./eifs_disable.sh 1    # skip EIFS waiting
./cw_disable.sh 1      # fix contention window to 0 (no random backoff)
```

Two finer-grained EIFS variants exist as well: `eifs_by_last_rx_fail_disable.sh` and `eifs_by_last_tx_fail_disable.sh` disable only the EIFS triggered by the last failed reception or the last failed transmission, with the same read/`1`/`0` convention. All of these scripts write the driver's `csma_cfg0` sysfs file, which when read prints the full NAV/DIFS/EIFS/CW override state in one line.

Contention-window min/max per queue:

```bash
./cw_max_min_cfg.sh                 # show current (set by Linux at NIC bring-up)
./cw_max_min_cfg.sh b5654332        # override q3..q0 as a hex string (log2 of CW)
./cw_max_min_cfg.sh 0               # hand control back to Linux (see note below)
```

The hex nibbles encode log2 values: `b5` for q3 means CWmax=2¹¹−1=2047, CWmin=2⁵−1=31. Caveat: giving `0` doesn't re-apply Linux's values automatically (Linux only sets them once at bring-up), so either record and restore them yourself, or reload the NIC.

### Retransmission and ACK control (xpu register 11)

Change only the bits you mean to, because other bits of this register have other jobs.

```bash
./sdrctl dev sdr0 get reg xpu 11        # read first
./sdrctl dev sdr0 set reg xpu 11 9      # bit3=1 + bits2-0=001 ⇒ max 1 retransmission
./sdrctl dev sdr0 set reg xpu 11 16     # bit4=1 ⇒ disable auto ACK TX (after RX)
./sdrctl dev sdr0 set reg xpu 11 32     # bit5=1 ⇒ don't expect ACK RX (after TX)
./sdrctl dev sdr0 set reg xpu 11 48     # disable both ACK TX and RX
./sdrctl dev sdr0 set reg xpu 11 25     # 11001: keep the retx setting AND disable ACK TX
```

The cleanest place to cap retransmissions is the driver, via `retry_limit_raw` (from which `retry_limit_hw_value` is derived) in `openwifi_tx()`.

### TX LO / RF-port control

The FPGA switches the TX LO/port on only during transmit. To force the LO always on (needed for some self-TX capture experiments):

```bash
./sdrctl dev sdr0 set reg xpu 13 1
```

`./set_tx_lo.sh` and `./set_tx_port.sh` show/set these (arg `1`=on, `0`=off).

### Frequency: restrict and arbitrary tuning

Because AD9361 retuning can emit unwanted TX (and disrupt cable tests / background scans), you can pin the frequency:

```bash
./set_restrict_freq.sh 5220     # lock to 5220 MHz, ignore other tuning requests
./set_restrict_freq.sh 0        # remove the lock
```

To run at a **non-standard frequency** (anywhere 70 MHz–6 GHz): first bring the system up normally on the nearest legal Wi-Fi channel, lock it with `set_restrict_freq.sh` so the upper layers stop scanning, then override the actual RF frequency:

```bash
./sdrctl dev sdr0 set reg rf 1 3500    # TX frequency → 3.5 GHz
./sdrctl dev sdr0 set reg rf 5 3500    # RX frequency → 3.5 GHz
```

### Arbitrary TX IQ samples

You can push up to 512 raw IQ samples into `tx_intf` and transmit them for test purposes. This uses `tx_intf` register 7 (mode/trigger) and register 1 (the IQ write port), driven by the helper scripts `tx_intf_iq_data_to_sysfs.sh` and `tx_intf_iq_send.sh`. See the arbitrary-IQ section of the [frequent tricks note](https://github.com/open-sdr/openwifi/blob/master/doc/app_notes/frequent_trick.md) for the full sequence.

---

## Time slicing (network slicing)

openwifi can gate each of its four TX queues to a fraction of a repeating time cycle, keyed by destination MAC address, which is useful for TDMA-style scheduling and TSN experiments. Configure a slice via parameters:

| `para_name` | Meaning |
|---|---|
| `slice_idx` | Which slice (0–3) subsequent commands configure. **Set to 4 when done to synchronize all slices**, otherwise slice start/end times won't line up. |
| `addr` | Target MAC for this slice (last 32 bits, for example `b94cb1c1` for `6c:fd:b9:4c:b1:c1`) |
| `slice_total` | Cycle length in µs (for example `49999` for 50 ms) |
| `slice_start` | Slice start time in µs (for example `10000` for 10 ms) |
| `slice_end` | Slice end time in µs (for example `39999` for 40 ms) |
| `tsf` | Set the TSF timer (needs two decimal values: high then low) |

The imec [w-iLab.t tutorial](https://doc.ilabt.imec.be/ilabt/wilab/tutorials/openwifi.html#sdr-tx-time-slicing) has a fuller walkthrough.

---

## Register reference

The tables below list the commonly used registers. For the full set, read the module's `.c` and `.v` files. Values are decimal unless noted. Where a comment lists `decimal(0xhex):explanation`, use the decimal in the command.

### `drv_rx` (driver RX)

| reg | Meaning |
|---|---|
| 0 | Receiver action threshold. Ignore signals weaker than this. `N` means −N dBm. |
| 4 | RX antenna selection: 0=ant0 (default), 1=ant1 |
| 7 | dmesg print control (see [Troubleshooting](Troubleshooting.md#driver-dmesg-logging)) |

### `drv_tx` (driver TX)

| reg | Meaning |
|---|---|
| 0 | Override non-HT unicast data rate: 0=auto, 4..11 = 6,9,12,18,24,36,48,54 Mbps |
| 1 | Override HT unicast data rate: 0=auto, 4..11 = 6.5,13,19.5,26,39,52,58.5,65 Mbps (+16 for short GI) |
| 2 | Override VHT (11ac) rate (not implemented) |
| 3 | Override HE (11ax) rate (not implemented) |
| 4 | TX antenna selection: 0=ant0 (default), 1=ant1 |
| 7 | dmesg print control |

### `drv_xpu` (driver low-MAC)

| reg | Meaning |
|---|---|
| 0 | LBT/CCA threshold: 0=auto (via `ad9361_rf_set_channel()`), else `N` means −N dBm fixed |
| 7 | Git revision of the driver build (hex) |

### `rf` (AD9361 front end)

| reg | Meaning |
|---|---|
| 0 | TX attenuation, dB×1000 (for example 3000 = 3 dB) |
| 1 | TX frequency in MHz (overrides Linux tuning) |
| 5 | RX frequency in MHz (overrides Linux tuning) |

### `rx_intf` (FPGA RX interface)

| reg | Meaning |
|---|---|
| 0 | Reset (per-bit to sub-modules, 1=reset, 0=normal) |
| 2 | Enable/disable RX interrupt: 256=disable, 0=enable |
| 3 | Loopback IQ source: 256=from `tx_intf`, 0=from AD9361 ADC |
| 6 | Abnormal packet-length threshold (bits 31-16). DMA terminates if length outside 14..threshold |
| 11 | RX digital IQ gain (left-shift count, default 4) |
| 13 | Delay from RX DMA complete to RX interrupt (unit 0.1 µs) |
| 16 | RX antenna selection: 0=ant0 (default), 1=ant1 |

(Registers 5,7,9,10,12 are DMA-to-CPU controls, see `rx_intf.v`.)

### `tx_intf` (FPGA TX interface)

| reg | Meaning |
|---|---|
| 0 | Reset (per-bit) |
| 1 | Arbitrary-IQ write port (write IQ samples for test TX) |
| 4 | CTS-to-Self config (auto-set by driver): bit31 enable, bit30 rate-select, bits23-8 duration |
| 5 | CSI-fuzzer config (see [Research Features](Research-Features.md#csi-fuzzer-privacy-protection)) |
| 6 | CTS-to-Self send delay for SIFS (0.1 µs, bits13-0 for 2.4 GHz, bits29-16 for 5 GHz) |
| 7 | Arbitrary-IQ mode/trigger (bit0 mode, bit1 trigger) |
| 11 | "Almost full" FIFO threshold (driver reads the 4-bit flag from reg 21) |
| 13 | TX digital IQ gain before DAC (raise for more TX power, hurts EVM if too high) |
| 16 | TX antenna + CDD: bit1 selects ant0/ant1, bit4 enables simple CDD (1-sample delay across two antennas) |
| 21 | Per-queue "almost full" flags (4 bits) |
| 22–25 | Per-packet TX status read back by the TX interrupt (CW, retrans count, block-ACK bitmap, etc.) |
| 26 | Runtime TX-queue lengths: bits 6-0 q0, 14-8 q1, 22-16 q2, 30-24 q3 |

(Registers 8,15,17 are per-packet configs set automatically by the driver.)

### `rx` (openofdm_rx)

| reg | Meaning |
|---|---|
| 0 | Reset (per-bit) |
| 1 | Misc: smoothing, sync-short sensitivity, watchdog gating, EQ monitor (see `openofdm_rx.v`) |
| 2 | Power-trigger & DC-detection thresholds (bits10-0 power in rssi_half_db, bits23-16 DC) |
| 3 | Minimum plateau for short-preamble detection |
| 4 | Soft-decoding flag (bit0) + abnormal-length thresholds |
| 5 | FFT window shift (bits3-0, default 4) + small-EQ monitor threshold |
| 17 | Selects which watchdog event reg 30 counts (0=phase offset too big, 1=too many small EQ out, 2=DC detected, 3=pkt too short, 4=pkt too long) |
| 18 | sync_short phase-offset (freq-offset) watchdog threshold |
| 19 | phase-offset override (bit31 enable, bits15-0 signed value) |
| 20 | PHY RX state history (read-only). **If the last digit is always 3, the Viterbi decoder has halted** |
| 21 | Read back Fc (MHz, bits31-16) and phase_offset (bits15-0) |
| 30 | Read the selected watchdog counter. Writing clears it |
| 31 | Git revision of the receiver build (hex) |

### `tx` (openofdm_tx)

| reg | Meaning |
|---|---|
| 0 | Reset (per-bit) |
| 1 | Pilot scrambler initial state (low 7 bits, default 127) |
| 2 | Data scrambler initial state (low 7 bits, default 127) |

### `xpu` (low MAC)

| reg | Meaning |
|---|---|
| 0 | Reset (per-bit) |
| 1 | RX/self-IQ config on TX. bit0: 0=auto self-RX-mute on TX, 1=manual (bit31: 1 mute / 0 unmute). bit2: 1=send all RX to Linux (no filtering). **Set `xpu 1 1` to unmute self-RX for loopback/CSI-radar.** |
| 2 / 3 | TSF timer low 32 / high 31 bits. Reload triggers on the falling edge of reg 3 bit31 (write 1 then 0). |
| 4 | Band / channel / ERP short-slot (CSMA config, auto-set by Linux, channel = frequency in MHz) |
| 5 | DIFS/backoff advance (µs) for TX prep, bits31-16 abnormal-length threshold |
| 6 | Multi-purpose CSMA: bits7-0 forced idle after decode (µs), bit31 NAV disable, bit30 DIFS disable, bit29 EIFS disable, bit28 dynamic-CW disable |
| 7 | RSSI report offset (bits26-16) + AD9361 gpio/gain sync delay (bits6-0) |
| 8 | RSSI threshold for CCA (rssi_half_db, auto-set). `xpu 8 <big>` disables CCA. |
| 9 | Low-MAC timing (bit31 manual): PHY RX delay, SIFS, slot time, OFDM symbol time, preamble+SIG time (µs) |
| 10 | BB↔RF delay tuning (0.1 µs): BB-RF delay, RF end extension, BB-TX-start→RF-on, BB-TX-end→RF-off |
| 11 | ACK control & max retransmission (see [above](#retransmission-and-ack-control-xpu-register-11)) |
| 12 | AMPDU control: bit0 start receiving AMPDU, bits4-1 tid, bit31 tid-enable |
| 13 | SPI controller: 1=disable SPI control (TX RF always on), 0=normal (RF on only during TX) |
| 16 / 17 | Wait-for-ACK timing in 2.4 GHz / 5 GHz (0.1 µs): decode timeout, PHY-header detect timeout, FCS-required bit |
| 18 | ACK send delay (0.1 µs): bits14-0 for 2.4 GHz, bits30-16 for 5 GHz |
| 19 | Per-queue CW min/max (4 bits each for q0..q3, auto-set by `openwifi_conf_tx()`) |
| 20 / 21 / 22 | Slice (queue-TX-gate) total cycle / start / end time (bits21-20 select queue, bits19-0 µs) |
| 26 | CTS-to-RTS setting (extra duration, rate/MCS, enable bit) |
| 27 | FPGA packet-filter config (passing bits13-0, dropping bits24-16, see `openwifi_configure_filter()`) |
| 28 / 29 | BSSID filter low 32 / high 16 bits (auto-set) |
| 30 / 31 | Self MAC address low 32 / high 16 bits (auto-set) |
| 57 | rssi_half_db read-back with channel idle/CSMA state (pair with `rssi_openwifi_show.sh` / `rssi_ad9361_show.sh`) |
| 58 / 59 | TSF runtime value low / high (read-only) |
| 62 | addr2 of the last RX packet, read back (bits31-0 from addr2 bits47-16) |
| 63 | Git revision of the FPGA build (hex) |

---

## Statistics via sysfs

Beyond registers, the driver exposes rich per-packet counters through sysfs, wrapped by scripts. Enable, read, clear:

```bash
./stat_enable.sh                 # turn on driver statistics
./tx_stat_show.sh                # TX success/fail/retx counts and realtime MCS
./tx_prio_queue_show.sh          # per Linux-priority / FPGA-queue accounting
./rx_stat_show.sh                # RX data/mgmt/ACK totals and failures
./rx_stat_show.sh 30000          # also compute PER, given 30000 packets sent by the peer
./rx_gain_show.sh                # actual AGC gain per received packet
./tx_stat_show.sh clear          # reset a counter set
./set_rx_target_sender_mac_addr.sh c83caf93   # filter stats to one peer (00:80:c8:3c:af:93)
./set_rx_monitor_all.sh          # include ACK packets in stats
./stat_enable.sh 0               # turn statistics off
```

The counter names match variable names in `sdr.c`, so grepping the source tells you the precise meaning. There are also FPGA-level event counters exposed through the side channel, see [Research Features](Research-Features.md#fpga-event-counters).
