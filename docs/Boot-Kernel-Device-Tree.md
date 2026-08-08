# Boot, Kernel and Device Tree

This page explains how an openwifi board boots: the boot image, the kernel and its patches, and, in the most detail, the **device tree**. The device tree tells Linux where the FPGA blocks live, and it is the main thing you edit when porting to a new board.

If you only want to flash a card and run, see [Getting Started](Getting-Started.md). If you want to rebuild the driver or a full SD image, see [Software Development Workflow](Software-Development-Workflow.md). This page is for understanding and modifying the boot chain itself. All paths below are in the [openwifi](https://github.com/open-sdr/openwifi) repo under `kernel_boot/` unless noted.

If you already have a working board and only want to move it onto a newly built kernel and set of modules, go straight to [Updating a running board](#updating-a-running-board), which covers the whole path from a PC-side build to `sdr0` showing up in `ifconfig -a`, with the scripts or by hand.

## The boot chain at a glance

A Zynq board boots from the SD card's `BOOT` partition, which holds three things openwifi cares about:

```text
BOOT partition
├── BOOT.BIN         # FSBL + FPGA bitstream + U-Boot (+ ATF/PMUFW on 64-bit)
├── uImage / Image   # the Linux kernel
└── devicetree.dtb   # the hardware description Linux parses at boot
                     (rootfs lives on the second partition)
```

The sequence: the SoC's boot ROM loads **BOOT.BIN**, whose FSBL initializes DDR and clocks, programs the FPGA bitstream, and hands off to U-Boot, which loads the kernel and the device tree and starts Linux. Linux then reads the device tree to discover the FPGA's AXI peripherals (including openwifi's cores) and binds drivers to them.

<figure>
<svg viewBox="0 0 940 420" role="img" aria-label="The openwifi boot chain: the SoC boot ROM loads BOOT.BIN, whose stages run in order: FSBL (init DDR and clocks), then the FPGA bitstream (programs the PL), then U-Boot. U-Boot loads the Linux kernel (uImage / Image), which boots into a running Linux, and also loads the device tree blob (devicetree.dtb), which is not code but a hardware description that the running kernel reads. From the device tree the driver binds to the sdr,* FPGA nodes." style="width:100%;height:auto;max-width:940px;font-family:inherit;font-size:13px">
  <defs>
    <marker id="boot-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fill-opacity="0.6"/>
    </marker>
  </defs>

  <!-- SoC boot ROM -->
  <rect x="380" y="18" width="180" height="40" rx="10" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3"/>
  <text x="470" y="43" text-anchor="middle" font-size="12" fill="currentColor">SoC boot ROM</text>

  <!-- boot ROM -> BOOT.BIN -->
  <line x1="470" y1="58" x2="470" y2="78" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none" marker-end="url(#boot-arrow)"/>

  <!-- BOOT.BIN container (subgraph) -->
  <rect x="170" y="78" width="600" height="78" rx="12" fill="currentColor" fill-opacity="0.03" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.3" stroke-dasharray="5 4"/>
  <text x="184" y="95" font-size="10.5" font-weight="700" fill="currentColor" fill-opacity="0.7">BOOT.BIN</text>

  <!-- BOOT.BIN inner stages (LR) -->
  <g fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3">
    <rect x="195" y="102" width="160" height="46" rx="10"/>
    <rect x="390" y="102" width="160" height="46" rx="10"/>
  </g>
  <rect x="585" y="102" width="160" height="46" rx="10" fill="#c2740a" fill-opacity="0.08" stroke="#c2740a" stroke-opacity="0.6" stroke-width="1.5"/>
  <text x="275" y="121" text-anchor="middle" font-size="11" fill="currentColor">FSBL</text>
  <text x="275" y="137" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">init DDR + clocks</text>
  <text x="470" y="121" text-anchor="middle" font-size="11" fill="currentColor">FPGA bitstream</text>
  <text x="470" y="137" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">programs the PL</text>
  <text x="665" y="129" text-anchor="middle" font-size="12" font-weight="700" fill="#c2740a">U-Boot</text>

  <!-- BOOT.BIN (U-Boot) loads the kernel (spine) + device tree (side input) -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none">
    <line x1="470" y1="156" x2="470" y2="204" marker-end="url(#boot-arrow)"/>
    <line x1="700" y1="156" x2="700" y2="204" marker-end="url(#boot-arrow)"/>
  </g>
  <text x="505" y="182" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.65">U-Boot loads</text>

  <!-- Linux kernel (the code that becomes running Linux) -->
  <rect x="370" y="204" width="200" height="48" rx="10" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3"/>
  <text x="470" y="224" text-anchor="middle" font-size="11.5" fill="currentColor">Linux kernel</text>
  <text x="470" y="240" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">uImage / Image</text>

  <!-- device tree: data, not code (dashed box off to the side) -->
  <rect x="605" y="204" width="190" height="48" rx="10" fill="currentColor" fill-opacity="0.03" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3" stroke-dasharray="5 4"/>
  <text x="700" y="224" text-anchor="middle" font-size="11.5" fill="currentColor">devicetree.dtb</text>
  <text x="700" y="240" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">hardware description (data)</text>

  <!-- kernel -> Linux starts (spine) -->
  <line x1="470" y1="252" x2="470" y2="290" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none" marker-end="url(#boot-arrow)"/>

  <!-- Linux starts -->
  <rect x="380" y="290" width="180" height="44" rx="10" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3"/>
  <text x="470" y="317" text-anchor="middle" font-size="12" fill="currentColor">Linux starts</text>

  <!-- Linux starts -> driver binds (spine) -->
  <line x1="470" y1="334" x2="470" y2="360" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none" marker-end="url(#boot-arrow)"/>

  <!-- device tree read by the running kernel -> driver binds -->
  <line x1="700" y1="252" x2="700" y2="360" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none" stroke-dasharray="5 4" marker-end="url(#boot-arrow)"/>
  <text x="710" y="300" text-anchor="start" font-size="9" fill="currentColor" fill-opacity="0.65">read by Linux</text>

  <!-- driver binds (teal outcome) -->
  <rect x="225" y="360" width="490" height="50" rx="12" fill="#0d9488" fill-opacity="0.06" stroke="#0d9488" stroke-opacity="0.55" stroke-width="1.5"/>
  <text x="470" y="382" text-anchor="middle" font-size="11.5" font-weight="700" fill="#0d9488">Driver binds to the sdr,* FPGA nodes</text>
  <text x="470" y="398" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">discovered from the device tree</text>
</svg>
<figcaption><em>The boot chain. On 64-bit ZynqMP (ZCU102) the <code>BOOT.BIN</code> stage list grows, adding PMUFW before the bitstream and ATF (BL31) after it, as detailed just below.</em></figcaption>
</figure>

### 32-bit vs 64-bit boot

The two SoC families build BOOT.BIN differently, which is why the ZCU102 needs a separate build path:

| | Zynq-7000 (32-bit) | Zynq UltraScale+ / MPSoC (64-bit, e.g. ZCU102) |
|---|---|---|
| Build script | `kernel_boot/build_boot_bin.sh` | `kernel_boot/build_zynqmp_boot_bin.sh` |
| BOOT.BIN stages | FSBL → bitstream → U-Boot | FSBL → **PMUFW** → bitstream → **ATF (BL31)** → U-Boot |
| Kernel image | `uImage` (U-Boot format) | `Image` |
| Device tree file | `devicetree.dtb` | `system.dtb` |
| Extra firmware | none | PMU firmware + ARM Trusted Firmware |

- **`build_boot_bin.sh`** takes `system_top.<hdf|xsa>` and `u-boot.elf`, uses Xilinx `xsct` to build the FSBL from the hardware description, and `bootgen` to pack FSBL + bitstream + U-Boot into `BOOT.BIN`.
- **`build_zynqmp_boot_bin.sh`** additionally builds/collects the **PMU firmware** and the **ARM Trusted Firmware BL31** stage (it can `download` and build ATF, matched to your Vitis version), then packs them with per-stage attributes (`a53-0`, `el-3`/`trustzone`, `el-2`, `pl`) into a ZynqMP `BOOT.BIN`.

Both scripts are invoked for you by the higher-level image/build helpers. You rarely call them directly.

## The kernel

openwifi runs the **Analog Devices Linux kernel** (a fork of the Xilinx kernel with AD9361 support), currently branch **`2026_R1` (Linux v6.12)**. The driver builds against this kernel. The AD9361 is driven by ADI's in-tree IIO driver, which openwifi patches lightly.

`user_space/prepare_kernel.sh $XILINX_DIR <32|64>` does the whole thing:

1. Checks out the ADI kernel submodule (`adi-linux` for 32-bit, `adi-linux-64` for 64-bit) at branch `2026_R1`.
2. Applies the openwifi patches (below).
3. Copies `kernel_boot/kernel_config` (32-bit) or `kernel_boot/kernel_config_zynqmp` (64-bit) in as `.config`.
4. Builds `uImage` (32-bit, `UIMAGE_LOADADDR=0x8000`) or `Image` (64-bit), plus modules.

Output lands at `adi-linux/arch/arm/boot/uImage` or `adi-linux-64/arch/arm64/boot/Image`.

### The kernel patches

Four small patches (in `kernel_boot/`, documented in `kernel_patch_readme.md`) adapt the ADI kernel for openwifi:

| Patch | What it does |
|---|---|
| `ad9361_v6_12.patch` | Exports AD9361 functions the openwifi driver calls (`ad9361_set_tx_atten`, `ad9361_get_tx_atten`, `ad9361_do_calib_run`) and parses a new AGC device-tree property. This is the current patch for kernel 6.12, and `ad9361.patch` is the older equivalent. |
| `ad9361_private.patch` | Adds the `f_agc_dig_sat_ovrg_en` field to `struct gain_control` that the AGC change above needs. |
| `ad9361_conv.patch` | Removes the 61.44 MHz LVDS-interface self-timing calibration point, which is unreliable on some low-end/marginal hardware. |
| `axi_hdmi_crtc.patch` | Comments out one VDMA call to avoid an AXI-HDMI build error that appears once Xilinx AXI DMA is enabled. |

`kernel_config` / `kernel_config_zynqmp` are full defconfig-style `.config` files (Linux 6.12, 32-bit ARM vs 64-bit ARM) with the ADI driver bundles enabled.

---

## Updating a running board

Everything above is how a board is built and what it boots. This part is the routine operation: taking a board that already runs openwifi and moving it onto a kernel, a module set or a driver you just built. The layout section comes first, because all three procedures after it are variations on getting the same files into the same two directories.

- [Updating a board to a newly built kernel](#updating-a-board-to-a-newly-built-kernel): the normal path, using the transfer and populate scripts. New kernel, reboot needed.
- [The same update by hand](#the-same-update-by-hand-without-the-scripts): the identical set of copies with plain `scp`, for when the scripts' hard-coded addresses or their all-or-nothing behavior do not suit you.
- [Replacing a single module on a running board](#replacing-a-single-module-on-a-running-board): the light case. Same kernel, one rebuilt `.ko`, no reboot.

Picking the third when the kernel actually changed is the usual mistake, and it shows up as `invalid module format` at `insmod`.

### Where the kernel and its modules live on the board

The kernel build produces the image and a tree of `.ko` modules, but openwifi does not use `make modules_install`. The modules are staged by hand instead.

`update_sdcard.sh` (the "rebuild SD card" script, see [Building SD Images](Building-SD-Images.md#3-run-update_sdcardsh)) does the staging when you write a fresh card. It copies the files once per architecture (`ARCH = 32` and `64`), so a single card could carry both a 32-bit and a 64-bit set:

| What | From (on the host) | To (on the card) |
|---|---|---|
| Kernel image | `adi-linux/arch/arm/boot/uImage` (32) or `adi-linux-64/arch/arm64/boot/Image` (64) | `BOOT/` |
| openwifi driver `.ko`s | `driver/` (built by `make_all.sh`) | `rootfs/root/openwifi<ARCH>/` |
| In-tree kernel modules (all `.ko`, via `find`) | `adi-linux[-64]/` | `rootfs/root/kernel_modules<ARCH>/` |
| Module metadata: `Module.symvers`, `modules.builtin`, `modules.builtin.modinfo`, `modules.order` | `adi-linux[-64]/` | `rootfs/root/kernel_modules<ARCH>/` |

`<ARCH>` is `32` or `64`, giving `openwifi32`/`openwifi64` and `kernel_modules32`/`kernel_modules64` directories side by side on the `rootfs` partition. At this point the modules are only *staged*. Nothing is under `/lib/modules` yet.

The board-side script `populate_kernel_image_module_reboot.sh` is what finishes the job. It picks the set matching the board's architecture and:

- moves the board-support modules (`ad9361_drv.ko`, `adi_axi_hdmi.ko`, `axidmatest.ko`, `lcd.ko`, `xilinx_dma.ko`) out of `kernel_modules` and into `openwifi/`, next to the driver,
- symlinks the staged directory into the module path (`ln -s /root/kernel_modules /lib/modules/$(uname -r)`) and runs `depmod`, so `modprobe` can resolve dependencies for the running kernel,
- copies the kernel image, `BOOT.BIN` and the device tree into the `BOOT` partition, then reboots.

The end state on a running board is this layout, and both halves of it have to be right before `sdr0` can appear:

```text
/root/openwifi/           # openwifi driver .ko + board-support .ko  (wgd.sh insmods these by path)
/root/kernel_modules/     # every in-tree .ko, plus Module.symvers and the modules.* metadata
/lib/modules/$(uname -r) -> /root/kernel_modules     # the only path modprobe searches
```

`wgd.sh` loads the openwifi stack with `insmod` from `/root/openwifi/`, and loads `mac80211` with `modprobe`, which only works through that symlink. A missing or stale symlink is a common reason a freshly updated board comes up without `sdr0`.

### Updating a board to a newly built kernel

This is the full procedure for a board that already boots openwifi and that you want to move onto a kernel you just built, whether you changed the kernel config, changed a patch, or moved to a new ADI branch. Steps 1 to 4 run on your PC, steps 5 to 8 on the board. The end state is `sdr0` listed by `ifconfig -a`.

The commands assume the [environment variables](Software-Development-Workflow.md#environment-setup) are set, the board is reachable at `192.168.10.122` and your PC is at `192.168.10.1`, which is what the transfer scripts hard-code. The same scripts are listed in short form under [Bulk update helpers](Software-Development-Workflow.md#bulk-update-helpers), and there is an FTP-based alternative there (`sdcard_boot_update.sh` plus `wgd.sh remote`) if you prefer to pull from the board instead of pushing from the PC.

**1. Build the kernel on the PC.**

```bash
cd openwifi/user_space
./prepare_kernel.sh $XILINX_DIR $ARCH_BIT
```

Write down the kernel release string it produced, because everything below depends on whether it changed:

```bash
cat ../adi-linux-64/include/config/kernel.release   # 64-bit, use ../adi-linux/... for 32-bit
```

If that string is the same as the `uname -r` the board reports today, this is a config or patch change only and step 6 below becomes a no-op. If it differs, the board is getting a new kernel version and step 6 matters.

**2. Rebuild the driver against that same kernel.**

```bash
cd openwifi/driver
./make_all.sh $XILINX_DIR $ARCH_BIT
```

Do not skip this. A `.ko` can only be loaded by the exact kernel build it was compiled against, so a new kernel always means a new `sdr.ko` and a new set of sub-core modules. Reusing the old driver `.ko`s is a common way to end up with a board that boots fine and still has no `sdr0`.

**3. Send the kernel, the modules and the boot files to the board.**

```bash
cd openwifi/user_space
./transfer_kernel_image_module_to_board.sh ../adi-linux-64 $BOARD_NAME   # ../adi-linux for 32-bit
```

The first argument is the built kernel tree, the second is one of the supported board names (`zed_fmcs2`, `zcu102_fmcs2`, `antsdr`, `e310v2`, `sdrpi`, and so on). The script collects every `.ko` from that tree, the module metadata (`Module.symvers`, `modules.builtin`, `modules.builtin.modinfo`, `modules.order`), the kernel image (`Image` for `zcu102_fmcs2`, `uImage` otherwise), and `BOOT.BIN` and the `.dtb` if they exist under `kernel_boot/`. It packs all of that into `kernel_modules.tar.gz` and `scp`s it, plus `populate_kernel_image_module_reboot.sh`, into `/root` on the board.

If you also changed the FPGA or the device tree, generate the new `BOOT.BIN` first with `boot_bin_gen.sh` (see [Software Development Workflow](Software-Development-Workflow.md#updating-the-fpga-image-on-a-running-board)) so that this step picks it up. Otherwise the board keeps its existing `BOOT.BIN` and `.dtb`, which is what you want for a kernel-only change.

**4. Send the rebuilt driver.**

```bash
./transfer_driver_userspace_to_board.sh
```

This packs the driver `.ko`s into `openwifi.tar.gz` and copies it, along with `populate_driver_userspace.sh`, into `/root` on the board.

**5. Install the kernel and modules on the board.**

```bash
ssh root@192.168.10.122
./populate_kernel_image_module_reboot.sh
```

It unpacks the archive into `/root/kernel_modules`, moves the board-support modules into `/root/openwifi/`, creates the `/lib/modules/$(uname -r)` symlink, runs `depmod`, copies the kernel image, `BOOT.BIN` and the device tree into the `BOOT` partition, and reboots. Expect the ssh session to drop.

**6. After the reboot, check the module symlink, and run the populate script a second time if it is wrong.**

The symlink in step 5 was created for the kernel that was running *at that moment*, which is the old one. If the new kernel has a different release string, the board now boots a kernel that has no `/lib/modules` entry at all, `modprobe mac80211` fails, and `wgd.sh` cannot bring up `sdr0`. Check it:

```bash
uname -r                          # should be the release string from step 1
ls -l /lib/modules/$(uname -r)    # should point at /root/kernel_modules
```

If that directory is missing, run `./populate_kernel_image_module_reboot.sh` again (it reboots again, and this time the symlink is made for the new kernel), or fix it directly:

```bash
ln -s /root/kernel_modules /lib/modules/$(uname -r)
depmod -a
```

If the kernel release string did not change, the existing symlink is still correct and one run is enough.

**7. Install the driver.**

```bash
./populate_driver_userspace.sh
```

This puts the freshly built `.ko`s into `/root/openwifi/`.

**8. Load everything and confirm `sdr0`.**

```bash
cd /root/openwifi
./wgd.sh
ifconfig -a | grep sdr0
ifconfig sdr0 up
```

`wgd.sh` loads the FPGA image first if `system_top.bit.bin` is present in the directory, then `insmod`s `ad9361_drv` and `xilinx_dma`, `modprobe`s `mac80211`, and finally `insmod`s `tx_intf`, `rx_intf`, `openofdm_tx`, `openofdm_rx`, `xpu` and `sdr`. `sdr.ko` registering itself with `mac80211` is what creates the `sdr0` interface.

Use `ifconfig -a` rather than plain `ifconfig`, because `wgd.sh` leaves the interface down, so it does not show in the short listing. `ip link` works as well if `net-tools` is not installed. Once `ifconfig sdr0 up` succeeds the board is back to a normal openwifi state and you can continue with [Getting Started](Getting-Started.md) or [Operating Modes](Operating-Modes.md).

#### If `sdr0` does not appear

Read `dmesg | tail -40` right after `./wgd.sh`. The message tells you which step above did not take:

| What you see | What it means | Fix |
|---|---|---|
| `insmod: ERROR: could not insert module ...: Invalid module format`, and `dmesg` shows `version magic ... should be ...` | The `.ko` was built against a different kernel than the one running | Rebuild the driver (step 2) against the kernel that is actually booted, and re-copy it. Compare `modinfo /root/openwifi/sdr.ko \| grep vermagic` with `uname -r` |
| `modprobe: FATAL: Module mac80211 not found in directory /lib/modules/<version>` | The `/lib/modules` symlink is missing or still points at the old kernel version | Step 6 |
| `insmod: ERROR: ... Unknown symbol in module`, with `dmesg` naming `ad9361_set_tx_atten` or `ad9361_do_calib_run` | The loaded `ad9361_drv.ko` is an unpatched one, so the exported functions the driver needs are absent | Confirm `prepare_kernel.sh` applied the [kernel patches](#the-kernel-patches), then redo steps 1, 3 and 5 |
| Modules load with no error, but no `sdr0` and `dmesg` shows no openwifi probe lines at all | The driver never bound, because nothing in the device tree matches `compatible = "sdr,sdr"`, or the `.dtb` in the `BOOT` partition is not the openwifi one | [The device tree](#the-device-tree) below, and check that step 5 wrote the `.dtb` into `BOOT` |
| `Unsupported PRODUCT_ID 0xFF` or `0x00` at AD9361 probe | The AD9361 is not responding over SPI, which is a hardware or FMC-connection problem, not a kernel one | [Troubleshooting → hardware quirks](Troubleshooting.md#hardware-quirks) |

A quick full-state check, useful to paste into a bug report:

```bash
uname -r
ls -l /lib/modules/$(uname -r)
modinfo /root/openwifi/sdr.ko | grep vermagic
lsmod | grep -E 'sdr|mac80211|ad9361|xilinx_dma'
dmesg | grep -i -E 'sdr|ad9361|openwifi'
```

!!! note "Updating the device tree or `BOOT.BIN` only"
    Steps 3 and 5 already carry `BOOT.BIN` and the `.dtb` along with the kernel, so a device-tree change alone can use the same flow. The only requirement is a power-cycle or reboot, because those two are read at boot and cannot be reloaded live. The alternative is to mount the `BOOT` partition on your PC and copy the files in directly.

### The same update by hand, without the scripts

Steps 3 to 7 above are only file copies and a symlink, so you can do them by hand once steps 1 and 2 (build the kernel, rebuild the driver against it) are done. That is worth doing when your board is not at the hard-coded `192.168.10.122`, when you only want part of the update, or when you want to see exactly which files are touched. Everything below is what `transfer_kernel_image_module_to_board.sh`, `transfer_driver_userspace_to_board.sh`, `populate_kernel_image_module_reboot.sh` and `populate_driver_userspace.sh` do, with the tar step dropped and the paths spelled out.

**On the PC: pick the arch-dependent names.**

```bash
cd openwifi/user_space

BOARD_IP=192.168.10.122
BOARD_NAME=zcu102_fmcs2

# 64-bit board (zcu102_fmcs2)
KDIR=../adi-linux-64
KERNEL_IMAGE=$KDIR/arch/arm64/boot/Image
DTB_NAME=system.dtb

# 32-bit board (everything else)
# KDIR=../adi-linux
# KERNEL_IMAGE=$KDIR/arch/arm/boot/uImage
# DTB_NAME=devicetree.dtb
```

**On the PC: collect the in-tree modules.**

```bash
rm -rf kernel_modules && mkdir -p kernel_modules
find $KDIR/ -name \*.ko -exec cp {} ./kernel_modules/ \;
cp $KDIR/Module.symvers $KDIR/modules.builtin $KDIR/modules.builtin.modinfo \
   $KDIR/modules.order ./kernel_modules/
```

The `find` flattens the whole kernel tree into one directory, so there is no `kernel/drivers/...` hierarchy under it. That flat layout is what `/lib/modules/$(uname -r)` will point at on the board, and it is why the four metadata files have to travel with the `.ko`s. Without `modules.order` and `modules.builtin`, `depmod` cannot build a usable `modules.dep` and `modprobe mac80211` fails.

**On the PC: add the boot files.**

```bash
cp $KERNEL_IMAGE ./kernel_modules/
```

Add `BOOT.BIN` and the device tree only if you rebuilt them, for example after an FPGA or device-tree change. For a kernel-only update leave both out and the board keeps the ones it already has.

```bash
cp ../kernel_boot/boards/$BOARD_NAME/output_boot_bin/BOOT.BIN ./kernel_modules/
cp ../kernel_boot/boards/$BOARD_NAME/$DTB_NAME ./kernel_modules/
```

**On the PC: collect the driver modules.**

```bash
rm -rf openwifi && mkdir -p openwifi
find ../driver/ -name \*.ko -exec cp {} ./openwifi/ \;
```

That picks up `sdr.ko` and the sub-core modules (`tx_intf`, `rx_intf`, `openofdm_tx`, `openofdm_rx`, `xpu`) plus `side_ch.ko`.

**Copy both sets to the board.**

```bash
ssh root@$BOARD_IP 'rm -rf /root/kernel_modules && mkdir -p /root/kernel_modules /root/openwifi'
scp kernel_modules/* root@$BOARD_IP:/root/kernel_modules/
scp openwifi/*.ko    root@$BOARD_IP:/root/openwifi/
```

Wiping `/root/kernel_modules` first is not optional. Any `.ko` left over from the previous kernel stays visible to `depmod` and `modprobe`, and a stale one loads with the wrong version magic or shadows the new module of the same name. On a slow link, `tar -zcf kernel_modules.tar.gz kernel_modules`, one `scp`, and `tar -zxf` on the board is the faster equivalent, which is what the scripts do.

**On the board: put the files where `wgd.sh` expects them.**

```bash
ssh root@$BOARD_IP
cd /root

# board-support modules belong next to the driver, wgd.sh insmods them by path
for m in ad9361_drv adi_axi_hdmi axidmatest lcd xilinx_dma ; do
    mv -f ./kernel_modules/$m.ko ./openwifi/ 2>/dev/null
done

# point the module search path of the running kernel at the staged directory
rm -rf /lib/modules/$(uname -r)
ln -s /root/kernel_modules /lib/modules/$(uname -r)
depmod

# keep wgd.sh from reprogramming the FPGA with the old bitstream
mv -f ./openwifi/system_top.bit.bin ./openwifi/system_top.bit.bin.bak
```

Not every board has all five board-support modules, so `mv` failing on one of them is normal. The `system_top.bit.bin` rename only matters if you copied a new `BOOT.BIN`: the new bitstream is then already loaded at boot, and letting `wgd.sh` push the old `.bit.bin` on top of it would undo the update. Skip that line if you did not touch `BOOT.BIN`.

**On the board: write the boot files and reboot.**

```bash
umount /mnt 2>/dev/null
mount /dev/mmcblk0p1 /mnt
cp ./kernel_modules/Image /mnt/          # uImage on a 32-bit board
cp ./kernel_modules/BOOT.BIN /mnt/       # only if you copied a new one
cp ./kernel_modules/system.dtb /mnt/     # devicetree.dtb on 32-bit, only if new
sync
umount /mnt
reboot now
```

`/dev/mmcblk0p1` is the first partition of the SD card, which is the FAT `BOOT` partition. The `sync` before `umount` is worth keeping, because a kernel image half-written to a FAT partition is a board that does not come back.

**After the reboot: check the symlink, exactly as in step 6.**

```bash
uname -r
ls -l /lib/modules/$(uname -r)
```

If the release string changed, remake the symlink for the reason given in step 6:

```bash
rm -rf /lib/modules/$(uname -r)
ln -s /root/kernel_modules /lib/modules/$(uname -r)
depmod -a
```

Then load the stack and confirm the interface, the same as step 8:

```bash
cd /root/openwifi
./wgd.sh
ifconfig -a | grep sdr0
```

If it does not show up, the same table applies: [If `sdr0` does not appear](#if-sdr0-does-not-appear).

### Replacing a single module on a running board

If a board is already up and you just rebuilt one or more modules against the **same** kernel it is running, you need neither of the two procedures above, nor `update_sdcard.sh`, nor a reboot. You can push the `.ko`s over the network and reload them live. The one thing to get right is *which* directory each module lands in, and that follows directly from how `wgd.sh` loads it (this still relies on the `/lib/modules` symlink described above):

- **openwifi driver stack** (`sdr`, `tx_intf`, `rx_intf`, `openofdm_tx`, `openofdm_rx`, `xpu`) and the **board-support modules** (`ad9361_drv`, `xilinx_dma`, …): `wgd.sh` `insmod`s these by explicit path from its own directory, so they go into `/root/openwifi/`. Putting them in `kernel_modules/` will *not* make `wgd.sh` find them.
- **Base kernel modules** (`mac80211`, `cfg80211`, other in-tree `.ko`s): these are the only ones `wgd.sh` pulls with `modprobe`, so they go into `/root/kernel_modules/` (the `/lib/modules/$(uname -r)` target).

The openwifi driver `.ko`s live in `driver/` on the host after `make_all.sh`. In-tree modules come from the built `adi-linux[-64]/` tree:

```bash
# openwifi driver / board-support module -> the openwifi dir wgd.sh insmods from
scp driver/sdr.ko root@<board-ip>:/root/openwifi/

# a base in-tree kernel module (modprobe'd) -> the staged module tree
scp adi-linux-64/drivers/iio/adc/ad9361_drv.ko \
    root@<board-ip>:/root/kernel_modules/
```

Then reload on the board. The simplest way is to re-run `./wgd.sh` in `/root/openwifi/`, which `rmmod`s and `insmod`s `sdr` plus its five sub-core modules from that directory in the right order. To reload a single module by hand, `insmod` it by path (the openwifi stack) or `modprobe` it by name after `depmod -a` (a base module):

```bash
rmmod sdr 2>/dev/null            # unload the old one if it's live
insmod /root/openwifi/sdr.ko     # openwifi stack: insmod by path, like wgd.sh
# depmod -a && modprobe mac80211 # base stack: resolved via /lib/modules -> kernel_modules
```

!!! warning "The module must match the running kernel"
    A `.ko` is only loadable by the exact kernel it was built against. `insmod` will reject it (`version magic` / `invalid module format`) if you changed the kernel config or bumped the kernel version. Copying modules live only works when you rebuilt just the module against the same kernel that is booted. If you changed the kernel itself, you have to install the new image and reboot, so use the [full update procedure](#updating-a-board-to-a-newly-built-kernel) instead of `scp`ing the `.ko`s.

---

## The device tree

This is the central piece of a board port. The **device tree** is a data structure describing the hardware (every peripheral, its register address, its interrupts, its clocks) that Linux reads at boot to know what exists. openwifi's driver is a Linux **platform driver** that binds to a device-tree node with `compatible = "sdr,sdr"`, and it learns the AXI addresses and interrupts of every FPGA core *from the device tree*. If the device tree doesn't match the FPGA build, the driver won't find the hardware (or will bind to the wrong addresses).

### How openwifi builds a board's device tree

Rather than hand-maintain a full `.dts` per board, openwifi **layers overlays** onto a stock board device tree. The script `kernel_boot/boards/construct_device_tree.sh` does the merge:

```bash
construct_device_tree.sh $BOARD_NAME $ARCH   # ARCH = 32 or 64
# optional 3rd/4th args: custom stock-dts folder, custom dtsi include folder
```

Three ingredients go in:

1. **The stock board device tree**: the ordinary ADI/Xilinx `.dts` for the board (e.g. `zynq-zed.dts`, `zynqmp-zcu102-rev1.1.dts`). This describes the ARM SoC, DDR, Ethernet, UART, SD, etc. (everything *except* openwifi).
2. **`openwifi_32_ad9361.dtso` / `openwifi_64_ad9361.dtso`**: the **architecture-wide** openwifi overlay. It adds the openwifi FPGA IP blocks and the AD9361 binding, and is shared by *all* boards of that architecture.
3. **`overlays/<board_name>.dtso`**: the **board-specific** overlay: the AD9361 reference-clock frequency, board LEDs/GPIO, and any board-unique glue.

The script compiles each overlay with `dtc`, preprocesses and compiles the stock `.dts`, then fuses them with `fdtoverlay`:

<figure>
<svg viewBox="0 0 940 240" role="img" aria-label="How construct_device_tree.sh builds a board device tree: the stock_board.dts is compiled with cpp and dtc into default_devicetree.dtb, the shared openwifi overlay and the per-board overlay are each compiled with dtc into .dtbo files, and fdtoverlay then fuses all three into the board's devicetree.dtb, plus a decompiled full_devicetree.dts for inspection." style="width:100%;height:auto;max-width:940px;font-family:inherit;font-size:13px">
  <defs>
    <marker id="dt-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fill-opacity="0.6"/>
    </marker>
  </defs>

  <!-- source boxes (left) -->
  <g fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3">
    <rect x="12" y="18" width="200" height="44" rx="10"/>
    <rect x="12" y="98" width="200" height="44" rx="10"/>
    <rect x="12" y="178" width="200" height="44" rx="10"/>
  </g>
  <text x="112" y="44" text-anchor="middle" font-size="11" fill="currentColor">stock_board.dts</text>
  <text x="112" y="124" text-anchor="middle" font-size="10.5" fill="currentColor">openwifi_&lt;arch&gt;_ad9361.dtso</text>
  <text x="112" y="204" text-anchor="middle" font-size="10.5" fill="currentColor">overlays/&lt;board&gt;.dtso</text>

  <!-- source -> intermediate arrows, with tool labels -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none">
    <line x1="212" y1="40" x2="272" y2="40" marker-end="url(#dt-arrow)"/>
    <line x1="212" y1="120" x2="272" y2="120" marker-end="url(#dt-arrow)"/>
    <line x1="212" y1="200" x2="272" y2="200" marker-end="url(#dt-arrow)"/>
  </g>
  <text x="242" y="33" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">cpp+dtc</text>
  <text x="242" y="113" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">dtc</text>
  <text x="242" y="193" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">dtc</text>

  <!-- intermediate boxes (middle) -->
  <g fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3">
    <rect x="272" y="18" width="176" height="44" rx="10"/>
    <rect x="272" y="98" width="176" height="44" rx="10"/>
    <rect x="272" y="178" width="176" height="44" rx="10"/>
  </g>
  <text x="360" y="44" text-anchor="middle" font-size="10.5" fill="currentColor">default_devicetree.dtb</text>
  <text x="360" y="124" text-anchor="middle" font-size="10.5" fill="currentColor">openwifi.dtbo</text>
  <text x="360" y="204" text-anchor="middle" font-size="10.5" fill="currentColor">&lt;board&gt;.dtbo</text>

  <!-- converge into fdtoverlay -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none">
    <line x1="448" y1="40" x2="528" y2="110" marker-end="url(#dt-arrow)"/>
    <line x1="448" y1="120" x2="528" y2="120" marker-end="url(#dt-arrow)"/>
    <line x1="448" y1="200" x2="528" y2="130" marker-end="url(#dt-arrow)"/>
  </g>

  <!-- fdtoverlay (amber) -->
  <rect x="528" y="92" width="124" height="56" rx="12" fill="#c2740a" fill-opacity="0.08" stroke="#c2740a" stroke-opacity="0.6" stroke-width="1.5"/>
  <text x="590" y="124" text-anchor="middle" font-size="12.5" font-weight="700" fill="#c2740a">fdtoverlay</text>

  <!-- fdtoverlay -> output -->
  <line x1="652" y1="120" x2="712" y2="120" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.6" fill="none" marker-end="url(#dt-arrow)"/>

  <!-- output (teal) -->
  <rect x="712" y="92" width="176" height="56" rx="12" fill="#0d9488" fill-opacity="0.06" stroke="#0d9488" stroke-opacity="0.55" stroke-width="1.5"/>
  <text x="800" y="116" text-anchor="middle" font-size="12.5" font-weight="700" fill="#0d9488">devicetree.dtb</text>
  <text x="800" y="132" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.7">the board's final tree</text>
  <text x="800" y="172" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.65">+ full_devicetree.dts (decompiled for inspection)</text>
</svg>
<figcaption><em><code>construct_device_tree.sh</code> compiles the stock board tree (<code>cpp</code> + <code>dtc</code>) and the two openwifi overlays (<code>dtc</code>), then <code>fdtoverlay</code> fuses all three into the board's final <code>devicetree.dtb</code> (and decompiles a <code>full_devicetree.dts</code> so you can inspect the merged result).</em></figcaption>
</figure>

!!! info "Why it's built this way"
    This overlay-based device-tree system came out of the NLnet project [*Extensive openwifi support for OpenWRT*](https://nlnet.nl/project/OpenWifi-OpenWRT/), which set out to modularize openwifi's hardware description and to break its dependency on ADI Kuiper Linux so it can target OpenWrt.

!!! note "Most shipped boards include a fixed `devicetree.dts`"
    If a board directory already contains a prebuilt `devicetree.dts`, `construct_device_tree.sh` **only recompiles the overlays and stops**: it trusts the shipped tree. The stock-`.dts`-plus-`fdtoverlay` path is what you use when bringing up a *new* board that doesn't have a prebuilt tree yet. The script keeps a `board_name → stock .dts` map internally (e.g. `zed_fmcs2 → zynq-zed.dts`, `adrv9364z7020 → zynq-adrv9364.dts`).

### What the openwifi overlay adds

The shared `openwifi_32_ad9361.dtso` inserts (as device-tree fragments):

- A **24 MHz fixed clock**, enables the FPGA fabric clocks (`fclk-enable = <0xf>` on `&clkc`, which the kernel's `zynq-7000.dtsi` otherwise gates off), and sets the default `interrupt-parent` to `&intc` (the Zynq-7000 interrupt controller).
- An **`fpga-axi@0` simple-bus** holding all the AXI peripherals, including openwifi's cores. This is the address map the driver relies on:

    | Node | Address | `compatible` | Interrupts |
    |---|---|---|---|
    | `sdr` | (no reg, the driver's bind node) | `sdr,sdr` | 29, 30, 33, 34 |
    | `tx_intf` | `0x83c00000` | `sdr,tx_intf` | 34 |
    | `openofdm_tx` | `0x83c10000` | `sdr,openofdm_tx` | none |
    | `rx_intf` | `0x83c20000` | `sdr,rx_intf` | 29, 30 |
    | `openofdm_rx` | `0x83c30000` | `sdr,openofdm_rx` | none |
    | `xpu` | `0x83c40000` | `sdr,xpu` | none |
    | `side_ch` | `0x83c50000` | `sdr,side_ch` | (DMA) |
    | `tx_dma` | `0x80400000` | `xlnx,axi-dma-1.00.a` | 35, 36 |
    | `rx_dma` | `0x80410000` | `xlnx,axi-dma-1.00.a` | 31, 32 |
    | `cf-ad9361-lpc` | `0x79020000` | `adi,axi-ad9361` | none |
    | `cf-ad9361-dds-core-lpc` | `0x79024000` | `adi,axi-ad9361-dds` | none |

    The `sdr` node ties the driver to the DMA engines (`dmas = <&rx_dma 1 &tx_dma 0>`) and interrupts. `side_ch` has its own DMA pair. An `i2c@41600000` bus (power monitor, ADC, EEPROM) is also declared.

- An **`ad9361-phy@0` SPI device** on `spi0` (`spi@e0006000`), `compatible = "adi,ad9361"`, carrying the long list of `adi,*` RF/AGC tuning properties (LVDS mode, RX/TX bandwidths, synthesizer frequencies, gain-control tables, control GPIOs).

The **64-bit** overlay (`openwifi_64_ad9361.dtso`) declares the same conceptual set of blocks but for ZynqMP: `interrupt-parent = <&gic>` instead of `&intc`, clocks via `&zynqmp_clk` (with `fclk0..3` declared explicitly), a different AXI address range (roughly `0xa00xxxxx`), and an extra BRAM controller node.

### What a board overlay adds

Here is the complete `overlays/zed_fmcs2.dtso`, which is a good template:

```dts
/dts-v1/;
/plugin/;

/{
    // 1. Board's AD9361 reference clock (40 MHz on this board)
    fragment@0 {
        target = <&clocks>;
        __overlay__ {
            clk_40M_fixed: clock@0 {
                #clock-cells = <0x0>;
                compatible = "fixed-clock";
                clock-frequency = <40000000>;
                clock-output-names = "ad9361_ext_refclk";
            };
        };
    };

    // 2. Point the AD9361 at that clock + set the DCXO tuning
    fragment@1 {
        target = <&ad9361_phy>;
        __overlay__ {
            clocks = <&clk_40M_fixed 0x0>;
            adi,dcxo-coarse-and-fine-tune = <0x8 0x1720>;
        };
    };

    // 3. Board LEDs wired to PS GPIO
    fragment@2 {
        target-path = "/";
        __overlay__ {
            leds {
                compatible = "gpio-leds";
                ld0 { label = "ld0:red"; gpios = <&gpio0 0x49 0x0>; };
                /* ...ld1..ld7... */
            };
        };
    };
};
```

So a board overlay typically supplies: the **AD9361 external reference clock frequency** (40 MHz here, though boards with a VCXO/GPS may differ), the **DCXO tuning**, board **LEDs/GPIO**, and any board-unique peripherals or RF-switch controls.

---

## Porting the device tree to a new board

The guiding principle: **the address and interrupt of every FPGA block on the AXI bus must match between your FPGA build and your device tree.** The FPGA build is the source of truth for those numbers, and the device tree has to agree.

A practical sequence:

1. **Get the address map from your FPGA build.** In Vivado, open your board's openwifi-hw project (`openwifi-hw/boards/<board_name>/`), *Open Block Design → Address Editor*. This lists the base address of every AXI peripheral (the `sdr,*` cores, the DMA engines, the AD9361 cores) and, in the block diagram, their interrupt connections. See [FPGA Development → Porting to a new board](FPGA-Development.md#porting-to-a-new-board).

2. **Reuse the shared openwifi overlay if your addresses are standard.** If your FPGA places the openwifi cores at the usual `0x83c0_xxxx` (Zynq-7000) or `0xa00x_xxxx` (ZynqMP) addresses with the standard interrupts, you can use `openwifi_32_ad9361.dtso` / `openwifi_64_ad9361.dtso` **unchanged**. If you moved any block, edit that block's `reg = <...>` and `interrupts = <...>` in the overlay to match Vivado.

3. **Write your board overlay** `overlays/<board_name>.dtso`. Start from the closest existing overlay (`zed_fmcs2.dtso` for a plain FMCOMMS board, or `e310v2.dtso`/`sdrpi.dtso` for boards with a VCXO/GPS/extra GPIO). Set:
    - the **AD9361 reference clock** frequency (`clk_*_fixed` → `ad9361_ext_refclk`) to your board's crystal/VCXO,
    - the **DCXO tuning** if applicable,
    - **LEDs/GPIO** and any **RF-switch/port control** your board needs (e.g. the ANTSDR RF-switch caveat noted in [Supported Boards](Supported-Boards.md#antsdr-microphase) lives here).

4. **Provide the stock board `.dts`.** Add a `board_name → stock .dts` entry to the map in `construct_device_tree.sh` and place the matching stock ADI/Xilinx `.dts` (plus its `.dtsi` includes) in the defaults folder. openwifi obtains stock trees by decompiling the ADI Linux image's `.dtb` with `dtc`, then editing.

5. **Generate and sanity-check the tree:**

    ```bash
    cd kernel_boot/boards
    ./construct_device_tree.sh <board_name> <32|64>
    # inspect the decompiled result:
    less <board_name>/full_devicetree.dts
    ```

    Confirm the `fpga-axi@0` block shows your `sdr,*` nodes at the right addresses and that `ad9361-phy@0` has your clock.

6. **Boot and verify.** After building `BOOT.BIN` + kernel + this `devicetree.dtb` into an SD image (see [Software Development Workflow](Software-Development-Workflow.md#building-a-full-sd-image-from-scratch)), boot with a UART console attached. On a good boot you'll see the AD9361 probe and the `sdr,sdr` driver bind. If it doesn't, the device-tree addresses/interrupts almost certainly disagree with the FPGA. Recheck step 1. Common failures (SPI-flash env, wrong DDR size, ZCU102 SD/SODIMM, no UART) are in [Troubleshooting](Troubleshooting.md#boot-and-networking).

!!! tip "The device tree is where the FPGA meets Linux"
    A board port is really two halves that must agree: the **FPGA side** (the openwifi-hw Vivado project, which fixes addresses/interrupts, see [FPGA Development](FPGA-Development.md#porting-to-a-new-board)) and the **device-tree side** (this page, which tells Linux those same addresses/interrupts). Get the two to match and the rest of openwifi (driver, `sdrctl`, everything above) works unchanged, because it's all keyed off the `sdr,*` `compatible` strings, not the board.

## Related pages

- [Software Development Workflow](Software-Development-Workflow.md): rebuilding the kernel, transferring images, and building a full SD card.
- [FPGA Development → Porting to a new board](FPGA-Development.md#porting-to-a-new-board): the FPGA half of a board port.
- [Supported Boards](Supported-Boards.md): per-board hardware notes and the 32-bit vs 64-bit boot differences.
- [Architecture](Architecture.md#how-the-driver-talks-to-linux-the-mac80211-api): why the driver is a device-tree platform driver.
- [Troubleshooting → Boot and networking](Troubleshooting.md#boot-and-networking): boot failures and fixes.
