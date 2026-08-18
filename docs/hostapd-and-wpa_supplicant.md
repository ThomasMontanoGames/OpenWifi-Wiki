# hostapd and wpa_supplicant

openwifi runs **stock** `hostapd` and `wpa_supplicant`, the same binaries Ubuntu or Debian install for any Wi-Fi card. Nothing in them knows that the radio underneath is an FPGA. That is the point of the design, and it is also the thing that trips people up: when a link fails to come up, it is rarely obvious whether the daemon, the kernel, the driver, or the PHY is at fault.

For the mode-by-mode command sequences, see [Operating Modes](Operating-Modes.md).

## What each daemon does

Both are user-space programs that implement the parts of 802.11 that are too slow, too stateful, or too policy-driven to belong in the kernel. They handle **getting a link established**. They do not carry your traffic.

| | `hostapd` | `wpa_supplicant` |
|---|---|---|
| Role | The access point | The client (station) |
| Used in | [AP mode](Operating-Modes.md#access-point) | [Client mode](Operating-Modes.md#client-station) |
| Builds | The beacon and probe-response contents | Scan requests and connection attempts |
| Runs | The authenticator half of the WPA handshake | The supplicant half of the WPA handshake |
| Decides | Which SSID, channel, rates, and capabilities to advertise | Which network to join, and with which credentials |

A daemon is busy for the first second or so of a connection and then goes quiet. If `ping` is slow or lossy on an associated link, the daemon is almost certainly not the cause. If association never completes, read the daemon's output first.

## How they reach openwifi

They do not talk to openwifi, and they cannot. A daemon speaks the generic **nl80211** netlink interface to `cfg80211`, `cfg80211` drives `mac80211`, and `mac80211` calls the openwifi driver through the [`ieee80211_ops` callbacks](Driver-Architecture.md#the-mac80211-callback-surface). Only the last step touches openwifi-specific code.

<figure class="ow-svgfig">
<svg viewBox="0 0 760 470" width="760" height="470" role="img"
     aria-label="Two paths into mac80211: hostapd and wpa_supplicant reach it over nl80211 and cfg80211 to set a link up, while applications reach it over sockets and the network stack for every data frame. Below mac80211 sit the openwifi driver and the FPGA."
     style="max-width:100%;height:auto;color:var(--md-default-fg-color);font-family:var(--md-text-font-family,inherit)">
  <defs>
    <marker id="hw-arrow" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor"/>
    </marker>
  </defs>

  <!-- connectors -->
  <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-opacity="0.75">
    <path d="M190,86 V138" marker-end="url(#hw-arrow)"/>
    <path d="M570,86 V138" marker-end="url(#hw-arrow)"/>
    <path d="M190,186 V214 H300 V240" marker-end="url(#hw-arrow)"/>
    <path d="M570,186 V214 H460 V240" marker-end="url(#hw-arrow)"/>
    <path d="M380,288 V318" marker-end="url(#hw-arrow)"/>
    <path d="M380,372 V400" marker-end="url(#hw-arrow)"/>
  </g>

  <!-- edge labels -->
  <g font-size="11" fill="currentColor" fill-opacity="0.72">
    <text x="200" y="106" text-anchor="start">nl80211</text>
    <text x="200" y="121" text-anchor="start">setup and teardown only</text>
    <text x="580" y="106" text-anchor="start">sockets</text>
    <text x="580" y="121" text-anchor="start">every data frame</text>
  </g>

  <!-- nodes -->
  <g font-size="12.5" text-anchor="middle">
    <rect x="40" y="30" width="300" height="56" rx="8" fill="#0d9488" fill-opacity="0.12" stroke="#0d9488" stroke-width="1.4"/>
    <text fill="currentColor"><tspan x="190" y="54">hostapd · wpa_supplicant</tspan><tspan x="190" dy="17" font-size="10.5">association, keys, beacon contents</tspan></text>

    <rect x="420" y="30" width="300" height="56" rx="8" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.4"/>
    <text fill="currentColor"><tspan x="570" y="54">your application</tspan><tspan x="570" dy="17" font-size="10.5">ping, iperf, a browser</tspan></text>

    <rect x="40" y="138" width="300" height="48" rx="8" fill="#0d9488" fill-opacity="0.12" stroke="#0d9488" stroke-width="1.4"/>
    <text fill="currentColor"><tspan x="190" y="167">cfg80211</tspan></text>

    <rect x="420" y="138" width="300" height="48" rx="8" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.4"/>
    <text fill="currentColor"><tspan x="570" y="167">network stack (IP, sockets)</tspan></text>

    <rect x="190" y="240" width="380" height="48" rx="8" fill="#0d9488" fill-opacity="0.12" stroke="#0d9488" stroke-width="1.4"/>
    <text fill="currentColor"><tspan x="380" y="269">mac80211</tspan></text>

    <rect x="190" y="318" width="380" height="54" rx="8" fill="#0d9488" fill-opacity="0.12" stroke="#0d9488" stroke-width="1.4"/>
    <text fill="currentColor"><tspan x="380" y="342">openwifi driver (sdr.ko)</tspan><tspan x="380" dy="17" font-size="10.5">the only openwifi-specific part of this picture</tspan></text>

    <rect x="190" y="400" width="380" height="48" rx="8" fill="#6366f1" fill-opacity="0.12" stroke="#6366f1" stroke-width="1.4"/>
    <text fill="currentColor"><tspan x="380" y="429">FPGA: low MAC and PHY</tspan></text>
  </g>
</svg>
<figcaption>Two separate paths into <code>mac80211</code>. The daemons (left) use nl80211 and are active only while a link is being set up or torn down. Applications (right) use ordinary sockets, and their traffic reaches the driver without any daemon involvement. Everything above the driver box is generic Linux.</figcaption>
</figure>

Four consequences follow from this.

**You do not need an openwifi build of either daemon.** `apt-get install hostapd` is what the [SD image build](Building-SD-Images.md) does, and it is enough. The one exception is the 11b-suppressing `wpa_supplicant` described below, and that patch is about rate advertisement, not about openwifi.

**The daemons cannot see or set openwifi's own settings.** TX power, RX gain, CCA threshold, ACK behavior, and the FPGA registers are reached through a completely separate channel, `sdrctl`, which uses an nl80211 *testmode* command. See [sdrctl and Runtime Control](sdrctl-and-Runtime-Control.md). So a config file never contains an openwifi register setting, and `sdrctl` never changes an SSID.

**hostapd does not transmit beacons.** It hands `mac80211` the beacon contents, and `mac80211` plus the driver put a beacon on the air on a timer. That is why the beacon check in the [AP walkthrough](Operating-Modes.md#access-point) watches the TX interrupt count in `/proc/interrupts` rather than anything hostapd prints.

**Encryption runs in software.** The driver implements no key-offload callback (there is no `set_key` in the [callback table](Driver-Architecture.md#the-mac80211-callback-surface)), so `mac80211` does CCMP on the ARM cores. WPA2 works normally, but it costs processor time, so an encrypted link doesn't reach the throughput of an open one. When you are measuring peak throughput, test with security disabled.

## The configuration files openwifi ships

These live in the `openwifi` directory on the board, next to `wgd.sh` and `fosdem.sh`. They are ordinary hostapd and wpa_supplicant config files with no openwifi-specific syntax, so any hostapd or wpa_supplicant documentation applies to them directly.

| File | Used by | Purpose |
|---|---|---|
| `hostapd-openwifi.conf` | `fosdem.sh` | The demo AP: SSID, channel, band, rates, security |
| `wpa-openwifi.conf` | `wpa_supplicant -c` | Joining an openwifi AP |
| `wpa-connect.conf` | `wpa_supplicant -c` | Joining some other network, so edit this one for your home or lab AP |

`fosdem.sh` starts hostapd with `hostapd-openwifi.conf` and adds a DHCP server and a demo webserver on top. `fosdem-11ag.sh` is the same thing forced to legacy 802.11a/g. Neither script does anything to hostapd that you could not do by hand.

Check the shipped files on your own board before assuming defaults. They change between releases, and the wiki is not the source of truth for their contents.

## When you have to edit them

Most openwifi work never touches these files. These are the cases that do.

**Changing channel or band.** The demo defaults to channel 36 in 5 GHz. A 2.4 GHz-only client cannot see it. Edit the channel and `hw_mode` in `hostapd-openwifi.conf` and re-run `fosdem.sh`. This is the single most common edit, and it is called out in [Getting Started](Getting-Started.md#4-start-the-access-point) for that reason.

**Turning security on or off.** Standard hostapd `wpa` / `wpa_passphrase` / `wpa_key_mgmt` settings, matched by `psk` and `key_mgmt` on the client side. A minimal WPA2 stanza for `hostapd-openwifi.conf`:

```text
wpa=2
wpa_passphrase=yourpassphrase
wpa_key_mgmt=WPA-PSK
rsn_pairwise=CCMP
```

The client-side wpa_supplicant config carries the matching `psk` and `key_mgmt` fields. Worth disabling when you are benchmarking, for the software-crypto reason above.

**Suppressing 802.11b rates.** openwifi is OFDM-only and cannot do the 11b (DSSS) rates that 2.4 GHz devices often fall back to for beacons and management frames. The shipped `hostapd-openwifi.conf` already handles the AP side with `supported_rates` and `basic_rates`. The client side is harder, because an unmodified `wpa_supplicant` gives you no way to suppress 11b rates in 2.4 GHz, so openwifi ships a patched build. Run this on the client machine:

```bash
sudo apt-get install libssl-dev    # Ubuntu 20.04 and later. On 18.04 the package is libssl1.0-dev
cd openwifi/user_space
./build_wpa_supplicant_wo11b.sh
```

Staying in 5 GHz avoids the whole problem, which is why the demo defaults to a 5 GHz channel. The full explanation is in [About 802.11b](Operating-Modes.md#about-80211b).

**Forcing legacy 802.11a/g.** Use `fosdem-11ag.sh`, or set `ieee80211n=0` in the hostapd config yourself. Useful when you are trying to tell an 11n problem apart from an RF problem. The 11n side is covered in [Wi-Fi 4 and Wi-Fi 6 Features](Wi-Fi-4-and-Wi-Fi-6.md).

A-MPDU aggregation is **not** a hostapd setting. It is enabled when the driver loads, with `./wgd.sh 1`. See [Turning on A-MPDU aggregation](Wi-Fi-4-and-Wi-Fi-6.md#turning-on-a-mpdu-aggregation).

## Debugging a link that won't come up

Run the daemon in the foreground with verbose output. This is the fastest way to find out whether the problem is above or below the daemon:

```bash
wpa_supplicant -dd -i sdr0 -c wpa-openwifi.conf     # client
hostapd -dd hostapd-openwifi.conf                    # AP, instead of fosdem.sh
```

Read the output against these three cases.

- **Nothing appears in a scan.** The daemon is fine and the problem is below it. Either the AP is not beaconing, or the receiver is not hearing it. Check the AP's TX interrupt count, then antennas and distance, then [receiver sensitivity and gain](sdrctl-and-Runtime-Control.md#rx-gain).
- **Authentication or association is attempted and times out.** Frames are going out but nothing usable is coming back. In 2.4 GHz, suspect the 11b problem first. Otherwise treat it as a link-quality problem.
- **Association completes and then the link drops or gives no IP.** The daemons did their job. Go to [Client and link problems](Troubleshooting.md#client-link-problems) in Troubleshooting, starting with the DHCP server.

If a config file sets `ctrl_interface`, you can also attach `wpa_cli` or `hostapd_cli` to a running daemon to inspect state and issue commands without restarting it. For example, `wpa_cli -i sdr0 status` prints the association state of a running supplicant.

Two openwifi-specific traps: reloading the driver destroys and recreates `sdr0`, so any daemon that was running is now attached to nothing and has to be restarted, as noted in the [driver iteration loop](Software-Development-Workflow.md#the-driver-iteration-loop). And NetworkManager fights `wpa_supplicant` for control of the interface, which is why the client walkthrough starts with `service network-manager stop`.

For anything below the daemon, the driver's own logging is on the [Troubleshooting](Troubleshooting.md#driver-dmesg-logging) page.
