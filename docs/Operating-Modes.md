# Operating Modes

openwifi presents a normal Linux Wi-Fi interface (`sdr0`), so you drive it with the same tools you'd use for any card: `hostapd`, `wpa_supplicant`, `iw`, `iwconfig`. This page walks through each mode. Throughout, **"on board"** means commands run over ssh on the SDR board, and **"on PC"** means commands run on your computer.

Two reminders that apply to every mode:

- Mount the TX and RX antennas as close to perpendicular as you can — good TX/RX isolation matters.
- The **ADRV9361-Z7035 has very low 5 GHz TX power**; keep nodes close on that board.
- Any ssh session below can instead be a USB-UART serial console.

## Access Point

The `fosdem.sh` demo already does this — it runs `hostapd` with `hostapd-openwifi.conf` (SSID "openwifi"), a DHCP server, and a webserver. To do it by hand or understand the pieces:

```bash
cd openwifi
./fosdem.sh
# Confirm beacons are going out:
cat /proc/interrupts        # run a few times; "sdr,tx_itrpt1" count should keep growing
```

The growing TX-interrupt count is the AP transmitting its periodic beacon. Under the hood this is stock `hostapd` — edit `hostapd-openwifi.conf` to change SSID, channel, band, or security, then re-run.

## Client (station)

Connect openwifi to another AP (which can be a second openwifi board or any commercial AP):

```bash
service network-manager stop        # keep NetworkManager from fighting you
cd openwifi
./wgd.sh
ifconfig sdr0 up
iwlist sdr0 scan                    # the target SSID should appear
wpa_supplicant -i sdr0 -c wpa-openwifi.conf
```

Adjust the SSID/passphrase in the config file for your target network (`wpa-openwifi.conf` for an openwifi AP, or edit `wpa-connect.conf` for a different network). A successful association prints something like:

```
sdr0: SME: Trying to authenticate with 66:55:44:33:22:8c (SSID='openwifi' freq=5220 MHz)
sdr0: Associated with 66:55:44:33:22:8c
sdr0: CTRL-EVENT-CONNECTED - Connection to 66:55:44:33:22:8c completed
```

Then, in a **second** terminal (leave `wpa_supplicant` running in the first):

```bash
dhclient sdr0
ifconfig sdr0                       # you should now have a 192.168.13.x address from the AP
ping 192.168.13.1
```

If association never completes, adjust antenna orientation and distance and retry on the client side. When connecting to a commercial AP you'll also want `route del default gw 192.168.10.1` first so the board doesn't keep the Ethernet default route.

## Ad-hoc (IBSS)

Bring two boards into the same ad-hoc cell. On the first node:

```bash
service network-manager stop
cd openwifi
./wgd.sh
ifconfig sdr0 up
./sdr-ad-hoc-up.sh sdr0 44 192.168.13.1     # channel 44, static IP for sdr0
iwconfig sdr0
```

Look for a randomly generated Cell ID in the `iwconfig` output:

```
sdr0  IEEE 802.11  ESSID:"sdr-ad-hoc"
      Mode:Ad-Hoc  Frequency:5.22 GHz  Cell: 92:CA:14:27:1E:B0
```

If you see `Cell: Not-Associated`, wait and re-run `iwconfig sdr0` until the Cell ID appears. On the second node do the same with a different IP:

```bash
./sdr-ad-hoc-up.sh sdr0 44 192.168.13.2
iwconfig sdr0
```

The second node should discover and **join the same Cell ID** automatically. Once both show the same cell, they can ping each other. (`sdr-ad-hoc-join.sh` is the companion helper.) If the cells don't match, adjust antennas/distance and retry.

## Monitor mode

Monitor mode puts the receiver into "capture everything" — including control frames and frames with bad CRC — and is the prerequisite for packet injection and for most research captures.

```bash
cd openwifi
./wgd.sh
./monitor_ch.sh sdr0 11             # monitor on channel 11 (pick a channel you care about)
```

You can now run `tcpdump -i sdr0` or add a dedicated virtual monitor interface:

