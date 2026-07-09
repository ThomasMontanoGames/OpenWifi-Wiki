# Getting Started

This page takes you from an empty SD card to a working openwifi access point that your phone or laptop can join. Budget about an hour the first time.

## 1. What you need

**Hardware**

- A supported SDR board (see table below).
- An SD card, 16 GB or larger.
- Two antennas suitable for 2.4/5 GHz (or SMA cables + at least 30 dB attenuation for conducted tests).
- An Ethernet cable between the board and your PC.
- Optionally a USB-UART cable for a serial console — invaluable when networking doesn't come up.

**Supported boards** — the most common ones are below; the full matrix, per-board hardware notes, and the GPIO/LED debug map are on the [Supported Boards](Supported-Boards.md) page.

| `board_name` | Hardware | Vivado license needed to rebuild FPGA? |
|---|---|---|
| `zc706_fmcs2` | Xilinx ZC706 + AD-FMCOMMS2/3/4 | Yes |
| `zed_fmcs2` | Digilent/Avnet ZedBoard + AD-FMCOMMS2/3/4 | No |
| `zc702_fmcs2` | Xilinx ZC702 + AD-FMCOMMS2/3/4 | No |
| `zcu102_fmcs2` | Xilinx ZCU102 (MPSoC, 64-bit) + AD-FMCOMMS2/3/4 | Yes |
| `adrv9364z7020` | ADRV9364-Z7020 SoM + ADRV1CRR-BOB carrier | No |
| `adrv9361z7035` | ADRV9361-Z7035 SoM + ADRV1CRR-BOB/FMC carrier | Yes |
| `antsdr`, `e310v2`, `antsdr_e200` | MicroPhase enhanced ADALM-Pluto family | No |
| `sdrpi` | HexSDR Raspberry-Pi-sized SDR | No |
| `neptunesdr`, `LibreSDR` | Low-cost Zynq-7020 + AD9361 boards (community-supported, unofficial) | No |

The `board_name` string matters: it selects which FPGA image and boot files you use throughout the project (the same string names the board in all the [repos](Repositories.md)). The "Vivado license" column only matters if you rebuild the FPGA yourself — the prebuilt image works regardless. If you have no hardware at all, the imec **w-iLab.t** testbed offers remote access to openwifi-ready boards.

**A note on the ZedBoard-class FPGAs.** Boards built on the smaller Zynq-7020 (ZedBoard, ADRV9364-Z7020, ZC702, antsdr, sdrpi) have less FPGA memory. A few features (notably IQ capture buffer length) have reduced limits on them; the relevant pages call this out.

## 2. Flash the SD card

1. Download the prebuilt openwifi image linked from the [openwifi README](https://github.com/open-sdr/openwifi#download-img-and-quick-start) and unzip it to a `.img` file.
2. Write it to the SD card with your favorite imaging tool (GNOME Disks, Startup Disk Creator, win32diskimager) or with `dd`:

   ```bash
   # Find the correct sector count first:
   fdisk -l openwifi-xyz.img
   sudo dd bs=512 count=<sectors_from_fdisk> if=openwifi-xyz.img of=/dev/your_sdcard_dev
   ```

   Afterwards the card should show two partitions: `BOOT` and `rootfs`.

3. Configure the card for your board (do this on your PC before first boot):
    - Copy everything from `BOOT/openwifi/<board_name>/` into the root of the `BOOT` partition.
    - Delete `rootfs/root/kernel_modules` if it exists.
    - Delete `rootfs/etc/network/interfaces.new` if it exists (a common cause of "can't ssh to the board").

## 3. First boot and login

1. Insert the SD card, set the board's boot-mode jumpers/switches to SD boot, connect the antennas, and power on.
2. Give your PC's Ethernet interface the static IP **192.168.10.1** (netmask 255.255.255.0). The board boots with IP **192.168.10.122**.
3. Log in (password: `openwifi`):

   ```bash
   ssh root@192.168.10.122
   ```

   If ssh fails, hook up the UART console to watch the boot, and see [Troubleshooting](Troubleshooting.md).

4. One-time setup on a fresh board:

   ```bash
   raspi-config --expand-rootfs   # only if your SD card is larger than 16 GB; reboot after
   ./openwifi/setup_once.sh       # then reboot
   ```

## 4. Start the access point

On the board:

```bash
cd openwifi
./wgd.sh        # loads the FPGA image (if present) and the openwifi driver; creates NIC "sdr0"
./fosdem.sh     # starts hostapd (SSID "openwifi") plus a DHCP server and a demo webserver
```

Useful variants: `./wgd.sh 1` enables experimental A-MPDU aggregation (higher 11n throughput), and `./fosdem-11ag.sh` forces legacy 11a/g mode.

Now look for the **"openwifi"** SSID on your phone or laptop and connect. You should receive an IP in the 192.168.13.0/24 range; browse to `192.168.13.1` to see the on-board demo page.

Two things to know:

- The default configuration uses **channel 44 (5 GHz)**. If your client device is 2.4 GHz-only, edit `hostapd-openwifi.conf` on the board (channel/band) and re-run `fosdem.sh`.
- The FPGA uses an **evaluation license of the Xilinx Viterbi decoder, which halts after roughly two hours** of operation. Symptoms: reception dies; `./sdrctl dev sdr0 get reg rx 20` returns the same value forever. The fix is simply to reload the FPGA (see [dynamic reloading](Software-Development-Workflow.md#reloading-driver-and-fpga-without-rebooting)) or power-cycle the board.

Also note: the ADRV9361-Z7035 has very low TX power in the 5 GHz band — keep devices close when using that board on 5 GHz.

## 5. Give clients internet access (optional)

The board itself has no internet uplink, so route client traffic through your PC. On the PC:

```bash
sudo sysctl -w net.ipv4.ip_forward=1
sudo iptables -t nat -A POSTROUTING -o <internet_nic> -j MASQUERADE
sudo ip route add 192.168.13.0/24 via 192.168.10.122 dev <board_nic>
```

where `<board_nic>` is the PC interface wired to the board and `<internet_nic>` is the PC's uplink. Uncomment `net.ipv4.ip_forward=1` in `/etc/sysctl.conf` to make forwarding persistent.

## 6. What just happened?

The board is a small Linux computer. `wgd.sh` loaded the openwifi FPGA design and kernel driver, which registered a normal Linux Wi-Fi interface called **`sdr0`**. Everything after that — `hostapd`, DHCP, `iw`, `tcpdump` — is stock Linux behaving exactly as it would with a commercial Wi-Fi card. That is the central idea of openwifi, and the [Architecture Overview](Architecture.md) explains how it's achieved.

## Alternative: OpenWrt

Prefer a router-style experience with the LuCI web UI? Prebuilt OpenWrt images with openwifi baked in exist for most boards. Flash the image, boot, and an `openwrt-openwifi` SSID appears on 2.4 GHz channel 1 within about a minute. See the [OpenWrt build instructions](https://github.com/open-sdr/openwifi/blob/master/doc/img_build_instruction/openwrt/README.md) for the support matrix, usage examples, and how to build your own image.
