# Software Development Workflow

This page covers the software side of openwifi development: rebuilding and deploying the driver, `sdrctl`, and the other `user_space/` tools. Building the FPGA bitstream and turning it into a loadable image are on the [FPGA Development](FPGA-Development.md) page. This page picks up at getting things onto the board.

The prebuilt SD image may be older than the current repo, so **copy the latest `user_space/` files onto the board** before doing serious work, and rebuild the driver against the matching kernel.

If you are in the middle of editing code and want the steps, start with the [quick reference](#quick-reference-from-code-change-to-running-board) below and follow its links for detail.

## Environment setup

Set up the shared host toolchain first: see [Environment Setup](Development-Environment-Setup.md) for the Vivado/Vitis install and the Ubuntu build packages. The software builds use all four variables:

```bash
export XILINX_DIR=/opt/Xilinx                 # dir containing Vitis/, Vivado/, etc.
export OPENWIFI_HW_IMG_DIR=/path/to/openwifi-hw-img
export BOARD_NAME=zed_fmcs2                    # your board
export ARCH_BIT=32                             # 32 for Zynq-7000, 64 for Zynq UltraScale+ (e.g. ZCU102)
```

For the exact toolchain, kernel, and image versions these builds expect, see [Versions this wiki targets](Repositories.md#versions-this-wiki-targets).

## Quick reference: from code change to running board

Find the row that matches what you changed and follow its link to the full instructions. The commands assume the usual setup: sources on your PC, the board reachable at `192.168.10.122`, and the [environment variables](#environment-setup) set.

| You changed | Rebuild & deploy | Take effect |
| --- | --- | --- |
| **Driver C code** (`driver/`, including `driver/side_ch/`) | On the PC: `cd driver && ./make_all.sh $XILINX_DIR $ARCH_BIT`, then `scp` the `.ko` files to the board's `openwifi/` directory | `./wgd.sh` on the board, no reboot needed ([details](#rebuilding-the-driver)) |
| **`sdrctl` source** (`user_space/sdrctl_src/`) | `scp` the source to the board, then compile **on the board** with `make` | The new binary replaces `openwifi/sdrctl` immediately ([details](#rebuilding-sdrctl)) |
| **`side_ch_ctl` source** (`user_space/side_ch_ctl_src/`) | `scp` the source to the board, then **on the board**: `gcc -o side_ch_ctl side_ch_ctl.c` | Run it. If you also changed `side_ch.ko`, reload that like any other driver module ([details](side_ch_ctl-and-the-Side-Channel.md#building)) |
| **`inject_80211` / `analyze_80211`** (`user_space/inject_80211/`) | `scp` the source to the board, then **on the board**: `make` | Run it ([usage](Operating-Modes.md#packet-injection-and-fuzzing)) |
| **Helper scripts** (`user_space/*.sh`, `*.py`) | Nothing to compile. Copy them to the board with `scp`. The Python display scripts (`side_info_display.py`, `iq_capture.py`, and others) run on the PC instead | Run them |
| **FPGA Verilog / IP cores** | On the PC: rebuild the bitstream ([FPGA Development](FPGA-Development.md)), then `boot_bin_gen.sh` and `scp system_top.bit.bin` to the board | `./wgd.sh`, no reboot needed ([details](FPGA-Development.md#updating-the-fpga-image-on-a-running-board)) |
| **Kernel config or device tree** | Rebuild on the PC, then transfer and populate on the board. Full step-by-step in [Updating a board to a newly built kernel](Boot-Kernel-Device-Tree.md#updating-a-board-to-a-newly-built-kernel), short form under [bulk helpers](#bulk-update-helpers) | Reboot. A kernel **version** change also needs the driver rebuilt and the populate script run twice |

### The driver iteration loop

The most common cycle is changing driver code and testing it on the board. Once set up, each round takes less than a minute.

**One-time setup** (per PC / per kernel version):

1. Set the [environment variables](#environment-setup) and install the build packages.
2. Prepare the kernel source the driver builds against: `cd openwifi/user_space && ./prepare_kernel.sh $XILINX_DIR $ARCH_BIT`.

**Each round:**

1. Edit the driver code on the PC.
2. Compile: `cd openwifi/driver && ./make_all.sh $XILINX_DIR $ARCH_BIT` (add extra args for [conditional-compile macros](#conditional-compilation)).
3. Copy to the board: ``scp `find ./ -name \*.ko` root@192.168.10.122:openwifi/``.
4. On the board: `./wgd.sh` reloads the modules live. Make sure `system_top.bit.bin` is **not** in the directory unless you also want the FPGA image reloaded ([details](#reloading-driver-and-fpga-without-rebooting)).
5. Check it loaded: `dmesg | tail -20` should show the driver initializing without symbol/version errors (if it does show them, see [the note on kernel mismatch](#rebuilding-the-driver)), and `ip a` should list `sdr0`.
6. Reloading recreates `sdr0` from scratch, so restart whatever mode you were in: AP (`hostapd` / `fosdem.sh`), client (`wpa_supplicant`), or your monitor-mode setup ([Operating Modes](Operating-Modes.md)).

For print-style debugging, add `printk` calls in the driver and watch them live on the board with `dmesg -w` in a second ssh session.

## Rebuilding the driver

1. Prepare the Analog Devices kernel source once (this is what the driver builds against):

   ```bash
   cd openwifi/user_space
   ./prepare_kernel.sh $XILINX_DIR $ARCH_BIT
   ```

2. Compile the driver:

   ```bash
   cd openwifi/driver
   ./make_all.sh $XILINX_DIR $ARCH_BIT
   # Extra args beyond these two become "#define" macros in pre_def.h
   # for conditional compilation (see below).
   ```

3. Copy the `.ko` files to the board:

   ```bash
   cd openwifi/driver
   scp `find ./ -name \*.ko` root@192.168.10.122:openwifi/
   ```

4. On the board, `./wgd.sh` loads the new driver (and reloads the FPGA image if `system_top.bit.bin` is present in the same directory).

!!! warning "Symbol/version errors on load mean a kernel mismatch"
    The kernel in the SD image is usually older than the one your driver was built against. Fix it by putting the freshly built kernel image into the `BOOT` partition: `adi-linux/arch/arm/boot/uImage` (32-bit) or `adi-linux-64/arch/arm64/boot/Image` (64-bit).

### Conditional compilation

Passing extra arguments to `make_all.sh` turns them into `#define` macros in `pre_def.h`, so you can gate driver code blocks per build. Combined with the FPGA's equivalent Verilog-macro mechanism, this is how you produce feature variants. See [dynamic reloading](#reloading-driver-and-fpga-without-rebooting) for a clean way to keep several variants side by side.

## Reloading driver and FPGA without rebooting

`wgd.sh` can reload the driver and/or FPGA live and switch between different builds with no reboot and no power cycle. Keep your on-board files current with `user_space/` to use it.

**Driver only.** Ensure `system_top.bit.bin` is *not* in the directory. `wgd.sh` then loads just the `.ko` files.

**Driver + FPGA.** Generate the reloadable bitstream and put it beside the driver files (the `.xsa` input comes from the FPGA build, see [FPGA Development](FPGA-Development.md#updating-the-fpga-image-on-a-running-board)):

```bash
cd openwifi/user_space
./drv_and_fpga_package_gen.sh $OPENWIFI_HW_IMG_DIR $XILINX_DIR $BOARD_NAME
# produces system_top.bit.bin AND drv_and_fpga.tar.gz
```

Then run `./wgd.sh` on the board as usual.

**From a single package file (recommended).** `drv_and_fpga_package_gen.sh` also bundles everything into `drv_and_fpga.tar.gz` (driver `.ko`s, FPGA image, and related source). Rename it meaningfully per branch/variant and load it directly:

```bash
./wgd.sh ./drv_and_fpga_myvariant.tar.gz
```

This makes it easy to keep, share, and switch between variants. To build a variant, either work on a separate branch, or use conditional-compile arguments (driver `make_all.sh` extra args, FPGA Verilog macros) and rename the package to record which options are on. Note: `drv_and_fpga_package_gen.sh` calls `make_all.sh` without extra args by default, so if you rely on conditional-compile flags, add them there too.

**From a target directory.** Put a driver+FPGA set in its own directory and load it explicitly, so different versions live in different directories:

```bash
./wgd.sh $TARGET_DIR
```

**Full `wgd.sh` usage** (also shown by `./wgd.sh -h`):

- no argument: load the driver `.ko` files and the FPGA image (if `system_top.bit.bin` exists) from the current directory, with `test_mode=0`
- a numeric first argument is assigned to `test_mode` (loads everything from the current directory)
- `remote` downloads the files and then loads them. An optional second argument names the target directory, an optional third sets `test_mode`
- any other first argument that is not a `.tar.gz` file is treated as a directory to load from. An optional second argument sets `test_mode`
- a `.tar.gz` file is unpacked and loaded from the unpacked directory. An optional second argument sets `test_mode`

### test_mode

`insmod sdr.ko test_mode=<value>` (or passing the value to `wgd.sh`/`fosdem.sh`) toggles experimental features via the `test_mode` global in `sdr.c`. Two bits are in use: **bit0 = A-MPDU aggregation on/off** (default off), which is why `./wgd.sh 1` gives you aggregation, and **bit1 = advertise short guard interval**, which only the driver source documents. See [Wi-Fi 4 & Wi-Fi 6 Features](Wi-Fi-4-and-Wi-Fi-6.md#short-guard-interval) for both in practice.

## Rebuilding sdrctl

`sdrctl` is compiled **on the board**:

```bash
# from host, push the source:
cd openwifi/user_space/sdrctl_src
scp `find ./ -name \*` root@192.168.10.122:openwifi/sdrctl_src/
```

```bash
# on the board:
cd ~/openwifi/sdrctl_src/ && make clean && make && cp sdrctl ../ && cd ..
```

## Bulk update helpers

For larger updates (kernel, modules, device tree, rootfs) there are paired host/board scripts:

- **Kernel + modules + device tree:** on the host, `prepare_kernel.sh`, `boot_bin_gen.sh`, and `transfer_kernel_image_module_to_board.sh`. On the board, `populate_kernel_image_module_reboot.sh` (run it again after the first reboot if the kernel *version* changed, so symlinks point at the new version). The whole flow, with the verification steps that get you back to a working `sdr0`, is written out in [Updating a board to a newly built kernel](Boot-Kernel-Device-Tree.md#updating-a-board-to-a-newly-built-kernel).
- **Driver + user space:** on the host, `make_all.sh` and `transfer_driver_userspace_to_board.sh`. On the board, `populate_driver_userspace.sh`.
- **Over FTP:** set up an anonymous FTP server on the PC rooted at your `openwifi` directory, then on the board `./sdcard_boot_update.sh $BOARD_NAME` (pulls `uImage`, `BOOT.BIN`, `devicetree.dtb` into the boot partition, then power-cycle) and `./wgd.sh remote` (pulls driver files and brings up `sdr0`).
- **rootfs as a disk:** on the PC, *File manager → Connect to Server → `sftp://root@192.168.10.122/root`* (password `openwifi`).
- Refreshing the ADI rootfs tools is also worthwhile: on the board, clone `linux_image_ADI-scripts`, `apt update`, then run `adi_update_tools.sh` (see the [ADI Kuiper update guide](https://wiki.analog.com/resources/tools-software/linux-software/kuiper-linux/update)).

## Building a full SD image from scratch

Two base operating systems are supported, **ADI Kuiper** (Debian/Ubuntu-like) and **OpenWrt** (router-style with LuCI). The full step-by-step for both (flashing the base image, the rootfs edits, `update_sdcard.sh`, and the OpenWrt Docker build) is on the dedicated [Building SD Images](Building-SD-Images.md) page. Kuiper builds need Vivado 2022.2 (with Vitis) and the `flex bison libssl-dev device-tree-compiler u-boot-tools` packages. The OpenWrt build only needs Docker.
