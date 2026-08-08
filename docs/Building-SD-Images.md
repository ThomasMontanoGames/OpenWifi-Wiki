# Building SD Images

openwifi boots from an SD card running one of two base operating systems, and you can build either from scratch:

- **ADI Kuiper**: a Debian/Ubuntu-like image (the classic openwifi environment, and what the `fosdem.sh` demo and most app notes assume).
- **OpenWrt**: a router-style image with the LuCI web UI, with openwifi packaged as a kernel module.

!!! tip "You may not need to build anything"
    Prebuilt images exist for both. If you just want a working board, flash a prebuilt image as in [Getting Started](Getting-Started.md) (Kuiper) or the [OpenWrt quick start](#openwrt-quick-start-prebuilt-image) below. Build from scratch when you need a custom kernel, a new board, or an image you control end to end.

The builds below assume you understand the [boot chain and device tree](Boot-Kernel-Device-Tree.md). For the driver/dev loop see [Software Development Workflow](Software-Development-Workflow.md).

## Which one should I build?

| | ADI Kuiper | OpenWrt |
|---|---|---|
| Feels like | A small Debian/Ubuntu box | A Wi-Fi router (LuCI web UI) |
| Best for | Research, the app-note workflows, full apt tooling | Router use cases |
| Build needs | Vivado 2022.2 + Vitis | Docker only (no Vivado) |
| openwifi tools | Built on the board | Packaged into the image (in `$PATH`) |

---

## ADI Kuiper: build from scratch

### Prerequisites

- **Vivado 2022.2 with Vitis** installed (you need `.../Vitis`, not `Vitis_HLS`).
- An SD card of **16 GB or more**.
- Host packages:

    ```bash
    sudo apt install flex bison libssl-dev device-tree-compiler u-boot-tools -y
    ```

- The usual environment variables (`XILINX_DIR`, `OPENWIFI_HW_IMG_DIR`, `BOARD_NAME`) set as in [Environment Setup](Development-Environment-Setup.md#environment-variables).

### 1. Flash the ADI Kuiper base image

Download the **"13 December 2023 release (2022_r2)"** (`image_2023-12-13-ADI-Kuiper-full.zip`) from the [ADI Kuiper page](https://wiki.analog.com/resources/tools-software/linux-software/kuiper-linux?redirect=1) and extract the `.img`. Flash it:

```bash
# Check the real sector count first: fdisk -l 2023-12-13-ADI-Kuiper-full.img
sudo dd bs=512 count=24182784 if=2023-12-13-ADI-Kuiper-full.img of=/dev/your_sdcard_dev
```

### 2. Edit the rootfs config files

Mount the card's `BOOT` and `rootfs` partitions on your PC and make these edits.

Add a static `eth0` to `rootfs/etc/network/interfaces`:

```text
auto lo
iface lo inet loopback
auto eth0
iface eth0 inet static
address 192.168.10.122
gateway 192.168.10.1
netmask 255.255.255.0
network 192.168.10.0
broadcast 192.168.10.255
```

Enable IP forwarding in `rootfs/etc/sysctl.conf`:

```text
net.ipv4.ip_forward=1
```

Speed up shutdown in `rootfs/etc/systemd/system.conf`:

```text
DefaultTimeoutStopSec=2s
```

Copy the udev rule that names the network device:

```bash
cp openwifi/kernel_boot/10-network-device.rules rootfs/etc/udev/rules.d/
```

### 3. Run `update_sdcard.sh`

From `openwifi/user_space`, run `update_sdcard.sh` with the mount point that holds `BOOT` and `rootfs` as its last argument:

```bash
cd openwifi/user_space
./update_sdcard.sh $OPENWIFI_HW_IMG_DIR $XILINX_DIR $SDCARD_DIR
```

It builds and copies onto the card:

- the **kernel image**: `adi-linux-64/arch/arm64/boot/Image` (64-bit) or `adi-linux/arch/arm/boot/uImage` (32-bit)
- the **device tree**: `kernel_boot/boards/zcu102_fmcs2/system.dtb` (64-bit) or `kernel_boot/boards/$BOARD_NAME/devicetree.dtb` (32-bit)
- **`BOOT.BIN`**: from `kernel_boot/boards/$BOARD_NAME/output_boot_bin/BOOT.BIN`
- the openwifi **driver**, and the **`user_space` + `webserver`** files.

(See [Boot, Kernel & Device Tree](Boot-Kernel-Device-Tree.md) for how those three artifacts are built.)

### 4. Configure the board files and first boot

Still on your PC, configure the `BOOT` partition for **the specific board you have**:

- Copy everything from `BOOT/openwifi/<board_name>/` into the root of the `BOOT` partition.
- Delete `rootfs/root/kernel_modules` if it exists.
- Delete `rootfs/etc/network/interfaces.new` if it exists.

Then insert the card, set the board to SD-boot mode, connect antennas, and power on. Wire Ethernet to a PC at static IP **192.168.10.1** and log in. The ADI base image's initial password is **`analog`** (a prebuilt openwifi card would already be `openwifi`):

```bash
ssh root@192.168.10.122
passwd            # change it to openwifi
```

If login fails, see [Troubleshooting](Troubleshooting.md#boot-and-networking). Enlarge the root partition (only needed if your SD card is larger than 16 GB) and reboot:

```bash
raspi-config --expand-rootfs
reboot now
```

### 5. Give the board internet (needed for the next step)

The on-board package installs need internet, routed through your PC. **On the PC:**

```bash
sudo sysctl -w net.ipv4.ip_forward=1
sudo iptables -t nat -A POSTROUTING -o <internet_nic> -j MASQUERADE
sudo ip route add 192.168.13.0/24 via 192.168.10.122 dev <board_nic>
```

Then confirm connectivity **on the board**:

```bash
route add default gw 192.168.10.1
ping <some_host_you_know>
```

Resolve any connectivity problem before continuing. (To make forwarding persistent on the PC, uncomment `net.ipv4.ip_forward=1` in `/etc/sysctl.conf`.)

### 6. Install tools and build the on-board utilities

In the board's ssh session (set the clock first with `date -s` if needed):

```bash
sudo apt update
chmod +x /root/openwifi/*.sh

# DHCP server
sudo apt-get -y install isc-dhcp-server
cp /root/openwifi/dhcpd.conf /etc/dhcp/dhcpd.conf

# useful tools
sudo apt-get -y install hostapd tcpdump webfs iperf iperf3 libpcap-dev bridge-utils

# build the on-board tools
sudo apt-get -y install libnl-3-dev libnl-genl-3-dev
cd /root/openwifi/sdrctl_src && make clean && make && cp sdrctl ../
cd /root/openwifi/side_ch_ctl_src/ && gcc -o side_ch_ctl side_ch_ctl.c && cp side_ch_ctl ../
cd /root/openwifi/inject_80211/ && make clean && make && cd ..
```

### 7. Run openwifi

```bash
/root/openwifi/setup_once.sh    # once per new board (reboots)
cd /root/openwifi
./wgd.sh                         # "./wgd.sh 1" enables experimental 11n A-MPDU aggregation
ifconfig sdr0 up
iwlist sdr0 scan
./fosdem.sh                      # "./fosdem-11ag.sh" forces legacy 11a/g mode
```

Connect a phone or laptop to the **"openwifi"** SSID. You should get a `192.168.13.x` address, and browsing to `192.168.13.1` shows the on-board webserver page. A few things to know (same as the prebuilt-image flow):

- The demo defaults to **channel 44 (5 GHz)**. For a 2.4 GHz-only client, edit `hostapd-openwifi.conf` on the board and re-run `fosdem.sh`.
- The Xilinx **Viterbi decoder halts after ~2 hours** (evaluation license). Reload the FPGA or power-cycle to recover.
- The **ADRV9361-Z7035 has very low 5 GHz TX power**: keep nodes close on that board.

See [Getting Started → Start the access point](Getting-Started.md#4-start-the-access-point) for more on the bring-up, and [Research Features](Research-Features.md#csi-channel-state-information) to start capturing CSI.

!!! note "Faster paths"
    - **Prebuilt img:** flash the openwifi prebuilt `.img` (`dd bs=512 count=31116288 …`) and skip to step 4.
    - **Move a working card to a new board:** re-do the "configure the board files" step for the new `board_name` on an existing card.

---

## OpenWrt

OpenWrt packages openwifi as a kernel module and gives you the LuCI web UI. The build needs only Docker (no Vivado).

### Board support matrix

| Board | Supported | Tested |
|---|---|---|
| `zc706_fmcs2`, `zed_fmcs2`, `adrv9364z7020`, `adrv9361z7035` | ✅ | ✅ |
| `zcu102_fmcs2` | ✅ | ✅ ⚠️ (fails on some boards, see [Troubleshooting](Troubleshooting.md#no-uart-output-on-zcu102-under-openwrt)) |
| `zc702_fmcs2`, `antsdr`, `e310v2`, `antsdr_e200`, `sdrpi`, `neptunesdr` | ✅ | (untested) |

### OpenWrt quick start (prebuilt image)

This is the OpenWrt equivalent of the `fosdem.sh` demo.

1. Download the prebuilt image for your board from the [image folder](https://drive.google.com/drive/folders/1WPYVmLzPUZs_iNVyB7mI0ko44MRxQCDJ), then unzip and flash (example for `adrv9364z7020`):

    ```bash
    cd ~/Downloads && gunzip openwrt-zynq-generic-analog_devices_zynq-adrv9364-squashfs-sdcard.img.gz
    sudo dd if=~/Downloads/openwrt-zynq-generic-analog_devices_zynq-adrv9364-squashfs-sdcard.img of=/dev/mmcblk0 status=progress
    ```

2. Boot the board. After about a minute an **`openwrt-openwifi`** SSID appears on 2.4 GHz channel 1. Connecting gives you an IP but no internet yet.

3. Give the board (and its clients) internet through your PC. Connect Ethernet, and the board assigns your PC `192.168.10.1`. Find your interface names with `ip addr`, then run the script below. Its first argument is the PC's internet-facing interface, the second is the board-facing one:

    ```bash
    ./give_board_internet_access.sh wlan0 eth0
    ```

4. Reach **LuCI** at `http://192.168.10.122` (`http://openwrt.lan` should work too) from the PC, or `http://192.168.13.1` from a device on the `openwrt-openwifi` SSID. There is no password by default. Set one for any real use. Network → Wireless is where you tweak the radio:

    ![OpenWrt LuCI wireless configuration page](assets/img/openwrt-luci-wireless.png)

!!! warning "Research config, not a deployment config"
    The default OpenWrt network setup with the openwifi package is meant for research. For deployment, move `eth0` into the **wan** zone as a **DHCP client** (not a DHCP server) and assign the wireless network to **lan**.

### Build an OpenWrt image with openwifi

**Prerequisite:** Docker on a Linux host (Windows untested). Vivado is **not** required.

1. **Clone** the OpenWrt source with openwifi support (branch `openwrt-openwifi_v25.12.5` = OpenWrt v25.12.5, Linux 6.12, mac80211 v6.18):

    ```bash
    git clone --branch openwrt-openwifi_v25.12.5 https://github.com/open-sdr/openwrt-openwifi.git
    ```

2. **Build the container** ([OpenWrt's Docker guide](https://openwrt.org/docs/guide-user/virtualization/obtain.firmware.docker)):

    ```bash
    docker build --rm --tag openwrt:debian_12 --file ./Dockerfile ./openwrt-openwifi
    ```

3. **Start the container** (drops you into an interactive shell in the mounted source):

    ```bash
    ./start_docker_openwrt_build.sh
    ```

4. **Update package feeds** (pulls in the [openwifi packages feed](https://github.com/open-sdr/openwrt-openwifi-packages-feed)):

    ```bash
    ./scripts/feeds update
    ./scripts/feeds install -a
    ```

5. **Configure the build**, either from a provided default:

    ```bash
    cp configs/adrv9364z7020_defconfig .config
    ```

    …or manually with `make menuconfig`, selecting your **Architecture** (zynq or zynqmp), your **Board**, and the openwifi kernel module under **Kernel Modules → Wireless Drivers → Openwifi kernel package**:

    <div class="grid" markdown>
    ![menuconfig: Kernel Modules](assets/img/openwrt-menuconfig-kernel-modules.png)
    ![menuconfig: Wireless Drivers](assets/img/openwrt-menuconfig-wireless-drivers.png)
    </div>

    ![menuconfig: the Openwifi kernel package (kmod-openwifi)](assets/img/openwrt-menuconfig-kmod-openwifi.png)

    Handy extras: **Network → SSH → openssh-sftp-server** (enables `scp` to the board) and **Utilities → Editors → nano**.

6. **Build**, keeping the job count low (about 3) to avoid dependency-ordering errors (retry with fewer jobs if it fails):

    ```bash
    make -j3 V=sc
    ```

7. **Flash** the resulting image with the same `dd` procedure as the quick start (mind the different output path). Exit the container with `Ctrl+D` first.

!!! tip "Building for every board at once"
    `doc/img_build_instruction/openwrt/build_all_images.sh` in the openwifi repo repeats steps 5 to 7 for every `*_defconfig` in `openwrt-openwifi/configs/`, producing the whole set of prebuilt images in one run under `./output_images`.

### OpenWrt tips

- **Userspace tools are pre-installed.** The openwifi package puts all `user_space` files under `/root/openwifi` (so the app-note scripts work), and installs the compiled tools (`sdrctl`, `inject_80211`, `analyze_80211`, `side_ch_ctl`) into `/usr/bin`, so they're in `$PATH`.
- **Kernel modules are packed in.** No manual copying is needed, and `insmod side_ch` works directly.
- **SSH uses mDNS:** `ssh root@openwrt.lan`, no password by default.
- The app-note [IQ and CSI workflows](Research-Features.md) work on OpenWrt with minor differences (e.g. `insmod side_ch iq_len_init=4095`, then `side_ch_ctl` and the host-side Python display scripts as usual).

### Debugging the openwifi package

To iterate on the openwifi source without rebuilding from git each time, mount local sources into the container. Add to the `docker run` line in `start_docker_openwrt_build.sh`:

```bash
--volume "$(pwd)/openwifi:/openwifi" \
```

then point the package feed at a local checkout by editing OpenWrt's `feeds.conf.default` to replace the git openwifi feed with:

```text
src-link openwifi /openwrt-openwifi-packages-feed
```

You can also bind-mount the OpenWrt tree under `/workdir` so paths printed in the container are copy-pasteable on the host. OpenWrt-specific issues (including the ZCU102 UART/SODIMM problem) are collected in [Troubleshooting → OpenWrt-specific](Troubleshooting.md#openwrt-specific).

## Related pages

- [Getting Started](Getting-Started.md): flashing a prebuilt image and first bring-up.
- [Boot, Kernel & Device Tree](Boot-Kernel-Device-Tree.md): how the kernel, device tree, and `BOOT.BIN` that these builds install are produced.
- [Software Development Workflow](Software-Development-Workflow.md): driver rebuilds and the live reload loop.
- [Troubleshooting](Troubleshooting.md#boot-and-networking): boot and OpenWrt-specific issues.
