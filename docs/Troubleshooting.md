# Troubleshooting and Known Issues

Grouped by symptom. When networking won't come up at all, use a **USB-UART serial console**. It shows you the boot messages that ssh can't. Connect a USB-UART adapter to the board's UART header and open the port at 115200 baud in a terminal program (for example PuTTY, screen, or minicom). The authoritative, continuously updated list is the [known-issue note](https://github.com/open-sdr/openwifi/blob/master/doc/known_issue/notter.md). This page reorganizes it and adds the debugging tools.

## Boot and networking

### Can't `ssh` to the board on first boot

Delete `/etc/network/interfaces.new`, a leftover from image creation that can break the network configuration, from the SD card's `rootfs` partition (on your PC). If it still fails, use the UART console (`/dev/ttyUSBx`, `/dev/ttyCH341USBx`, …) to watch the boot.

### No UART console device appears

On ANTSDR-E200 and similar CH341 adapters, try `sudo apt remove brltty`, since brltty grabs the CH341 device. (Reference: the [CH341SER notes](https://github.com/juliagoda/CH341SER).)

### `EXT4-fs error (device mmcblk0p2)` on first boot

Seen on neptunesdr. The flashing tool is suspect, so re-flash with a different one (GNOME Disks, Startup Disk Creator, or win32diskimager).

### ZCU102 kernel panic: "Unable to mount root fs on unknown-block(179,2)"

The same SD card boots on some ZCU102 units but not others. The SD interface likely needs to run slower. Add these to the mmc/sdhci node of the ZCU102 device tree to cap the speed (see [Boot, Kernel & Device Tree](Boot-Kernel-Device-Tree.md#the-device-tree) for how openwifi builds and edits a board's device tree):

```text
xlnx,has-cd = <0x1>;
xlnx,has-power = <0x0>;
xlnx,has-wp = <0x1>;
disable-wp;
no-1-8-v;
broken-cd;
xlnx,mio-bank = <1>;
sdhci-caps-mask = <0 0x200000>;
sdhci-caps = <0 0>;
max-frequency = <19000000>;
```

### Board won't boot at all (SPI flash suspected)

The on-board SPI flash holds some config (kernel file, AD9361 crystal frequency `ad9361_ext_refclk=0x2625a8b`). Interrupt boot in the UART console (press Enter before Linux loads) and reset the environment:

```console
Zynq> env default -a
Zynq> saveenv
```

!!! warning "This resets all U-Boot variables"
    `env default -a` + `saveenv` permanently restores factory defaults and erases any custom U-Boot variables you set. Reboot the board afterwards. It should then boot normally.

### Wrong memory size on ADRV9361-Z7035 SoM

Linux detects only half the RAM. An old `u-boot.elf` hard-coded 512 MB. Rebuild U-Boot from [analogdevicesinc/u-boot-xlnx](https://github.com/analogdevicesinc/u-boot-xlnx) and regenerate `BOOT.BIN` (build flow: [Boot, Kernel & Device Tree](Boot-Kernel-Device-Tree.md#32-bit-vs-64-bit-boot)):

```bash
source environment_setting.sh          # from the u-boot-xlnx checkout
export ARCH=arm
export CROSS_COMPILE=arm-linux-gnueabihf-
make zynq_adrv9361_defconfig && make -j8 && make u-boot.elf
```

The 1 GB fix is already in u-boot-xlnx master (`zynq-adrv9361.dts`), so a current checkout needs no source edits.

## Client / link problems

### Client connects but gets no IP

Restart the DHCP server on the board and reconnect from the client:

```bash
service isc-dhcp-server restart
```

### Big packet loss at slow ping, but fine at fast ping

The *other* device's Wi-Fi power save is the usual cause, because it sleeps between your infrequent packets. Turn it off on that device:

```bash
iw dev wlan0 get power_save
sudo iw dev wlan0 set power_save off
```

### Ping-by-hostname fails (DNS)

Set `nameserver 8.8.8.8` in `/etc/resolv.conf` on the board.

### Reception dies after ~2 hours

`./sdrctl dev sdr0 get reg rx 20` is frozen. This is the **Xilinx Viterbi decoder evaluation license** halting, which is expected behavior, not a bug. Reload the FPGA (see [dynamic reloading](Software-Development-Workflow.md#reloading-driver-and-fpga-without-rebooting)) or power-cycle. A proper license removes the limit.

## Hardware quirks

### FMCOMMS board causes a Linux crash (bad/empty EEPROM)

Some FMCOMMS2/3/4 boards ship with a wrong or empty FRU EEPROM, which crashes some platforms (notably ZCU102). Reprogram it with [fru_tools](https://github.com/analogdevicesinc/fru_tools):

1. Boot the FMCOMMS board on a platform that *does* come up (for example a 32-bit zed/zc706/zc702).
2. Build `fru_tools`.
3. Locate the EEPROM with `find /sys -name eeprom`.
4. Confirm the mismatch with `fru-dump -i <eeprom> -b`.
5. Write the correct master file, e.g.:

    ```bash
    fru-dump -i ./masterfiles/AD-FMCOMMS4-EBZ-FRU.bin -o /sys/.../0-0050/eeprom
    ```

    Reboot and re-read to confirm.

### `Unsupported PRODUCT_ID 0xFF` at AD9361 probe

Same root cause as the [bad/empty EEPROM](#fmcomms-board-causes-a-linux-crash-badempty-eeprom) above, and the same `fru_tools` fix applies.

### `Unsupported PRODUCT_ID 0x00` at AD9361 probe

A different failure from the `0xFF` case above. `0x00` means the AD9361 / FMCOMMS front end **did not power up correctly**: the driver is reading back all-zeros because the chip isn't alive, not because of a bad EEPROM. Check the board's power: that the FMCOMMS card is fully seated, that its supply rails are up, and that the carrier is delivering enough current to the front end.

### ZCU102 kernel panic (RTC / capacitor & current load)

Some ZCU102 boards kernel-panic during boot, a failure traced to the RTC capacitor and current load. Tracked in issues [#366](https://github.com/open-sdr/openwifi/issues/366) and [#457](https://github.com/open-sdr/openwifi/issues/457).

## Storage and long-run stability

### "No space left on device"

journald can't write because logs filled the disk. Clean up and cap journald:

!!! warning "These commands are destructive"
    They delete every log currently on the board and permanently remove the rsyslog package. Fine on a throwaway demo image, not fine if you still need those logs.

```bash
sudo systemd-tmpfiles --clean
sudo systemd-tmpfiles --remove
sudo rm /var/log/* -rf
sudo apt --autoremove purge rsyslog
```

Then add to `/etc/systemd/journald.conf`:

```ini
SystemMaxUse=64M
Storage=volatile
RuntimeMaxUse=64M
ForwardToConsole=no
ForwardToWall=no
```

### Instability after a long uptime

`lightdm` has a memory leak. If you don't need the desktop, disable it: `sudo systemctl disable --now lightdm`.

## Build-host problems

### Kernel config prompts for new options (GCC plugins, stack canary, Xen…)

After a host toolchain or minor kernel bump, new Kconfig options may appear during a kernel build. Choose **n** / the weakest option for these to avoid build failures or subtle issues.

### `libidn.so.11` missing while running `boot_bin_gen.sh`

Symlink your installed version (confirm the exact filename first):

```bash
sudo ln -s /usr/lib/x86_64-linux-gnu/libidn.so.12.6.3 /usr/lib/x86_64-linux-gnu/libidn.so.11
```

### Vitis HLS: `'2xxxxxxxxx' is an invalid argument`

Seen during `create_ip_repo.sh`. Apply [Xilinx article 76960](https://support.xilinx.com/s/article/76960).

### Ubuntu 24: FPGA tools need `libtinfo5`

The default is `libtinfo6`. Install `libtinfo5` manually (see [Environment Setup](Development-Environment-Setup.md#host-os-and-packages)).

## OpenWrt-specific

### No UART output on ZCU102 under OpenWrt

Support was validated only on **ZCU102 HW Rev 1.1**, and even then some 4 GB SODIMM modules fail with the U-Boot SPL bootflow. Known-good module: `MTA8ATF51264HZ-2G6B1`. Known-failing: `MTA4ATF51264HZ-2G6E1`. The fix is to use the **Zynq FSBL instead of U-Boot SPL** (FSBL reads the module's SPD EEPROM and configures DDR correctly), via `build_zynqmp_boot_bin.sh` in the openwifi repo's [`kernel_boot/`](https://github.com/open-sdr/openwifi/tree/master/kernel_boot) directory or by generating `boot.bin` yourself with OpenWrt-built components. Full analysis is in the [known-issue note](https://github.com/open-sdr/openwifi/blob/master/doc/known_issue/notter.md#no-uart-output-on-zcu102).

## Debugging tools

### Driver dmesg logging

Turn on per-event driver prints (then read them with `dmesg`):

```bash
./sdrctl dev sdr0 set reg drv_tx 7 X
./sdrctl dev sdr0 set reg drv_rx 7 X
```

`X` is a bitmask:

| Bit | Meaning |
|---|---|
| 0 | Errors |
| 1 | Regular unicast messages (`openwifi_tx`/`openwifi_tx_interrupt`/`openwifi_rx_interrupt`) |
| 2 | Broadcast messages |
| 3 | Queue stop/wake messages |

So `3` = errors + unicast, and `1` = errors only. Search `printk` in `sdr.c` to see every print point.

**Reading a TX print:**

```text
openwifi_tx: 70B RC0 10M FC0040 DI0000 ADDRffff.../6655443322aa/ffff... flag4001201e QoS00 SC20_1 retr1 ack0 prio0 q0 wr19 rd18
```

- `70B` = length
- `10M` = requested rate, printed in units of 100 kbps, so 1.0 Mbps 802.11b, which openwifi converts to 6 Mbps OFDM
- `FC0040` = Frame Control
- `ADDR` = addr1/2/3
- `SC20_1` = sequence number 20, set by the driver
- `retr1` = no retransmission needed (`retrN` = up to N transmissions)
- `ack0` = no ACK needed
- `prio0`/`q0` = Linux priority / FPGA queue
- `wr19 rd18` = ring write/read indices

**Reading a TX-interrupt print:**

```text
openwifi_tx_interrupt: tx_result [nof_retx 1 pass 1] SC20 prio0 q0 wr20 rd19 num_slot0 cw0 hwq len... no_room_flag0
```

- `nof_retx 1` = one transmission total
- `pass 1` = ACK received
- `num_slot` = CSMA slots waited
- `cw` = contention-window exponent (6 ⇒ CW 64, 0 ⇒ never contended)
- `hwq len` = current FPGA queue length
- `no_room_flag` = FPGA queue DMA nearly full

**Reading an RX print:**

```text
openwifi_rx: 270B ht0aggr0/0 sgi0 240M FC0080 DI0000 ADDR.../00c88b113f5f/00c88b113f5f SC2133 fcs1 buf_idx10 -78dBm
```

- `ht0` = legacy 11a/g (`ht1` = 11n)
- `aggr0/0` = not from an AMPDU / not the last AMPDU subframe
- `sgi0` = normal guard interval
- `240M` = 24 Mbps
- `fcs1` = CRC OK (`fcs0` = bad)
- `-78dBm` = calibrated signal strength

### Native Linux tools

`tcpdump`, `tshark`, and Wireshark all work over `sdr0` exactly as with a commercial card, and are often the quickest way to see what's on the air.

### FPGA ILA

For FPGA-internal signals, build with the ILA/debug macros enabled and use Xilinx ILA to watch the state machines in `xpu`, `tx_intf`, and `rx_intf`. See [FPGA Development → Debugging on hardware](FPGA-Development.md#debugging-on-hardware).

## Still stuck?

Check the [openwifi discussions](https://github.com/open-sdr/openwifi/discussions) and [issues](https://github.com/open-sdr/openwifi/issues), the [mailing list](https://lists.ugent.be/wws/subscribe/openwifi), and the [Tips for Windows users](https://github.com/open-sdr/openwifi/discussions/341) thread. See [FAQ and Resources](FAQ-and-Resources.md) for the full list of community channels.
