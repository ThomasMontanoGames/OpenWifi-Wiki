# Wi-Fi 4 and Wi-Fi 6 Features

The open-source openwifi release implements 802.11a/g plus a **single-stream, 20 MHz subset of 802.11n (Wi-Fi 4)**. Wi-Fi 5 (802.11ac) is skipped entirely, and Wi-Fi 6 (802.11ax) exists only as a commercial offering. This page explains what that means in practice: which Wi-Fi 4 features you actually get, how to switch them on and check that they're working, and where Wi-Fi 6 stands if you need it.

The [Architecture page](Architecture.md#what-openwifi-implements-of-80211agn) covers the same feature set from the design side (with the throughput derivation and diagrams). This page is the usage side. If Wi-Fi itself is new to you, start with the primer below. If you know 802.11, skip straight to [the timeline](#where-openwifi-sits-in-the-wi-fi-timeline).

## A short 802.11 primer

This section is for people who know RF and digital modulation but haven't worked with Wi-Fi as a standard. It's the minimum background the rest of the page assumes. Individual terms are in the [Glossary](Glossary.md).

**The standard and its names.** Wi-Fi is IEEE 802.11 plus a series of amendments named with letters (a, b, g, n, ac, ax). Each amendment layers new capabilities on the existing ones, and devices stay backward compatible with older peers on the same channel. The "Wi-Fi 4/5/6" generation numbers are marketing labels the Wi-Fi Alliance introduced in 2018: 802.11n is Wi-Fi 4, 802.11ac is Wi-Fi 5, 802.11ax is Wi-Fi 6. Nothing was ever officially called Wi-Fi 1 through 3. Channels live in the 2.4 GHz and 5 GHz bands (Wi-Fi 6E later added 6 GHz).

**The PHY, in RF terms.** A standard channel is 20 MHz wide and carries OFDM with a 64-point FFT, so subcarriers sit 312.5 kHz apart. Legacy 802.11a/g fills 48 subcarriers with data and 4 with pilots. Each OFDM symbol lasts 4 µs: 3.2 µs of useful symbol plus a 0.8 µs guard interval, a cyclic prefix that absorbs multipath delay spread.[^std] Subcarriers carry BPSK up to 64-QAM, protected by a rate 1/2 convolutional code that puncturing thins out to rates 2/3, 3/4, and 5/6. The fraction is the share of transmitted bits that carry information, so 5/6 means the least redundancy, and the receiver decodes it all with a Viterbi decoder (in openwifi, a Xilinx IP core). Each modulation-plus-code-rate combination has an index called the MCS. Unlike a fixed link, the transmitter re-picks the rate frame by frame based on what's getting through. On openwifi that's Linux's `minstrel_ht` rate-control algorithm, and you can pin it manually when you need repeatability.

**One shared channel, half duplex, no scheduler.** Every station transmits and receives on the same frequency and never both at once. Access is contention based (CSMA/CA): listen until the channel is idle, wait a random backoff, transmit, then wait for the receiver's acknowledgement. The ACK must start within a fixed short gap (SIFS, 10 or 16 µs depending on band), which is exactly the kind of deadline a software MAC can't meet and why openwifi runs this logic in the FPGA. The practical consequence for this page: every frame pays a fixed cost of preamble, backoff, and ACK, so real throughput lands well below the PHY rate, and features that spread that cost over more data (aggregation) often buy more than a faster PHY rate does.

**From OFDM to OFDMA.** Everything up to and including Wi-Fi 5 uses OFDM as a single-user scheme: whoever wins contention gets every subcarrier in the channel for the duration of the frame, so stations share the medium in time only. OFDMA, introduced by Wi-Fi 6, shares it in frequency as well. The subcarriers of one channel are grouped into **resource units (RUs)**, and the access point assigns RUs to different stations within the same transmission. In a 20 MHz channel an RU spans 26, 52, 106, or 242 tones, which allows anything from one full-channel user down to nine users in parallel, each on a slice about 2 MHz wide.[^std] Downlink OFDMA is one long frame carrying data for several receivers at once. Uplink OFDMA is the demanding direction: the AP invites specific stations with a trigger frame, and their transmissions must arrive at the AP aligned, so every station has to pre-correct its timing and carrier frequency tightly enough to stay orthogonal with its neighbors in the same FFT. The goal is not peak speed. A short packet no longer pays a full contention cycle for a 20 MHz channel it barely fills, which turns a crowded channel from a lottery into something schedulable.

<figure>
<svg viewBox="0 0 920 320" role="img" aria-label="OFDM versus OFDMA. With OFDM each transmission fills the whole 20 MHz channel and stations alternate in time, separated by contention. With OFDMA one transmission is split into resource units so several stations share the channel at once, and a single station can still take the whole channel." style="width:100%;height:auto;max-width:1080px;font-family:inherit;font-size:13px">
  <defs>
    <marker id="ofdma-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fill-opacity="0.55"/>
    </marker>
  </defs>

  <!-- left panel: OFDM -->
  <text x="247" y="24" text-anchor="middle" font-weight="700" fill="currentColor">OFDM (through Wi-Fi 5)</text>
  <line x1="55" y1="270" x2="55" y2="42" stroke="currentColor" stroke-opacity="0.55" marker-end="url(#ofdma-arrow)"/>
  <line x1="55" y1="270" x2="440" y2="270" stroke="currentColor" stroke-opacity="0.55" marker-end="url(#ofdma-arrow)"/>
  <text x="24" y="160" transform="rotate(-90 24 160)" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity="0.75">frequency (20 MHz)</text>
  <text x="247" y="292" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity="0.75">time</text>

  <rect x="70" y="55" width="95" height="205" rx="4" fill="#4f5bd5" fill-opacity="0.82"/>
  <text x="117" y="162" text-anchor="middle" font-weight="600" fill="#ffffff">STA A</text>
  <text x="182" y="160" transform="rotate(-90 182 160)" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.6">contention</text>
  <rect x="200" y="55" width="115" height="205" rx="4" fill="#0d9488" fill-opacity="0.82"/>
  <text x="257" y="162" text-anchor="middle" font-weight="600" fill="#ffffff">STA B</text>
  <text x="332" y="160" transform="rotate(-90 332 160)" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.6">contention</text>
  <rect x="350" y="55" width="85" height="205" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="392" y="162" text-anchor="middle" font-weight="600" fill="#ffffff">STA C</text>

  <!-- right panel: OFDMA -->
  <text x="722" y="24" text-anchor="middle" font-weight="700" fill="currentColor">OFDMA (Wi-Fi 6)</text>
  <line x1="535" y1="270" x2="535" y2="42" stroke="currentColor" stroke-opacity="0.55" marker-end="url(#ofdma-arrow)"/>
  <line x1="535" y1="270" x2="905" y2="270" stroke="currentColor" stroke-opacity="0.55" marker-end="url(#ofdma-arrow)"/>
  <text x="722" y="292" text-anchor="middle" font-size="12" fill="currentColor" fill-opacity="0.75">time</text>

  <rect x="550" y="55" width="160" height="88" rx="4" fill="#4f5bd5" fill-opacity="0.82"/>
  <text x="630" y="103" text-anchor="middle" font-size="11.5" font-weight="600" fill="#ffffff">STA A · 106-tone RU</text>
  <rect x="550" y="146" width="160" height="21" rx="3" fill="currentColor" fill-opacity="0.16"/>
  <text x="630" y="161" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">26</text>
  <rect x="550" y="170" width="160" height="43" rx="4" fill="#0d9488" fill-opacity="0.82"/>
  <text x="630" y="196" text-anchor="middle" font-size="11.5" font-weight="600" fill="#ffffff">STA B · 52-tone RU</text>
  <rect x="550" y="216" width="160" height="44" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="630" y="242" text-anchor="middle" font-size="11.5" font-weight="600" fill="#ffffff">STA C · 52-tone RU</text>

  <rect x="740" y="55" width="150" height="205" rx="4" fill="#7c3aed" fill-opacity="0.82"/>
  <text x="815" y="152" text-anchor="middle" font-size="11.5" font-weight="600" fill="#ffffff">STA D · 242-tone RU</text>
  <text x="815" y="170" text-anchor="middle" font-size="10.5" fill="#ffffff" fill-opacity="0.85">(whole channel)</text>
</svg>
<figcaption>Left: through Wi-Fi 5, every transmission occupies the whole channel and stations take turns through contention. Right: Wi-Fi 6 OFDMA assigns resource units to several stations within one transmission, and a single station can still get the full channel.</figcaption>
</figure>

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

### What a frame looks like on the air

Everything above (MCS, guard interval, aggregation) is a property of one **PPDU**: the complete PHY frame openwifi's FPGA puts on the air. A PPDU is a PHY *preamble* followed by a *Data field*, and it never travels alone: the transmitter first wins the channel through DIFS-plus-backoff contention, and after a fixed SIFS gap the receiver answers. The figure below walks down through those three levels.

The key thing to read off it is where the fixed overhead the primer warned about actually lives. Every generation keeps the same **legacy preamble** (L-STF, L-LTF, L-SIG, ~20 µs) so that any nearby 802.11a/g device can still detect the frame and defer. 802.11n then adds ~8 µs of HT training and 802.11ax ~16 µs of HE training on top. That preamble, the SIFS, and the acknowledgement are paid once per PPDU no matter how much data rides inside it, which is exactly why packing many MPDUs into one Data field as an A-MPDU (bottom row) is such a large win.

<figure>
<svg viewBox="0 0 920 462" role="img" aria-label="Three levels of an openwifi transmission. Top: channel access, where a PPDU is preceded by DIFS and backoff and followed after a SIFS gap by a Block ACK. Middle: the PPDU field structure for 802.11a/g, 802.11n and 802.11ax, all sharing the same legacy preamble (L-STF, L-LTF, L-SIG) and then adding HT or HE training fields before the Data field. Bottom: the Data field is an A-MPDU of several MPDU subframes, each made of an MPDU delimiter, MAC header, frame body and FCS, acknowledged together by one Block ACK." style="width:100%;height:auto;max-width:1080px;font-family:inherit;font-size:13px">
  <defs>
    <marker id="ppdu-zoom" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fill-opacity="0.5"/>
    </marker>
  </defs>

  <!-- ===== Level 1: channel access ===== -->
  <text x="460" y="18" text-anchor="middle" font-weight="700" fill="currentColor">A single openwifi transmission, end to end</text>
  <text x="460" y="35" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.7">channel access → PPDU → acknowledgement (segment widths are illustrative, not to scale)</text>

  <rect x="15" y="48" width="150" height="40" rx="4" fill="currentColor" fill-opacity="0.13"/>
  <text x="90" y="66" text-anchor="middle" font-size="11.5" fill="currentColor">DIFS +</text>
  <text x="90" y="80" text-anchor="middle" font-size="11.5" fill="currentColor">backoff</text>
  <rect x="172" y="48" width="545" height="40" rx="4" fill="#4f5bd5" fill-opacity="0.82"/>
  <text x="444" y="72" text-anchor="middle" font-weight="600" fill="#ffffff">PPDU  (preamble + Data field)</text>
  <rect x="724" y="48" width="44" height="40" rx="4" fill="currentColor" fill-opacity="0.13"/>
  <text x="746" y="72" text-anchor="middle" font-size="10.5" fill="currentColor">SIFS</text>
  <rect x="775" y="48" width="130" height="40" rx="4" fill="#7c3aed" fill-opacity="0.82"/>
  <text x="840" y="72" text-anchor="middle" font-weight="600" fill="#ffffff">Block ACK</text>

  <!-- zoom connectors level 1 -> level 2 -->
  <line x1="172" y1="88" x2="75" y2="149" stroke="currentColor" stroke-opacity="0.45" stroke-dasharray="4 3" marker-end="url(#ppdu-zoom)"/>
  <line x1="717" y1="88" x2="905" y2="149" stroke="currentColor" stroke-opacity="0.45" stroke-dasharray="4 3" marker-end="url(#ppdu-zoom)"/>

  <!-- ===== Level 2: PPDU field structure ===== -->
  <text x="460" y="130" text-anchor="middle" font-weight="700" fill="currentColor">PPDU structure — the legacy preamble stays, each generation adds training</text>

  <!-- shared-legacy-preamble highlight (drawn behind the bars) -->
  <rect x="73" y="151" width="182" height="107" rx="4" fill="currentColor" fill-opacity="0.06" stroke="currentColor" stroke-opacity="0.35" stroke-dasharray="4 3"/>
  <text x="164" y="272" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.7">shared legacy preamble (~20 µs)</text>

  <!-- left tags -->
  <text x="66" y="173" text-anchor="end" font-size="11" font-weight="700" fill="currentColor">11a/g</text>
  <text x="66" y="209" text-anchor="end" font-size="11" font-weight="700" fill="currentColor">11n</text>
  <text x="66" y="245" text-anchor="end" font-size="11" font-weight="700" fill="currentColor">11ax</text>

  <!-- Legacy (11a/g) bar -->
  <rect x="75"  y="155" width="68"  height="28" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="109" y="173" text-anchor="middle" font-size="9.5" fill="#ffffff">L-STF</text>
  <rect x="145" y="155" width="66"  height="28" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="178" y="173" text-anchor="middle" font-size="9.5" fill="#ffffff">L-LTF</text>
  <rect x="213" y="155" width="40"  height="28" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="233" y="173" text-anchor="middle" font-size="9.5" fill="#ffffff">L-SIG</text>
  <rect x="255" y="155" width="650" height="28" rx="3" fill="#c2740a" fill-opacity="0.82"/><text x="580" y="173" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">Data field</text>

  <!-- HT (11n) bar -->
  <rect x="75"  y="191" width="68"  height="28" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="109" y="209" text-anchor="middle" font-size="9.5" fill="#ffffff">L-STF</text>
  <rect x="145" y="191" width="66"  height="28" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="178" y="209" text-anchor="middle" font-size="9.5" fill="#ffffff">L-LTF</text>
  <rect x="213" y="191" width="40"  height="28" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="233" y="209" text-anchor="middle" font-size="9.5" fill="#ffffff">L-SIG</text>
  <rect x="255" y="191" width="66"  height="28" rx="3" fill="#0d9488" fill-opacity="0.85"/><text x="288" y="209" text-anchor="middle" font-size="9" fill="#ffffff">HT-SIG</text>
  <rect x="323" y="191" width="40"  height="28" rx="3" fill="#0d9488" fill-opacity="0.85"/><text x="343" y="209" text-anchor="middle" font-size="8.5" fill="#ffffff">HT-STF</text>
  <rect x="365" y="191" width="40"  height="28" rx="3" fill="#0d9488" fill-opacity="0.85"/><text x="385" y="209" text-anchor="middle" font-size="8.5" fill="#ffffff">HT-LTF</text>
  <rect x="407" y="191" width="498" height="28" rx="3" fill="#c2740a" fill-opacity="0.82"/><text x="656" y="209" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">Data field</text>

  <!-- HE (11ax) bar -->
  <rect x="75"  y="227" width="68"  height="28" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="109" y="245" text-anchor="middle" font-size="9.5" fill="#ffffff">L-STF</text>
  <rect x="145" y="227" width="66"  height="28" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="178" y="245" text-anchor="middle" font-size="9.5" fill="#ffffff">L-LTF</text>
  <rect x="213" y="227" width="40"  height="28" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="233" y="245" text-anchor="middle" font-size="9.5" fill="#ffffff">L-SIG</text>
  <rect x="255" y="227" width="40"  height="28" rx="3" fill="#7c3aed" fill-opacity="0.85"/><text x="275" y="245" text-anchor="middle" font-size="8.5" fill="#ffffff">RL-SIG</text>
  <rect x="297" y="227" width="66"  height="28" rx="3" fill="#7c3aed" fill-opacity="0.85"/><text x="330" y="245" text-anchor="middle" font-size="8.5" fill="#ffffff">HE-SIG-A</text>
  <rect x="365" y="227" width="40"  height="28" rx="3" fill="#7c3aed" fill-opacity="0.85"/><text x="385" y="245" text-anchor="middle" font-size="8.5" fill="#ffffff">HE-STF</text>
  <rect x="407" y="227" width="52"  height="28" rx="3" fill="#7c3aed" fill-opacity="0.85"/><text x="433" y="245" text-anchor="middle" font-size="8.5" fill="#ffffff">HE-LTF</text>
  <rect x="461" y="227" width="444" height="28" rx="3" fill="#c2740a" fill-opacity="0.82"/><text x="683" y="245" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">Data field</text>

  <!-- zoom connectors level 2 -> level 3 (from the Data field) -->
  <line x1="461" y1="255" x2="75" y2="328" stroke="currentColor" stroke-opacity="0.45" stroke-dasharray="4 3" marker-end="url(#ppdu-zoom)"/>
  <line x1="905" y1="255" x2="905" y2="328" stroke="currentColor" stroke-opacity="0.45" stroke-dasharray="4 3" marker-end="url(#ppdu-zoom)"/>

  <!-- ===== Level 3: A-MPDU inside the Data field ===== -->
  <text x="460" y="304" text-anchor="middle" font-weight="700" fill="currentColor">Inside the Data field — an A-MPDU of many MPDU subframes</text>

  <rect x="75"  y="330" width="193" height="34" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="171" y="351" text-anchor="middle" font-size="10.5" font-weight="600" fill="#ffffff">MPDU 1</text>
  <rect x="270" y="330" width="193" height="34" rx="3" fill="#0d9488" fill-opacity="0.85"/><text x="366" y="351" text-anchor="middle" font-size="10.5" font-weight="600" fill="#ffffff">MPDU 2</text>
  <rect x="465" y="330" width="193" height="34" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="561" y="351" text-anchor="middle" font-size="10.5" font-weight="600" fill="#ffffff">MPDU 3</text>
  <rect x="660" y="330" width="193" height="34" rx="3" fill="#0d9488" fill-opacity="0.85"/><text x="756" y="351" text-anchor="middle" font-size="10.5" font-weight="600" fill="#ffffff">MPDU 4</text>
  <rect x="855" y="330" width="50"  height="34" rx="3" fill="currentColor" fill-opacity="0.13"/><text x="880" y="352" text-anchor="middle" font-size="13" fill="currentColor" fill-opacity="0.7">⋯</text>

  <!-- zoom connectors: one MPDU -> its fields -->
  <line x1="270" y1="364" x2="75" y2="403" stroke="currentColor" stroke-opacity="0.45" stroke-dasharray="4 3" marker-end="url(#ppdu-zoom)"/>
  <line x1="463" y1="364" x2="905" y2="403" stroke="currentColor" stroke-opacity="0.45" stroke-dasharray="4 3" marker-end="url(#ppdu-zoom)"/>

  <rect x="75"  y="405" width="75"  height="30" rx="3" fill="currentColor" fill-opacity="0.16"/><text x="112" y="424" text-anchor="middle" font-size="8.5" fill="currentColor">MPDU delim.</text>
  <rect x="152" y="405" width="168" height="30" rx="3" fill="#4f5bd5" fill-opacity="0.82"/><text x="236" y="424" text-anchor="middle" font-size="10" fill="#ffffff">MAC header</text>
  <rect x="322" y="405" width="498" height="30" rx="3" fill="#c2740a" fill-opacity="0.82"/><text x="571" y="424" text-anchor="middle" font-size="10.5" font-weight="600" fill="#ffffff">Frame body (LLC / IP / payload)</text>
  <rect x="822" y="405" width="83"  height="30" rx="3" fill="#7c3aed" fill-opacity="0.82"/><text x="863" y="424" text-anchor="middle" font-size="10" fill="#ffffff">FCS</text>

  <text x="112" y="449" text-anchor="middle" font-size="8.5" fill="currentColor" fill-opacity="0.7">4 B</text>
  <text x="236" y="449" text-anchor="middle" font-size="8.5" fill="currentColor" fill-opacity="0.7">≈ 30 B</text>
  <text x="571" y="449" text-anchor="middle" font-size="8.5" fill="currentColor" fill-opacity="0.7">variable length</text>
  <text x="863" y="449" text-anchor="middle" font-size="8.5" fill="currentColor" fill-opacity="0.7">4 B</text>
</svg>
<figcaption>The same transmission at three zoom levels. <strong>Top:</strong> the PPDU wins the channel after DIFS + backoff and is acknowledged one SIFS later. <strong>Middle:</strong> all three generations openwifi cares about share the legacy preamble (L-STF/L-LTF/L-SIG) for backward compatibility, then 802.11n adds HT training and 802.11ax adds RL-SIG/HE-SIG-A/HE training before the Data field. openwifi's open release implements the 11a/g and 11n rows. <strong>Bottom:</strong> with A-MPDU on, that Data field holds many MPDU subframes (each a delimiter + MAC header + frame body + FCS) under one preamble, and a single Block ACK acknowledges them all: one corrupted subframe costs one retransmission, not the whole aggregate.</figcaption>
</figure>

### Turning on A-MPDU aggregation

Aggregation is the single biggest practical win. At tens of Mbps the fixed per-frame cost (preamble, SIFS, ACK, backoff) starts to dominate, and A-MPDU packs many MPDUs into one transmission so that cost is paid once. Acknowledgement is amortized the same way: the receiver answers the whole aggregate with a single block ACK that flags any subframes needing retransmission, instead of one ACK per frame.[^std] openwifi's headline iperf numbers were measured with aggregation on.[^readme]

<figure markdown>
![A-MPDU vs A-MSDU aggregation](assets/img/mpdu-aggr.png){ width="650" }
<figcaption>A-MPDU keeps a header and CRC per subframe, so one corrupted subframe costs one retransmission, not the whole aggregate. Figure from the openwifi 802.11n app note.</figcaption>
</figure>

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

<figure markdown>
![800 ns normal vs 400 ns short guard interval](assets/img/guard-interval.png){ width="650" }
<figcaption>The same OFDM symbols with the normal 800 ns and the short 400 ns guard interval. Figure from the openwifi 802.11n app note.</figcaption>
</figure>

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

<figure>
<svg viewBox="0 0 920 312" role="img" aria-label="The resource unit splits of a 20 MHz channel: one 242-tone RU for a single station, two 106-tone RUs with a 26-tone RU in the middle, four 52-tone RUs with a 26-tone center, or nine 26-tone RUs of roughly 2 MHz each." style="width:100%;height:auto;max-width:1080px;font-family:inherit;font-size:13px">
  <text x="460" y="20" text-anchor="middle" font-weight="700" fill="currentColor">One 20 MHz channel, four ways to slice it</text>

  <text x="15" y="47" font-size="11.5" fill="currentColor" fill-opacity="0.75">One station takes the whole channel:</text>
  <rect x="15" y="53" width="880" height="38" rx="4" fill="#4f5bd5" fill-opacity="0.82"/>
  <text x="455" y="77" text-anchor="middle" font-size="12" font-weight="600" fill="#ffffff">242-tone RU</text>

  <text x="15" y="113" font-size="11.5" fill="currentColor" fill-opacity="0.75">Two stations (the middle 26-tone RU can serve a third):</text>
  <rect x="15" y="119" width="388" height="38" rx="4" fill="#0d9488" fill-opacity="0.82"/>
  <text x="209" y="143" text-anchor="middle" font-size="12" font-weight="600" fill="#ffffff">106-tone RU</text>
  <rect x="408" y="119" width="94" height="38" rx="4" fill="currentColor" fill-opacity="0.16"/>
  <text x="455" y="143" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.8">26</text>
  <rect x="507" y="119" width="388" height="38" rx="4" fill="#0d9488" fill-opacity="0.82"/>
  <text x="701" y="143" text-anchor="middle" font-size="12" font-weight="600" fill="#ffffff">106-tone RU</text>

  <text x="15" y="179" font-size="11.5" fill="currentColor" fill-opacity="0.75">Four stations (plus the 26-tone center):</text>
  <rect x="15" y="185" width="191" height="38" rx="4" fill="#7c3aed" fill-opacity="0.82"/>
  <text x="110" y="209" text-anchor="middle" font-size="11.5" font-weight="600" fill="#ffffff">52-tone RU</text>
  <rect x="211" y="185" width="191" height="38" rx="4" fill="#7c3aed" fill-opacity="0.82"/>
  <text x="306" y="209" text-anchor="middle" font-size="11.5" font-weight="600" fill="#ffffff">52-tone RU</text>
  <rect x="407" y="185" width="96" height="38" rx="4" fill="currentColor" fill-opacity="0.16"/>
  <text x="455" y="209" text-anchor="middle" font-size="11" fill="currentColor" fill-opacity="0.8">26</text>
  <rect x="508" y="185" width="191" height="38" rx="4" fill="#7c3aed" fill-opacity="0.82"/>
  <text x="603" y="209" text-anchor="middle" font-size="11.5" font-weight="600" fill="#ffffff">52-tone RU</text>
  <rect x="704" y="185" width="191" height="38" rx="4" fill="#7c3aed" fill-opacity="0.82"/>
  <text x="799" y="209" text-anchor="middle" font-size="11.5" font-weight="600" fill="#ffffff">52-tone RU</text>

  <text x="15" y="245" font-size="11.5" fill="currentColor" fill-opacity="0.75">Nine stations, each on roughly 2 MHz:</text>
  <rect x="15" y="251" width="93" height="38" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="61" y="275" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">26</text>
  <rect x="113" y="251" width="93" height="38" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="159" y="275" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">26</text>
  <rect x="211" y="251" width="93" height="38" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="257" y="275" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">26</text>
  <rect x="309" y="251" width="93" height="38" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="355" y="275" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">26</text>
  <rect x="407" y="251" width="93" height="38" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="453" y="275" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">26</text>
  <rect x="505" y="251" width="93" height="38" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="551" y="275" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">26</text>
  <rect x="603" y="251" width="93" height="38" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="649" y="275" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">26</text>
  <rect x="701" y="251" width="93" height="38" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="747" y="275" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">26</text>
  <rect x="799" y="251" width="96" height="38" rx="4" fill="#c2740a" fill-opacity="0.82"/>
  <text x="847" y="275" text-anchor="middle" font-size="11" font-weight="600" fill="#ffffff">26</text>
</svg>
<figcaption>The defined resource-unit splits of a 20 MHz channel. Sizes can be mixed within one transmission (say, one 106-tone RU plus two 52-tone RUs), the usable tone count differs slightly between splits because of null tones, and the AP can redraw the layout for every transmission.</figcaption>
</figure>

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
