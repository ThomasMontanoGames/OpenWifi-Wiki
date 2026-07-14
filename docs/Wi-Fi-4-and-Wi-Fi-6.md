# Wi-Fi 4 and Wi-Fi 6 Features

The open-source openwifi release implements 802.11a/g plus a **single-stream, 20 MHz subset of 802.11n (Wi-Fi 4)**. Wi-Fi 5 (802.11ac) is skipped entirely, and Wi-Fi 6 (802.11ax) exists only as a commercial offering. This page explains what that means in practice: which Wi-Fi 4 features you actually get, how to switch them on and check that they're working, and where Wi-Fi 6 stands if you need it.

The [Architecture page](Architecture.md#what-openwifi-implements-of-80211agn) covers the same feature set from the design side (with the throughput derivation and diagrams). This page is the usage side. If Wi-Fi itself is new to you, start with the primer below. If you know 802.11, skip straight to [the timeline](#where-openwifi-sits-in-the-wi-fi-timeline).

## A short 802.11 primer

This section is for people who know RF and digital modulation but haven't worked with Wi-Fi as a standard. It's the minimum background the rest of the page assumes. Individual terms are in the [Glossary](Glossary.md).

**The standard and its names.** Wi-Fi is IEEE 802.11 plus a series of amendments named with letters (a, b, g, n, ac, ax). Each amendment layers new capabilities on the existing ones, and devices stay backward compatible with older peers on the same channel. The "Wi-Fi 4/5/6" generation numbers are marketing labels the Wi-Fi Alliance introduced in 2018: 802.11n is Wi-Fi 4, 802.11ac is Wi-Fi 5, 802.11ax is Wi-Fi 6. Nothing was ever officially called Wi-Fi 1 through 3. Channels live in the 2.4 GHz and 5 GHz bands (Wi-Fi 6E later added 6 GHz).

**The PHY, in RF terms.** A standard channel is 20 MHz wide and carries OFDM with a 64-point FFT, so subcarriers sit 312.5 kHz apart. Legacy 802.11a/g fills 48 subcarriers with data and 4 with pilots. Each OFDM symbol lasts 4 µs: 3.2 µs of useful symbol plus a 0.8 µs guard interval, a cyclic prefix that absorbs multipath delay spread.[^std] Subcarriers carry BPSK up to 64-QAM, protected by a rate 1/2 convolutional code that puncturing thins out to rates 2/3, 3/4, and 5/6. The fraction is the share of transmitted bits that carry information, so 5/6 means the least redundancy, and the receiver decodes it all with a Viterbi decoder (in openwifi, a Xilinx IP core). Each modulation-plus-code-rate combination has an index called the MCS. Unlike a fixed link, the transmitter re-picks the rate frame by frame based on what's getting through. On openwifi that's Linux's `minstrel_ht` rate-control algorithm, and you can pin it manually when you need repeatability.

**One shared channel, half duplex, no scheduler.** Every station transmits and receives on the same frequency and never both at once. Access is contention based (CSMA/CA): listen until the channel is idle, wait a random backoff, transmit, then wait for the receiver's acknowledgement. The ACK must start within a fixed short gap (SIFS, 10 or 16 µs depending on band), which is exactly the kind of deadline a software MAC can't meet and why openwifi runs this logic in the FPGA. The practical consequence for this page: every frame pays a fixed cost of preamble, backoff, and ACK, so real throughput lands well below the PHY rate, and features that spread that cost over more data (aggregation) often buy more than a faster PHY rate does.

**From OFDM to OFDMA.** Everything up to and including Wi-Fi 5 uses OFDM as a single-user scheme: whoever wins contention gets every subcarrier in the channel for the duration of the frame, so stations share the medium in time only. OFDMA, introduced by Wi-Fi 6, shares it in frequency as well. The subcarriers of one channel are grouped into **resource units (RUs)**, and the access point assigns RUs to different stations within the same transmission. In a 20 MHz channel an RU spans 26, 52, 106, or 242 tones, which allows anything from one full-channel user down to nine users in parallel, each on a slice about 2 MHz wide.[^std] Downlink OFDMA is one long frame carrying data for several receivers at once. Uplink OFDMA is the demanding direction: the AP invites specific stations with a trigger frame, and their transmissions must arrive at the AP aligned, so every station has to pre-correct its timing and carrier frequency tightly enough to stay orthogonal with its neighbors in the same FFT. The goal is not peak speed. A short packet no longer pays a full contention cycle for a 20 MHz channel it barely fills, which turns a crowded channel from a lottery into something schedulable.

**Features are negotiated, not just implemented.** Stations advertise what they support in capability fields inside management frames (beacons, probe responses, association frames). A feature is only used on a link when *both* ends advertise it. Keep this in mind throughout the Wi-Fi 4 section: some things exist in openwifi's FPGA but sit idle until you tell the driver to advertise them, short guard interval being the main example.

## Where openwifi sits in the Wi-Fi timeline

| Generation | Standard | Status in openwifi (open source) |
|---|---|---|
| pre-Wi-Fi 4 | 802.11a / 802.11g | Supported (legacy OFDM, 6–54 Mbps)[^readme] |
| pre-Wi-Fi 4 | 802.11b | Not supported. openwifi is OFDM-only, see [About 802.11b](Operating-Modes.md#about-80211b) |
| Wi-Fi 4 | 802.11n | Supported: single spatial stream, 20 MHz, MCS 0–7 (this page)[^readme] |
| Wi-Fi 5 | 802.11ac | Not implemented (see below) |
| Wi-Fi 6 | 802.11ax | Commercial only, via [openwifi.tech](https://openwifi.tech)[^readme] |

!!! note "Non-Wi-Fi bandwidth variants"
    openwifi can also run 2 MHz channels for 802.11ah-style sub-GHz work and 10 MHz for 802.11p vehicular. Those are bandwidth/frequency reconfigurations of the same 802.11a/g/n design, not extra standards. See [sdrctl → frequency tuning](sdrctl-and-Runtime-Control.md#frequency-restrict-and-arbitrary-tuning).

### Why there's no Wi-Fi 5

Skipping a whole generation looks odd until you check where Wi-Fi 5's speed actually comes from: 80 and 160 MHz channels, up to eight spatial streams, and MU-MIMO, all in the 5 GHz band only. A 20 MHz single-stream design can use none of that. The only 11ac feature that would apply is 256-QAM, worth roughly 87 Mbps at 20 MHz single-stream versus 72 Mbps for 11n.[^std]

Wi-Fi 6 is a different story. It reworks the OFDM numerology and adds OFDMA, which subdivides a single 20 MHz channel between users. Those features matter even at 20 MHz with a single stream. Between the two generations, Wi-Fi 6 is the one with something to offer this hardware, so 11n to 11ax skips almost nothing openwifi could have used.

## Wi-Fi 4 (802.11n) in the open-source release

802.11n's formal name for its feature set is **HT, high throughput**, and that's the label you'll meet in practice: driver logs mark 802.11n frames `ht1` and legacy 11a/g frames `ht0`, tools take `-m n` or "HT" flags, and capability fields are called "HT capabilities". The amendment added five PHY improvements and frame aggregation at the MAC. Here is each one with its openwifi status and the knob that controls it:

| 802.11n feature | What it does | In openwifi? | How you control it |
|---|---|---|---|
| 52 data subcarriers (up from 48) | ~8% more throughput per symbol | ✅ yes | Automatic for every HT frame |
| 5/6 convolutional coding | Higher top code rate (was 3/4) | ✅ yes | Automatic at MCS 7 |
| 400 ns short guard interval | ~11% shorter symbols | ✅ yes, **not advertised by default** | `test_mode` bit 1, rate override `+16`, or `inject_80211 -i 1` (details below) |
| A-MPDU frame aggregation | Amortizes contention and preamble overhead over many frames | ⚠️ experimental | `./wgd.sh 1` (details below) |
| A-MSDU frame aggregation | The other aggregation flavor | ❌ no | – |
| MIMO (up to 4 streams) | Multiplies throughput by the stream count | ❌ no | – |
| 40 MHz bandwidth | Doubles the channel | ❌ no | – |

With everything supported switched on, the theoretical PHY ceiling is **72.2 Mbps** (MCS 7 with short GI). The step-by-step derivation is on the [Architecture page](Architecture.md#what-openwifi-implements-of-80211agn), and the measured best case is 40–50 Mbps TCP / ~50 Mbps UDP with aggregation on.[^readme]

### The HT rate table

openwifi supports all eight single-stream MCS indices at 20 MHz:[^std]

| MCS | Modulation | Code rate | Rate (800 ns GI) | Rate (400 ns short GI) |
|---|---|---|---|---|
| 0 | BPSK | 1/2 | 6.5 Mbps | 7.2 Mbps |
| 1 | QPSK | 1/2 | 13 Mbps | 14.4 Mbps |
| 2 | QPSK | 3/4 | 19.5 Mbps | 21.7 Mbps |
| 3 | 16-QAM | 1/2 | 26 Mbps | 28.9 Mbps |
| 4 | 16-QAM | 3/4 | 39 Mbps | 43.3 Mbps |
| 5 | 64-QAM | 2/3 | 52 Mbps | 57.8 Mbps |
| 6 | 64-QAM | 3/4 | 58.5 Mbps | 65 Mbps |
| 7 | 64-QAM | 5/6 | 65 Mbps | 72.2 Mbps |

Each step up the table packs more bits per subcarrier or trims coding redundancy, so it needs more SNR. You can see the cost directly in openwifi's published sensitivity figures: −92 dBm at MCS 0 versus −73 dBm at MCS 7 (see [Specifications](Specifications.md#measured-performance)).

By default Linux's `minstrel_ht` rate control walks this table automatically based on link quality. You only need to intervene for experiments (see [forcing an MCS](#forcing-an-mcs-by-hand)).

### Turning on A-MPDU aggregation

Aggregation is the single biggest practical win. At tens of Mbps the fixed per-frame cost (preamble, SIFS, ACK, backoff) starts to dominate, and A-MPDU packs many MPDUs into one transmission so that cost is paid once. Acknowledgement is amortized the same way: the receiver answers the whole aggregate with a single block ACK that flags any subframes needing retransmission, instead of one ACK per frame.[^std] openwifi's headline iperf numbers were measured with aggregation on.[^readme]

It's off by default. Enable it when loading the driver:

```bash
cd openwifi
./wgd.sh 1        # test_mode=1, bit 0 = A-MPDU aggregation
```

The `1` becomes the `test_mode` module parameter of `sdr.ko`. With bit 0 set, the driver advertises A-MPDU support in its HT capabilities (aggregates up to 8 kB, 2 µs minimum MPDU spacing) and handles mac80211's aggregation callbacks.[^sdrc] Both ends of the link negotiate the rest through the normal 802.11 block-ack setup.

!!! warning "Experimental"
    Aggregation is documented as experimental.[^docreadme] It's the right first thing to try for throughput, and the right first thing to turn off if you're chasing odd instability.

### Short guard interval

The guard interval is the cyclic prefix between OFDM symbols. It exists to absorb multipath: as long as all significant echoes arrive within the GI, they cause no inter-symbol interference. 802.11n's short GI halves it from 800 to 400 ns, trading multipath margin for about 11% more throughput.[^std] That trade is usually safe on short, clean links (a lab bench, a cabled setup) and riskier in reflective environments.

openwifi's PHY handles 400 ns short-GI frames in both directions, and short GI is what lifts MCS 7 from 65 to 72.2 Mbps. But there's a subtlety in the driver: it only *advertises* short-GI support to peers when `test_mode` **bit 1** is set. The code comment says short GI "seems to bring unnecessary stability issue", so by default a negotiated link runs with the normal 800 ns GI and tops out at 65 Mbps.[^sdrc]

```bash
./wgd.sh 2        # advertise short GI only
./wgd.sh 3        # bits 0+1: aggregation AND short GI
```

Note that the written documentation only describes bit 0. Bit 1 comes straight from the driver source (`test_mode&2` in `sdr.c`), so treat it as a code-level switch that may move.[^sdrc]

You can also use short GI without any capability negotiation:

- **Pin the TX rate with short GI:** add 16 to the HT rate override value (next section).
- **Inject short-GI frames** in monitor mode with `inject_80211 -i 1` (see [packet injection](Operating-Modes.md#packet-injection-and-fuzzing)).

On receive, openwifi decodes whatever GI the frame uses and reports it in the driver's RX log line (the `sgi` field, below).

### Forcing an MCS by hand

For controlled experiments you usually want a fixed rate instead of `minstrel_ht`:

```bash
./sdrctl dev sdr0 set reg drv_tx 1 11      # pin HT TX to MCS 7 (65 Mbps)
./sdrctl dev sdr0 set reg drv_tx 1 27      # same but short GI (11 + 16 = 72.2 Mbps)
./sdrctl dev sdr0 set reg drv_tx 1 0       # back to auto
```

Values 4 through 11 select MCS 0 through 7. Register 0 does the same for legacy (non-HT) rates. The full table is in the [sdrctl register reference](sdrctl-and-Runtime-Control.md#drv_tx-driver-tx).

In monitor mode, `inject_80211 -m n -r <0..7>` selects the MCS per injected frame instead.

### Checking what's actually on the air

The quickest way to see whether HT, aggregation, and short GI are really in use is the driver's RX print in `dmesg` (enable it via the dmesg print control, see [Troubleshooting → driver dmesg logging](Troubleshooting.md#driver-dmesg-logging)):

```
sdr,sdr openwifi_rx: 270B ht1aggr1/0 sgi1 650M FC0088 ...
```

- `ht1` means an 802.11n (HT) frame, `ht0` a legacy 11a/g frame
- `aggr1/0` means the frame came from an A-MPDU (second digit marks the last subframe)
- `sgi1` means short guard interval
- `650M` is the rate, here 65 Mbps = MCS 7[^docreadme]

A capture with `tcpdump` on a monitor interface shows the same information in the radiotap header (per-frame metadata the driver attaches to captures: rate or MCS, guard interval, signal strength), which is friendlier for offline analysis.

### Limitations to plan around

- **One spatial stream, 20 MHz, always.** The 72.2 Mbps ceiling is a hard PHY limit of the open-source design. The two antennas on a board are separate TX and RX paths for isolation, not MIMO.
- **Throughput in practice is ~50 Mbps**, not 72. Preambles, ACKs, and contention take their share even with aggregation.[^readme]
- **Short GI is off by default** at the capability level, so out-of-the-box links peak at 65 Mbps PHY rate.
- **A-MSDU is absent and A-MPDU is experimental**, so a commercial peer that leans on aggressive aggregation defaults will outrun an openwifi link.
- **No 802.11b compatibility.** In the 2.4 GHz band, legacy clients and management-frame fallbacks will bite you. See [About 802.11b](Operating-Modes.md#about-80211b).

## Wi-Fi 6 (802.11ax)

### Status

Wi-Fi 6 is **not in the open-source release**. The README lists "802.11ax and more advanced features" under the commercial offering at [openwifi.tech](https://openwifi.tech), which provides subscriptions on top of the AGPLv3 baseline (academic discounts are available).[^readme]

Traces of the plan are visible in the open driver: the rate-override register map reserves slots for VHT (11ac) and HE (11ax) overrides, both marked *not implemented*.[^docreadme] The open code gives you the platform Wi-Fi 6 work builds on, not the Wi-Fi 6 PHY itself.

### What Wi-Fi 6 would add on this hardware

The generation names state the intent. 802.11n is *high throughput*, 802.11ax is *high efficiency*. Wi-Fi 4 made a single link faster. Wi-Fi 6 mostly makes a busy channel more useful: many stations, small packets, and latency-sensitive traffic instead of one fast file transfer. And unlike Wi-Fi 5, its features don't depend on wide channels or many antennas, so they remain meaningful on this hardware. At 20 MHz with a single stream, the two generations compare like this:[^std]

| | Wi-Fi 4 (802.11n) | Wi-Fi 6 (802.11ax) |
|---|---|---|
| Subcarrier spacing | 312.5 kHz | 78.125 kHz |
| OFDM symbol | 3.2 µs + 0.4/0.8 µs GI | 12.8 µs + 0.8/1.6/3.2 µs GI |
| Data subcarriers (20 MHz) | 52 | 234 |
| Top modulation | 64-QAM (MCS 7) | 1024-QAM (MCS 11) |
| FEC | Punctured convolutional (BCC) | LDPC at the higher rates |
| Max PHY rate | 72.2 Mbps (short GI) | 143.4 Mbps (0.8 µs GI) |
| Channel sharing | Time only (CSMA/CA) | Time and frequency (OFDMA resource units) |
| Multi-user | None at one stream | Downlink and uplink OFDMA (plus MU-MIMO with more antennas) |
| Power saving | Legacy power save | Target Wake Time (TWT): sleep on a negotiated schedule |
| Overlapping networks | Defer to any detected frame | BSS coloring: ignore sufficiently weak frames from other networks |

What the rows mean in practice:

- **The denser numerology is the enabler.** Subcarriers sit 4x closer and symbols run 4x longer within the same 20 MHz. That's what makes the channel divisible into RUs (a 26-tone RU still has enough subcarriers to be useful), and the longer guard intervals tolerate outdoor delay spreads that would break an 800 ns GI.
- **1024-QAM and LDPC roughly double the single-stream ceiling**, but only at SNRs a clean short link can deliver. The efficiency features matter in more situations than the speed ones.
- **OFDMA changes the access model**, not just the rate (see [the primer](#a-short-80211-primer) for how RUs and trigger frames work). Scheduled uplink access enables the latency control that pure CSMA/CA can't give, and it's the feature openwifi's Wi-Fi 6 research centers on.
- **TWT and BSS coloring** target dense deployments: battery devices that wake on a schedule instead of contending, and neighboring networks that overlap without freezing each other.

One hardware note: Wi-Fi 6E's new spectrum (5.925 to 7.125 GHz) is mostly out of reach, because the AD9361 front end tops out at 6 GHz.

### openwifi in Wi-Fi 6 research

Even with the open release at Wi-Fi 4, openwifi is the base of published Wi-Fi 6 work, including experimental OFDMA and cross-technology interference studies and an ACM WiNTECH 2025 best paper on coordinated OFDMA. See [selected publications](FAQ-and-Resources.md#selected-publications) and the full [publications list](https://github.com/open-sdr/openwifi/blob/master/doc/publications.md).

### If you need Wi-Fi 6 today

Contact the team through [openwifi.tech](https://openwifi.tech) for the subscription tiers. If your need is "features beyond stock Wi-Fi 4 behavior" rather than the 11ax PHY itself, first check what the open release already exposes: every MAC timing parameter, CCA threshold, and queue is programmable (see [sdrctl & Runtime Control](sdrctl-and-Runtime-Control.md) and [Research Features](Research-Features.md)). A lot of "I need Wi-Fi 6 scheduling behavior" experiments can be approximated that way.

## Sources

[^readme]: openwifi [`README.md`](https://github.com/open-sdr/openwifi/blob/master/README.md): the feature list (802.11a/g/n, 20 MHz, aggregation via `./wgd.sh 1`, measured performance) and the 802.11ax / openwifi.tech statement.
[^docreadme]: openwifi [`doc/README.md`](https://github.com/open-sdr/openwifi/blob/master/doc/README.md): the `test_mode` definition (bit 0 = A-MPDU), the `drv_tx` rate-override registers including the unimplemented VHT/HE slots and the `+16` short-GI encoding, and the RX print format (`ht`/`aggr`/`sgi` fields).
[^sdrc]: openwifi [`driver/sdr.c`](https://github.com/open-sdr/openwifi/blob/master/driver/sdr.c): HT capability setup (`IEEE80211_HT_CAP_SGI_20` gated on `test_mode&2` with the stability comment, A-MPDU parameters gated on `test_mode&1`, MCS 0–7 in `mcs.rx_mask`) and `openwifi_ampdu_action()`.
[^std]: **IEEE 802.11**: values that follow from the standard (the HT MCS table, 11ac/11ax feature sets and rates), not from openwifi-specific measurements.
