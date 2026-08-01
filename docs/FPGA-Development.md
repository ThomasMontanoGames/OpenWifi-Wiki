# FPGA Development

This page covers building and modifying the FPGA design in the [openwifi-hw](https://github.com/open-sdr/openwifi-hw) repository: full bitstream builds, editing and simulating individual IP cores, conditional compilation, changing the baseband clock, migrating to new Vivado/ADI releases, and porting to a new board.

The design is built **on top of the [Analog Devices HDL reference designs](https://github.com/analogdevicesinc/hdl)** (see the [FPGA overview](FPGA/index.md) for how that fits together and where the [IP Cores](FPGA-IP-Cores.md) reference picks up). For anything that isn't openwifi-specific, the ADI wiki is often the fastest source of answers.

## Prerequisites

First set up the shared host toolchain: see [Environment Setup](Development-Environment-Setup.md) (Vivado 2022.2 with Vitis, Ubuntu packages such as `libtinfo5`, and the `XILINX_DIR` and `BOARD_NAME` environment variables). FPGA builds additionally need:

- The **evaluation license of the Xilinx Viterbi Decoder** installed into Vivado. (This eval license is why a running board's decoder halts after ~2 hours, see [Troubleshooting](Troubleshooting.md).)

Set `export XILINX_DIR=/opt/Xilinx` and `export BOARD_NAME=<your board>` before building. If the software and FPGA repos disagree on the Vivado version, match the one the repo README states at the time you build (see [Environment Setup](Development-Environment-Setup.md#xilinx-toolchain-vivado-vitis)).

## Building the bitstream

Run these from the `openwifi-hw` repo root unless noted.

1. **Prepare the ADI HDL library** (once ever):

   ```bash
   ./prepare_adi_lib.sh $XILINX_DIR
   ```

2. **Prepare ADI board-specific IP** (once per board):

   ```bash
   ./prepare_adi_board_ip.sh $XILINX_DIR $BOARD_NAME
   # You can stop it once it prints "Building ABCD project [..."
   ```

3. **Pull in openofdm_rx** (once, and again whenever openofdm is updated):

   ```bash
   ./get_ip_openofdm_rx.sh
   ```

4. **Generate the IP repo and top-level project** (takes a while):

   ```bash
   cd boards/$BOARD_NAME/
   ../create_ip_repo.sh $XILINX_DIR
   ```

   If Vitis HLS errors with `'2xxxxxxxxx' is an invalid argument. Please specify an integer value`, apply the fix in [Xilinx article 76960](https://support.xilinx.com/s/article/76960).

5. **In Vivado**, open the project and generate the bitstream:

   ```
   source ../openwifi.tcl
   # then in the GUI: Generate Bitstream
   # then: File → Export → Export Hardware → Include bitstream → Finish
   ```

   (The previous `create_ip_repo.sh` step invokes this automatically. The manual steps are for when you're iterating in the GUI.)

6. **Stash the outputs** where the software build can find them:

   ```bash
   cd boards
   ./sdk_update.sh $BOARD_NAME $OPENWIFI_HW_IMG_DIR
   ```

   This copies the FPGA image (`.xsa`, `.ltx`) and git info into `$OPENWIFI_HW_IMG_DIR` so the openwifi (software) build can pick it up (see [Software Development Workflow](Software-Development-Workflow.md#updating-the-fpga-image-on-a-running-board)).

Prebuilt outputs for each board live in the **openwifi-hw-img** repo under `boards/$BOARD_NAME/sdk/` (bitstream, ILA `.ltx`, init files) if you'd rather not synthesize.

## Modifying an IP core

IP core projects live in `ip/<ip_name>/` (e.g. `xpu`, `tx_intf`, `rx_intf`, `openofdm_tx`, `openofdm_rx`, `side_ch`). To open one as its own Vivado project:

```bash
cd ip/<ip_name>
../create_vivado_proj.sh $XILINX_DIR <ip_name>.tcl
```

Make your changes there, then re-integrate into the board design by re-running `../create_ip_repo.sh $XILINX_DIR` from the board directory. If a complex change breaks `create_ip_repo.sh`, read `create_ip_repo.sh` / `ip_repo_gen.tcl` and adjust them (e.g. to include newly added files).

## Simulating an IP core

Most cores ship a top-level testbench (`*_tb.v`), which is the fastest way to develop without hardware. Using `openofdm_rx` as the example:

1. Create the IP's Vivado project (as above): `./create_vivado_proj.sh $XILINX_DIR openofdm_rx.tcl`.
2. In Vivado: *Sources → Simulation Sources → sim_1 → dot11_tb*.
3. *SIMULATION → Run Simulation → Run Behavioral Simulation.* The first run is slow because sub-IP cores compile once. Later runs are fast.
4. Press **Run All (F3)** to run to completion.
5. The testbench uses `$fopen`/`$fscanf`/`$fwrite` to read test vectors and dump variables for later checking. Read `*_tb.v` to see the flow. Simulation-specific settings live in `openofdm_rx_pre_def.v`.
6. After editing design files, use **Relaunch Simulation**. Drag any signal from *SIMULATION → Scope* (e.g. `dot11_tb → dot11_inst → ofdm_decoder_inst → viterbi_inst`) into the waveform view and relaunch to inspect it.

## Conditional compilation with Verilog macros

`create_vivado_proj.sh` accepts extra arguments that become `` `define `` macros in `<ip_name>_pre_def.v`, letting you enable/disable code blocks (ILA/debug, feature variants). The argument order:

- 1st: `BOARD_NAME`
- 2nd: `NUM_CLK_PER_US` (e.g. `100` for 100 MHz)
- 3rd–7th: your own macro names → become `` `define IP_NAME_<NAME> `` (for `openofdm_rx`, the 3rd argument instead selects the simulation `SAMPLE_FILE`, changeable later in the pre_def file)

When building the **top-level** project, pass the *same* macros to `create_ip_repo.sh` so the IP is compiled identically:

```bash
./create_ip_repo.sh $XILINX_DIR \
  xpu ENABLE_DBG tx_intf ENABLE_DBG rx_intf ENABLE_DBG \
  openofdm_tx ENABLE_DBG openofdm_rx ENABLE_DBG side_ch ENABLE_DBG
```

(That example turns on ILA/debug in every core. Only `xpu`, `tx_intf`, `rx_intf`, `openofdm_tx`, `openofdm_rx`, and `side_ch` accept macros here.)

Pair these FPGA macros with the driver's conditional-compile arguments (see [Software Development Workflow](Software-Development-Workflow.md#conditional-compilation)) to build matched driver+FPGA variants, then package them with `drv_and_fpga_package_gen.sh`.

## Changing the baseband clock

The default baseband clock is 100 MHz, set by `NUM_CLK_PER_US` at the top of `openwifi.tcl`. Available options depend on the board: 240/100 MHz on ZCU102, 100/200 MHz on ZC706 and ADRV9361-Z7035, and 100 MHz elsewhere. Change the value and re-run `openwifi.tcl` to regenerate the project.

## High-Level Synthesis (HLS) modules

Two receiver modules, channel estimation (`ch_gain_cal`) and equalization (`equalizer`), are also available as C++ that Vitis HLS turns into Verilog, which can speed up algorithm development.

**To build with the HLS receiver:** follow the bitstream build up to *before* generating `ip_repo`, then switch `openofdm_rx` to the HLS branch:

```bash
cd ip/openofdm_rx
git checkout dot11zynq_hls
```

Continue the build. Before generating the bitstream, select `openofdm_rx` under *IP Status* and click *Upgrade Selected*.

**To modify the HLS code:** run `./get_ip_openofdm_rx.sh`, check out `dot11zynq_hls`, then in Vitis HLS create a project importing the source files (except `*_test.cpp`) from the [`ch_gain_cal`](https://github.com/open-sdr/openofdm/tree/dot11zynq_hls/hls/ch_gain_cal) or [`equalizer`](https://github.com/open-sdr/openofdm/tree/dot11zynq_hls/hls/equalizer) folder, choosing that module as top level and its `*_test.cpp` as testbench, and selecting the FPGA part for your board. After C-sim and co-sim pass, *Export RTL* produces a ZIP whose `hdl/verilog` folder replaces the corresponding folder under `openwifi-hw/ip/openofdm_rx/hls/.../hdl/verilog/`. Update `openofdm_rx.tcl` to include the new files ([example](https://github.com/open-sdr/openofdm/blob/dot11zynq_hls/openofdm_rx.tcl#L268)). If you changed the top-level function arguments, wire them up in [`dot11.v`](https://github.com/open-sdr/openofdm/blob/dot11zynq_hls/verilog/dot11.v). Then resume the normal build from "generate ip_repo." Background: the [FCCM 2023 poster](https://arxiv.org/abs/2305.13351).

## Migrating to a new Vivado / ADI release

Two approaches:

- **Vivado auto-upgrade.** Create the design in the current Vivado version, open it in the target version and let Vivado upgrade it, then export the upgraded project as a `.tcl` and diff it against the original `openwifi.tcl` to see what changed (openwifi's own commits on `openwifi.tcl` show how past migrations were handled).
- **Start fresh from the new ADI reference design, then add openwifi IP.** Export the openwifi IP hierarchy from the current design with `write_bd_tcl`, then `source` it into a new/target ADI reference design and instantiate it:

  ```tcl
  write_bd_tcl -hier_blks [get_bd_cells /hier_mig] ./mig_hierarchy.tcl
  source ./mig_hierarchy.tcl
  create_hier_cell_hier_mig / my_new_hierarchy
  ```

The primary reference is Xilinx UG994 (*Designing IP Subsystems Using IP Integrator*).

## Porting to a new board

openwifi's baseline is tag `2022_R2` of the ADI HDL reference designs (the `adi-hdl` submodule pin). The porting mindset is: **diff openwifi against the matching ADI reference design, then replicate those changes on your target board.**

1. Open the ADI reference design for your platform (e.g. `hdl/projects/fmcomms2/zc706`) and the corresponding openwifi board design (`openwifi-hw/boards/zc706_fmcs2`) side by side.
2. Use *Open Block Design* and compare both the **diagram** and the **Address Editor**. That's where openwifi's additions show up.
3. The addresses and interrupts of every FPGA block hooked to the ARM bus must be reflected in the board's device tree, `openwifi/kernel_boot/boards/<board_name>/devicetree.dts`. Linux parses `devicetree.dtb` at boot to discover these blocks. (openwifi obtains a `.dts` by running `dtc` on the ADI image's `.dtb`, then edits it to match the added/modified blocks.)
4. Study the image-build scripts (see [Software Development Workflow](Software-Development-Workflow.md#building-a-full-sd-image-from-scratch)) to understand how `devicetree.dtb`, `BOOT.BIN`, and the kernel come together into a bootable SD image.

## Debugging on hardware

Use the Xilinx **ILA** (Integrated Logic Analyzer) to watch internal FPGA signals in real time, which is the clearest way to understand the low-MAC and interface state machines in `xpu`, `tx_intf`, and `rx_intf`. Enable the debug macros (see conditional compilation above) to insert ILA cores. The prebuilt `.ltx` in openwifi-hw-img matches the shipped bitstreams. Background and an example are in [openwifi-hw issue #39](https://github.com/open-sdr/openwifi-hw/issues/39). See also the [GPIO/LED map](https://github.com/open-sdr/openwifi-hw/blob/master/gpio_led.md), which routes signals like `tx_bb_is_ongoing`, `tx_rf_is_ongoing`, `fcs_ok`, and `demod_is_ongoing` to board LEDs and PMOD pins for scope/logic-analyzer probing.