```bash
iw dev sdr0 interface add mon0 type monitor && ifconfig mon0 up
```

## Packet injection and fuzzing

Because the whole PHY is open, openwifi is a strong platform for physical-layer testing and fuzzing — you can craft frames and control FPGA behavior directly, rather than measuring through many stack layers as `ping`/`iperf` force you to. openwifi ships an `inject_80211` tool (adapted from *packetspammer*).

**Build it on the board:**

```bash
cd openwifi/inject_80211
make
```

**Inject some frames** (in monitor mode):

```bash
cd openwifi
./wgd.sh
./monitor_ch.sh sdr0 11
./inject_80211/inject_80211 -m n -r 0 -n 10 -s 64 sdr0
# 10 × 802.11n packets, MCS0 (6.5 Mbps), 64-byte payload, out of sdr0
```

Watch them arrive on any other device sniffing channel 11.

**`inject_80211` options:**

| Flag | Meaning |
|---|---|
| `-m` | PHY mode: `a`, `g`, or `n` |
| `-r` | Rate / MCS index (0–7) |
| `-t` | Packet type: `m`/`c`/`d`/`r` = management/control/data/reserved |
| `-e` | Subtype (hex). E.g. with `-t m`: 8=Beacon, A=Disassoc, B=Auth, C=Deauth. With `-t c`: A/B/C/D = PS-Poll/RTS/CTS/ACK. With `-t d`: 0/1/2/8 = Data/Data+CF-Ack/Data+CF-Poll/QoS-Data |
| `-a` / `-b` | Last byte of addr1 / addr2 (hex) |
| `-i` | Short-GI flag (0/1) |
| `-n` | Number of packets |
| `-s` | Payload size (bytes) |
| `-d` | Inter-packet delay (µs) |

To customize full frame contents, edit the `ieee_hdr_*` byte arrays in `inject_80211.c` (note the byte/bit ordering isn't always intuitive versus the standard).

**Controlling ACK behavior for injection.** Even in monitor mode, the FPGA will still auto-transmit an ACK when it receives a matching data frame. To stop that (usually what you want when injecting/fuzzing), disable hardware ACK TX:

```bash
sdrctl dev sdr0 set reg xpu 11 16
```

You can likewise force ACK *expectation* and retransmission count from the driver (`pkt_need_ack`, `retry_limit_raw` in `openwifi_tx()` of `sdr.c`). See [sdrctl](sdrctl-and-Runtime-Control.md#retransmission-and-ack-control-xpu-register-11) for the register-level controls.

**Link performance testing.** Inject a sweep of rates and payload sizes, capture with `tcpdump`, and post-process with the provided `analyze_80211` tool:

```bash
# receiver side
iw dev sdr0 interface add mon0 type monitor && ifconfig mon0 up
tcpdump -i mon0 -w trace.pcap 'wlan addr1 ff:ff:ff:ff:ff:ff and wlan addr2 66:55:44:33:22:11'
# later:
analyze_80211 trace.pcap
```

(The addresses `ff:ff:ff:ff:ff:ff` / `66:55:44:33:22:11` are the injector's defaults.) There's also `owfuzz`, a third-party 802.11 protocol fuzzer built on openwifi, if you want a ready-made fuzzing framework.

## About 802.11b

openwifi is **OFDM-only** and therefore not backward-compatible with 802.11b. This matters at connection setup, since 2.4 GHz devices often fall back to 11b rates for beacons and management frames. The fix is to suppress 11b rates on both ends:

- **On the openwifi AP:** the provided `hostapd-openwifi.conf` already suppresses 11b rates (`supported_rates` / `basic_rates`).
- **On a commercial client:** stock `wpa_supplicant` can't suppress 11b rates in 2.4 GHz out of the box. Build the patched version openwifi provides:

  ```bash
  sudo apt-get install libssl1.0-dev
  cd openwifi/user_space
  ./build_wpa_supplicant_wo11b.sh
  ```

Using 5 GHz channels sidesteps the whole issue, which is why the default demo uses channel 44.
