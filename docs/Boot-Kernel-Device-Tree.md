# Boot, Kernel and Device Tree

This page explains how an openwifi board actually boots: the boot image, the kernel and its patches, and, in the most detail, the **device tree**, which is the piece that tells Linux where the FPGA blocks live and is the main thing you edit when porting to a new board.

If you just want to flash a card and run, see [Getting Started](Getting-Started.md). If you want to rebuild the driver or a full SD image, see [Software Development Workflow](Software-Development-Workflow.md). This page is for understanding and modifying the boot chain itself. All paths below are in the [openwifi](https://github.com/open-sdr/openwifi) repo under `kernel_boot/` unless noted.

## The boot chain at a glance

A Zynq board boots from the SD card's `BOOT` partition, which holds three things openwifi cares about:

```
BOOT partition
├── BOOT.BIN         # FSBL + FPGA bitstream + U-Boot (+ ATF/PMUFW on 64-bit)
├── uImage / Image   # the Linux kernel
└── devicetree.dtb   # the hardware description Linux parses at boot
                     (rootfs lives on the second partition)
```

The sequence: the SoC's boot ROM loads **BOOT.BIN**, whose **FSBL** (First Stage Boot Loader) initializes DDR and clocks, programs the **FPGA bitstream**, and hands off to **U-Boot**, which loads the **kernel** and the **device tree** and starts Linux. Linux then reads the device tree to discover the FPGA's AXI peripherals (including openwifi's cores) and binds drivers to them.

<figure>
<svg viewBox="0 0 940 420" role="img" aria-label="The openwifi boot chain: the SoC boot ROM loads BOOT.BIN, whose stages run in order — FSBL (init DDR and clocks), then the FPGA bitstream (programs the PL), then U-Boot. U-Boot loads the Linux kernel (uImage / Image), which boots into a running Linux, and also loads the device tree blob (devicetree.dtb), which is not code but a hardware description that the running kernel reads. From the device tree the driver binds to the sdr,* FPGA nodes." style="width:100%;height:auto;max-width:940px;font-family:inherit;font-size:13px">
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

  <!-- device tree: data, not code — dashed box off to the side -->
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
<figcaption><em>The boot chain. On 64-bit ZynqMP (ZCU102) the <code>BOOT.BIN</code> stage list grows — PMUFW before the bitstream, ATF (BL31) after it — as detailed just below.</em></figcaption>
</figure>

### 32-bit vs 64-bit boot

The two SoC families build BOOT.BIN differently, which is why ZCU102 is "the odd one out":

| | Zynq-7000 (32-bit) | Zynq UltraScale+ / MPSoC (64-bit, ZCU102) |
|---|---|---|
| Build script | `kernel_boot/build_boot_bin.sh` | `kernel_boot/build_zynqmp_boot_bin.sh` |
| BOOT.BIN stages | FSBL → bitstream → U-Boot | FSBL → **PMUFW** → bitstream → **ATF (BL31)** → U-Boot |
| Kernel image | `uImage` (U-Boot format) | `Image` |
| Device tree file | `devicetree.dtb` | `system.dtb` |
| Extra firmware | none | PMU firmware + ARM Trusted Firmware |

- **`build_boot_bin.sh`** takes `system_top.<hdf|xsa>` and `u-boot.elf`, uses Xilinx `xsct` to build the FSBL from the hardware description, and `bootgen` to pack FSBL + bitstream + U-Boot into `BOOT.BIN`.
- **`build_zynqmp_boot_bin.sh`** additionally builds/collects the **PMU firmware** and the **ARM Trusted Firmware BL31** stage (it can `download` and build ATF, matched to your Vitis version), then packs them with per-stage attributes (`a53-0`, `el-3`/`trustzone`, `el-2`, `pl`) into a ZynqMP `BOOT.BIN`.

Both scripts are invoked for you by the higher-level image/build helpers; you rarely call them directly.

## The kernel

openwifi runs the **Analog Devices Linux kernel** (a fork of the Xilinx kernel with AD9361 support), currently branch **`2026_R1` (Linux v6.12)**. The driver builds against this kernel; the AD9361 is driven by ADI's in-tree IIO driver, which openwifi patches lightly.

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
| `ad9361_v6_12.patch` | Exports AD9361 functions the openwifi driver calls (`ad9361_set_tx_atten`, `ad9361_get_tx_atten`, `ad9361_do_calib_run`) and parses a new AGC device-tree property. This is the current patch for kernel 6.12; `ad9361.patch` is the older equivalent. |
| `ad9361_private.patch` | Adds the `f_agc_dig_sat_ovrg_en` field to `struct gain_control` that the AGC change above needs. |
| `ad9361_conv.patch` | Removes the 61.44 MHz LVDS-interface self-timing calibration point, which is unreliable on some low-end/marginal hardware. |
| `axi_hdmi_crtc.patch` | Comments out one VDMA call to avoid an AXI-HDMI build error that appears once Xilinx AXI DMA is enabled. |

`kernel_config` / `kernel_config_zynqmp` are full defconfig-style `.config` files (Linux 6.12, 32-bit ARM vs 64-bit ARM) with the ADI driver bundles enabled.

---

## The device tree

This is the heart of a board port. The **device tree** is a data structure describing the hardware (every peripheral, its register address, its interrupts, its clocks) that Linux reads at boot to know what exists. openwifi's driver is a Linux **platform driver** that binds to a device-tree node with `compatible = "sdr,sdr"`; it learns the AXI addresses and interrupts of every FPGA core *from the device tree*. If the device tree doesn't match the FPGA build, the driver won't find the hardware (or will bind to the wrong addresses).

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
<svg viewBox="0 0 940 240" role="img" aria-label="How construct_device_tree.sh builds a board device tree: the stock_board.dts is compiled with cpp and dtc into default_devicetree.dtb; the shared openwifi overlay and the per-board overlay are each compiled with dtc into .dtbo files; fdtoverlay then fuses all three into the board's devicetree.dtb, plus a decompiled full_devicetree.dts for a sanity check." style="width:100%;height:auto;max-width:940px;font-family:inherit;font-size:13px">
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
  <text x="800" y="172" text-anchor="middle" font-size="9" fill="currentColor" fill-opacity="0.65">+ full_devicetree.dts (decompiled sanity check)</text>
</svg>
<figcaption><em><code>construct_device_tree.sh</code> compiles the stock board tree (<code>cpp</code> + <code>dtc</code>) and the two openwifi overlays (<code>dtc</code>), then <code>fdtoverlay</code> fuses all three into the board's final <code>devicetree.dtb</code> (and decompiles a <code>full_devicetree.dts</code> for a sanity check).</em></figcaption>
</figure>

!!! info "Why it's built this way"
    This modular, overlay-based device-tree system came out of the NLnet project [*Extensive openwifi support for OpenWRT*](https://nlnet.nl/project/OpenWifi-OpenWRT/), which set out to **modularize openwifi's hardware description** so it can be ported across the whole board matrix in a maintainable way, and to **break openwifi's dependency on ADI Kuiper Linux** so it can target OpenWrt. Splitting the tree into a shared openwifi overlay plus small per-board overlays (instead of one hand-maintained tree per board) is what makes the porting flow below tractable.

!!! note "Most shipped boards include a fixed `devicetree.dts`"
    If a board directory already contains a prebuilt `devicetree.dts`, `construct_device_tree.sh` **only recompiles the overlays and stops**: it trusts the shipped tree. The stock-`.dts`-plus-`fdtoverlay` path is what you use when bringing up a *new* board that doesn't have a prebuilt tree yet. The script keeps a `board_name → stock .dts` map internally (e.g. `zed_fmcs2 → zynq-zed.dts`, `adrv9364z7020 → zynq-adrv9364.dts`).

### What the openwifi overlay adds

The shared `openwifi_32_ad9361.dtso` inserts (as device-tree fragments):

- A **24 MHz fixed clock**, enables the FPGA fabric clocks (`fclk-enable = <0xf>` on `&clkc`; the kernel's `zynq-7000.dtsi` otherwise gates them off), and sets the default `interrupt-parent` to `&intc` (the Zynq-7000 interrupt controller).
- An **`fpga-axi@0` simple-bus** holding all the AXI peripherals, including openwifi's cores. This is the address map the driver relies on:

    | Node | Address | `compatible` | Interrupts |
    |---|---|---|---|
    | `sdr` | (no reg; the driver's bind node) | `sdr,sdr` | 29, 30, 33, 34 |
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

    The `sdr` node ties the driver to the DMA engines (`dmas = <&rx_dma 1 &tx_dma 0>`) and interrupts; `side_ch` has its own DMA pair. An `i2c@41600000` bus (power monitor, ADC, EEPROM) is also declared.

- An **`ad9361-phy@0` SPI device** on `spi0` (`spi@e0006000`), `compatible = "adi,ad9361"`, carrying the long list of `adi,*` RF/AGC tuning properties (LVDS mode, RX/TX bandwidths, synthesizer frequencies, gain-control tables, control GPIOs).

The **64-bit** overlay (`openwifi_64_ad9361.dtso`) declares the same conceptual set of blocks but for ZynqMP: `interrupt-parent = <&gic>` instead of `&intc`, clocks via `&zynqmp_clk` (with `fclk0..3` declared explicitly), a different AXI address range (roughly `0xa00xxxxx`), and an extra BRAM controller node.

### What a board overlay adds

The board overlay is small and concrete. Here is the complete `overlays/zed_fmcs2.dtso`, which is a good template:

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

So a board overlay typically supplies: the **AD9361 external reference clock frequency** (40 MHz here; boards with a VCXO/GPS may differ), the **DCXO tuning**, board **LEDs/GPIO**, and any board-unique peripherals or RF-switch controls.

---

## Porting the device tree to a new board

The guiding principle: **the address and interrupt of every FPGA block on the AXI bus must match between your FPGA build and your device tree.** The FPGA build is the source of truth for those numbers; the device tree has to agree.

A practical sequence:

1. **Get the address map from your FPGA build.** In Vivado, open your board's openwifi-hw project (`openwifi-hw/boards/<board_name>/`), *Open Block Design → Address Editor*. This lists the base address of every AXI peripheral (the `sdr,*` cores, the DMA engines, the AD9361 cores) and, in the block diagram, their interrupt connections. See [FPGA Development → Porting to a new board](FPGA-Development.md#porting-to-a-new-board).

2. **Reuse the shared openwifi overlay if your addresses are standard.** If your FPGA places the openwifi cores at the usual `0x83c0_xxxx` (Zynq-7000) or `0xa00x_xxxx` (ZynqMP) addresses with the standard interrupts, you can use `openwifi_32_ad9361.dtso` / `openwifi_64_ad9361.dtso` **unchanged**. If you moved any block, edit that block's `reg = <...>` and `interrupts = <...>` in the overlay to match Vivado.

3. **Write your board overlay** `overlays/<board_name>.dtso`. Start from the closest existing overlay (`zed_fmcs2.dtso` for a plain FMCOMMS board; `e310v2.dtso`/`sdrpi.dtso` for boards with a VCXO/GPS/extra GPIO). Set:
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
    A board port is really two halves that must agree: the **FPGA side** (the openwifi-hw Vivado project, which fixes addresses/interrupts; see [FPGA Development](FPGA-Development.md#porting-to-a-new-board)) and the **device-tree side** (this page, which tells Linux those same addresses/interrupts). Get the two to match and the rest of openwifi (driver, `sdrctl`, everything above) works unchanged, because it's all keyed off the `sdr,*` `compatible` strings, not the board.

## Related pages

- [Software Development Workflow](Software-Development-Workflow.md): rebuilding the kernel, transferring images, and building a full SD card.
- [FPGA Development → Porting to a new board](FPGA-Development.md#porting-to-a-new-board): the FPGA half of a board port.
- [Supported Boards](Supported-Boards.md): per-board hardware notes and the 32-bit vs 64-bit boot differences.
- [Architecture](Architecture.md#how-the-driver-talks-to-linux-the-mac80211-api): why the driver is a device-tree platform driver.
- [Troubleshooting → Boot and networking](Troubleshooting.md#boot-and-networking): boot failures and fixes.
