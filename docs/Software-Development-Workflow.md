# Software Development Workflow

This page covers the software side of hacking on openwifi: rebuilding the driver, updating a running board without rebooting, rebuilding `sdrctl`, and building a full SD-card image from scratch. FPGA rebuilds are on the [FPGA Development](FPGA-Development.md) page.

A recurring theme: the prebuilt SD image may lag the repo, so **copy the latest `user_space/` files onto the board** before doing serious work, and rebuild the driver against the matching kernel.

## Environment setup

Most host-side build steps expect these environment variables (use absolute paths):

```bash
export XILINX_DIR=/opt/Xilinx                 # dir containing Vitis/, Vivado/, etc.
export OPENWIFI_HW_IMG_DIR=/path/to/openwifi-hw-img
export BOARD_NAME=zed_fmcs2                    # your board
```

For driver builds you also need Vivado/Vitis installed (the driver is cross-compiled with the kernel toolchain) and a few packages:

```bash
sudo apt install flex bison libssl-dev device-tree-compiler u-boot-tools -y
```

Throughout, **`ARCH_BIT`** is `32` for Zynq-7000 boards and `64` for Zynq MPSoC (ZCU102).

For the exact toolchain, kernel, and image versions these builds expect, see [Versions this wiki targets](Repositories.md#versions-this-wiki-targets).

## Rebuilding the driver

1. Prepare the Analog Devices kernel source once (this is what the driver builds against):

   ```bash
   cd openwifi/user_space
   ./prepare_kernel.sh $XILINX_DIR ARCH_BIT
   ```

2. Compile the driver:

   ```bash
   cd openwifi/driver
   ./make_all.sh $XILINX_DIR ARCH_BIT
   # Extra args beyond these two become "#define" macros in pre_def.h
   # for conditional compilation (see below).
   ```

3. Copy the `.ko` files to the board:

   ```bash
   cd openwifi/driver
   scp `find ./ -name \*.ko` root@192.168.10.122:openwifi/
   ```

4. On the board, `./wgd.sh` loads the new driver (and reloads the FPGA image if `system_top.bit.bin` is present in the same directory).

> **Symbol/version errors on load** usually mean the kernel in the SD image is older than the one your driver was built against. Fix it by putting the freshly built kernel image into the `BOOT` partition: `adi-linux/arch/arm/boot/uImage` (32-bit) or `adi-linux-64/arch/arm64/boot/Image` (64-bit).

### Conditional compilation

Passing extra arguments to `make_all.sh` turns them into `#define` macros in `pre_def.h`, so you can gate driver code blocks per build. Combined with the FPGA's equivalent Verilog-macro mechanism, this is how you produce feature variants. See [dynamic reloading](#reloading-driver-and-fpga-without-rebooting) for a clean way to keep several variants side by side.

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

## Updating the FPGA image on a running board

If you just want to swap the FPGA bitstream (built elsewhere, or taken from `openwifi-hw-img`) without a full rebuild:

```bash
cd openwifi/user_space
./boot_bin_gen.sh $XILINX_DIR $BOARD_NAME $OPENWIFI_HW_IMG_DIR/boards/$BOARD_NAME/sdk/system_top.xsa
scp ./system_top.bit.bin root@192.168.10.122:openwifi/
```

Once `system_top.bit.bin` is in the board's `openwifi/` directory, `wgd.sh` will load it before loading the driver.

## Reloading driver and FPGA without rebooting

This is the workflow that makes iteration fast. `wgd.sh` can reload the driver and/or FPGA live and switch between different builds with no reboot and no power cycle. Keep your on-board files current with `user_space/` to use it.

**Driver only.** Ensure `system_top.bit.bin` is *not* in the directory; `wgd.sh` then loads just the `.ko` files.

**Driver + FPGA.** Generate the reloadable bitstream and put it beside the driver files:

```bash
cd openwifi/user_space
./drv_and_fpga_package_gen.sh $OPENWIFI_HW_IMG_DIR $XILINX_DIR $BOARD_NAME
# produces system_top.bit.bin AND drv_and_fpga.tar.gz
```

Then run `./wgd.sh` on the board as usual.

**From a target directory.** Put a driver+FPGA set in its own directory and load it explicitly, so different versions live in different directories:

```bash
./wgd.sh $TARGET_DIR
```

**From a single package file (recommended).** `drv_and_fpga_package_gen.sh` also bundles everything into `drv_and_fpga.tar.gz` (driver `.ko`s, FPGA image, and related source). Rename it meaningfully per branch/variant and load it directly:

```bash
./wgd.sh ./drv_and_fpga_myvariant.tar.gz
```

This makes it trivial to keep, ship, and switch between variants. To build a variant, either work on a separate branch, or use conditional-compile arguments (driver `make_all.sh` extra args; FPGA Verilog macros) and rename the package to record which options are on. Note: `drv_and_fpga_package_gen.sh` calls `make_all.sh` without extra args by default, so if you rely on conditional-compile flags, add them there too.

**Full `wgd.sh` usage** (also via `./wgd.sh -h`): a numeric first argument sets `test_mode`; `remote` downloads then loads (optionally into a target dir); a directory name loads from that directory; a `.tar.gz` is unpacked and loaded. A trailing argument sets `test_mode`.

### test_mode

`insmod sdr.ko test_mode=<value>` (or passing the value to `wgd.sh`/`fosdem.sh`) toggles experimental features via the `test_mode` global in `sdr.c`. Currently **bit0 = A-MPDU aggregation on/off** (default off). That's why `./wgd.sh 1` gives you aggregation.

## Bulk update helpers

For larger updates (kernel, modules, device tree, rootfs) there are paired host/board scripts:

- **Kernel + modules + device tree:** host-side `prepare_kernel.sh`, `boot_bin_gen.sh`, `transfer_kernel_image_module_to_board.sh`; board-side `populate_kernel_image_module_reboot.sh` (run it again after the first reboot if the kernel *version* changed, so symlinks point at the new version).
- **Driver + user space:** host-side `make_all.sh` + `transfer_driver_userspace_to_board.sh`; board-side `populate_driver_userspace.sh`.
- **Over FTP:** stand up an anonymous FTP server on the PC rooted at your `openwifi` directory, then on the board `./sdcard_boot_update.sh $BOARD_NAME` (pulls `uImage`, `BOOT.BIN`, `devicetree.dtb` into the boot partition, then power-cycle) and `./wgd.sh remote` (pulls driver files and brings up `sdr0`).
- **rootfs as a disk:** on the PC, *File manager → Connect to Server → `sftp://root@192.168.10.122/root`* (password `openwifi`).
- Refreshing the ADI rootfs tools is also worthwhile: on the board, clone `linux_image_ADI-scripts`, `apt update`, then run `adi_update_tools.sh` (see the [ADI Kuiper update guide](https://wiki.analog.com/resources/tools-software/linux-software/kuiper-linux/update)).

## Building a full SD image from scratch

Two base operating systems are supported, **ADI Kuiper** (Debian/Ubuntu-like) and **OpenWrt** (router-style with LuCI). The full step-by-step for both — flashing the base image, the rootfs edits, `update_sdcard.sh`, and the OpenWrt Docker build — is on the dedicated [Building SD Images](Building-SD-Images.md) page. Kuiper builds want Vivado 2022.2 (with Vitis) and the `flex bison libssl-dev device-tree-compiler u-boot-tools` packages; the OpenWrt build needs only Docker.
