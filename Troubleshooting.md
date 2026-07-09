# Troubleshooting and Known Issues

Grouped by symptom. When networking won't come up at all, a **USB-UART serial console** is your best friend — it shows you the boot messages that ssh can't. The authoritative, continuously updated list is the [known-issue note](https://github.com/open-sdr/openwifi/blob/master/doc/known_issue/notter.md); this page reorganizes it and adds the debugging tools.

## Boot and networking

**Can't ssh to the board on first boot.** Delete `/etc/network/interfaces.new` from the SD card's `rootfs` partition (on your PC). If it still fails, use the UART console (`/dev/ttyUSBx`, `/dev/ttyCH341USBx`, …) to watch the boot.

**No UART console device appears** (antsdr e200 and similar CH341 adapters). Try `sudo apt remove brltty` — brltty grabs the CH341 device. (Reference: the [CH341SER notes](https://github.com/juliagoda/CH341SER).)

**`EXT4-fs error (device mmcblk0p2)` on first boot** (seen on neptunesdr). The flashing tool is suspect — re-flash with a different one (gnome-disks, Startup Disk Creator, or win32diskimager).

**ZCU102 kernel panic: "Unable to mount root fs on unknown-block(179,2)."** The same SD card boots on some ZCU102 units but not others; the SD interface likely needs to run slower. Add these to the mmc/sdhci node of the ZCU102 device tree to cap the speed:

```
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

**Board won't boot at all (SPI flash suspected).** The on-board SPI flash holds some config (kernel file, AD9361 crystal frequency `ad9361_ext_refclk=0x2625a8b`). Interrupt boot in the UART console (press Enter before Linux loads) and reset the environment:

```
Zynq> env default -a
Zynq> saveenv
```

**Wrong memory size on ADRV9361-Z7035 SoM** (Linux sees half the RAM). An old `u-boot.elf` hard-coded 512 MB. Rebuild u-boot from [analogdevicesinc/u-boot-xlnx](https://github.com/analogdevicesinc/u-boot-xlnx) (`make zynq_adrv9361_defconfig && make -j8 && make u-boot.elf`) and regenerate `BOOT.BIN`.

## Client / link problems

**Client connects but gets no IP.** Restart the DHCP server on the board and reconnect from the client:

```bash
service isc-dhcp-server restart
```

**Big packet loss at slow ping, but fine at fast ping.** The *other* device's Wi-Fi power save is the usual culprit — it sleeps between your infrequent packets. Turn it off on that device:

```bash
iw dev wlan0 get power_save
sudo iw dev wlan0 set power_save off
```

**Ping-by-hostname fails (DNS).** Set `nameserver 8.8.8.8` in `/etc/resolv.conf` on the board.

**Reception dies after ~2 hours; `sdrctl dev sdr0 get reg rx 20` is frozen.** This is the **Xilinx Viterbi decoder evaluation license** halting — expected behavior, not a bug. Reload the FPGA (see [dynamic reloading](Software-Development-Workflow.md#reloading-driver-and-fpga-without-rebooting)) or power-cycle. A proper license removes the limit.

## Hardware quirks

**FMCOMMS board causes a Linux crash (bad/empty EEPROM).** Some FMCOMMS2/3/4 boards ship with a wrong or empty FRU EEPROM, which crashes some platforms (notably ZCU102). Reprogram it with [fru_tools](https://github.com/analogdevicesinc/fru_tools): boot the FMCOMMS board on a platform that *does* come up (e.g. a 32-bit zed/zc706/zc702), build `fru_tools`, locate the EEPROM (`find /sys -name eeprom`), confirm the mismatch with `fru-dump -i <eeprom> -b`, then write the correct master file, e.g.:

```bash
fru-dump -i ./masterfiles/AD-FMCOMMS4-EBZ-FRU.bin -o /sys/.../0-0050/eeprom
```

Reboot and re-read to confirm.

**`Unsupported PRODUCT_ID 0xFF`** at AD9361 probe — same root cause as above (EEPROM/FRU). See the fru_tools references.

**ZCU102 kernel panic due to RTC / panic due to hardware capacitor & current load.** Tracked upstream: [#366](https://github.com/open-sdr/openwifi/issues/366) and [#457](https://github.com/open-sdr/openwifi/issues/457).

## Storage and long-run stability

**"No space left on device"** (journald can't write). Logs filled the disk. Clean up and cap journald:

```bash
systemd-tmpfiles --clean
sudo systemd-tmpfiles --remove
rm /var/log/* -rf
apt --autoremove purge rsyslog
```

Then add to `/etc/systemd/journald.conf`:

```
SystemMaxUse=64M
Storage=volatile
RuntimeMaxUse=64M
ForwardToConsole=no
ForwardToWall=no
```

**Instability after a long uptime.** `lightdm` has a memory leak; disable it via `systemctl` if you don't need the desktop.

## Build-host problems

**Kernel config prompts for new options (GCC plugins, stack canary, Xen…).** After a host toolchain or minor kernel bump, new Kconfig options may appear during a kernel build. Choose **n** / the weakest option for these to avoid build failures or subtle issues.

**`libidn.so.11` missing while running `boot_bin_gen.sh`.** Symlink your installed version (confirm the exact filename first):

```bash
sudo ln -s /usr/lib/x86_64-linux-gnu/libidn.so.12.6.3 /usr/lib/x86_64-linux-gnu/libidn.so.11
```

**Vitis HLS: `'2xxxxxxxxx' is an invalid argument`** during `create_ip_repo.sh`. Apply [Xilinx article 76960](https://support.xilinx.com/s/article/76960).

**Ubuntu 24: FPGA tools need `libtinfo5`** (default is `libtinfo6`). Install it manually — see [FPGA Development prerequisites](FPGA-Development.md#prerequisites).

## OpenWrt-specific

**No UART output on ZCU102 under OpenWrt.** Support was validated only on **ZCU102 HW Rev 1.1**, and even then some 4 GB SODIMM modules fail with the U-Boot SPL bootflow. Known-good module: `MTA8ATF51264HZ-2G6B1`; known-failing: `MTA4ATF51264HZ-2G6E1`. The robust fix is to use the **Zynq FSBL instead of U-Boot SPL** (FSBL reads the module's SPD EEPROM and configures DDR correctly), via the repo's `build_zynqmp_boot_bin.sh` or by generating `boot.bin` yourself with OpenWrt-built components. Full analysis is in the [known-issue note](https://github.com/open-sdr/openwifi/blob/master/doc/known_issue/notter.md#no-uart-output-on-zcu102).

## Debugging tools

### Driver dmesg logging

Turn on per-event driver prints (then read them with `dmesg`):

```bash
./sdrctl dev sdr0 set reg drv_tx 7 X
./sdrctl dev sdr0 set reg drv_rx 7 X
```

`X` is a bitmask: bit0 = errors, bit1 = regular unicast messages (`openwifi_tx`/`openwifi_tx_interrupt`/`openwifi_rx_interrupt`), bit2 = broadcast messages, bit3 = queue stop/wake messages. E.g. `3` = errors + unicast; `1` = errors only. Search `printk` in `sdr.c` to see every print point.

**Reading a TX print:**

```
openwifi_tx: 70B RC0 10M FC0040 DI0000 ADDRffff.../6655443322aa/ffff... flag4001201e QoS00 SC20_1 retr1 ack0 prio0 q0 wr19 rd18
```

`70B` = length; `10M` = requested rate (1 Mbps 11b, which openwifi converts to 6 Mbps OFDM); `FC0040` = Frame Control; `ADDR` = addr1/2/3; `SC20_1` = sequence number 20, set by the driver; `retr1` = no retransmission needed (`retrN` = up to N transmissions); `ack0` = no ACK needed; `prio0`/`q0` = Linux priority / FPGA queue; `wr19 rd18` = ring write/read indices.

**Reading a TX-interrupt print:**

```
openwifi_tx_interrupt: tx_result [nof_retx 1 pass 1] SC20 prio0 q0 wr20 rd19 num_slot0 cw0 hwq len... no_room_flag0
```

`nof_retx 1` = one transmission total; `pass 1` = ACK received; `num_slot` = CSMA slots waited; `cw` = contention-window exponent (6 ⇒ CW 64; 0 ⇒ never contended); `hwq len` = current FPGA queue length; `no_room_flag` = FPGA queue DMA nearly full.

**Reading an RX print:**

```
openwifi_rx: 270B ht0aggr0/0 sgi0 240M FC0080 DI0000 ADDR.../00c88b113f5f/00c88b113f5f SC2133 fcs1 buf_idx10 -78dBm
```

`ht0` = legacy 11a/g (`ht1` = 11n); `aggr0/0` = not from an AMPDU / not the last AMPDU subframe; `sgi0` = normal guard interval; `240M` = 24 Mbps; `fcs1` = CRC OK (`fcs0` = bad); `-78dBm` = calibrated signal strength.

### Native Linux tools

`tcpdump`, `tshark`, and Wireshark all work over `sdr0` exactly as with a commercial card — often the quickest way to see what's on the air.

### FPGA ILA

For FPGA-internal signals, build with the ILA/debug macros enabled and use Xilinx ILA to watch the state machines in `xpu`, `tx_intf`, and `rx_intf`. See [FPGA Development → Debugging on hardware](FPGA-Development.md#debugging-on-hardware).

## Still stuck?

Check the [openwifi discussions](https://github.com/open-sdr/openwifi/discussions) and [issues](https://github.com/open-sdr/openwifi/issues), the [mailing list](https://lists.ugent.be/wws/subscribe/openwifi), and the [Tips for Windows users](https://github.com/open-sdr/openwifi/discussions/341) thread. See [FAQ and Resources](FAQ-and-Resources.md) for the full list of community channels.
