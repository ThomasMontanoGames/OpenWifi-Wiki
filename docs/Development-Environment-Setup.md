# Environment Setup

FPGA rebuilds and the driver, kernel, and software builds all run on the same host toolchain. Set it up once, then follow the workflow you need:

- [Software Development Workflow](Software-Development-Workflow.md) for rebuilding the driver, `sdrctl`, and full SD images.
- [FPGA Development](FPGA-Development.md) for building and modifying the FPGA design.
- [Building SD Images](Building-SD-Images.md) for assembling a card from scratch.

Each workflow has a few extras of its own, such as the FPGA's Viterbi license or the driver's `ARCH_BIT`. Those are noted on the pages above and in the relevant sections here.

For the exact toolchain, kernel, and image versions these builds expect, see [Versions this wiki targets](Repositories.md#versions-this-wiki-targets).

## Xilinx toolchain (Vivado + Vitis)

- **Vivado 2022.2 with Vitis** installed (you need `.../Vitis`, *not* `Vitis_HLS`). If Vitis is missing, add it via *Xilinx Design Tools → Add Design Tools for Devices 2022.2*.
- The driver is cross-compiled with the kernel toolchain, so a Vivado/Vitis install is required for **both** driver and FPGA builds.

> **Which Vivado version?** The *software* side of openwifi historically referenced Vivado 2021.1, while the current openwifi-hw build targets 2022.2. Match the version the repo README states at the time you build.

## Host OS and packages

- Ubuntu 18/20/22 LTS (others may work).
- **`libtinfo5`** for Vivado. On Ubuntu 24 LTS the default `libtinfo6` won't do, so install `libtinfo5` manually:

  ```bash
  wget http://be.archive.ubuntu.com/ubuntu/pool/main/n/ncurses/libtinfo5_6.1-1ubuntu1.18.04.1_amd64.deb
  sudo dpkg -i ./libtinfo5_6.1-1ubuntu1.18.04.1_amd64.deb
  ```

- Driver / kernel build packages:

  ```bash
  sudo apt install flex bison libssl-dev device-tree-compiler u-boot-tools -y
  ```

## Environment variables

Most host-side build steps expect these (use absolute paths):

```bash
export XILINX_DIR=/opt/Xilinx                 # dir containing Vitis/, Vivado/, etc.  (all builds)
export BOARD_NAME=zed_fmcs2                    # your board                            (all builds)
export OPENWIFI_HW_IMG_DIR=/path/to/openwifi-hw-img  # FPGA image + full SD-image builds
export ARCH_BIT=32                             # 32 for Zynq-7000, 64 for Zynq UltraScale+ (e.g. ZCU102)  (software builds)
```

`XILINX_DIR` and `BOARD_NAME` are needed everywhere. `OPENWIFI_HW_IMG_DIR` matters when packaging or deploying an FPGA image, and `ARCH_BIT` (`32` for Zynq-7000 boards, `64` for Zynq UltraScale+) is used throughout the software builds.
