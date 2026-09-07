# Supported Boards and Hardware

openwifi runs on a range of **Xilinx Zynq-7000 / Zynq UltraScale+ (MPSoC)** SoC boards, nearly all paired with an **Analog Devices AD9361-family** RF front end (FMCOMMS2/3/4 or an integrated equivalent). The RFSoC4x2 is the exception, using the RFSoC's integrated RF data converters instead (the driver treats it as its own hardware type).

!!! info "The `board_name` is the key identifier"
    Every board has a short `board_name` used identically across all repos: `openwifi-hw/boards/<board_name>/`, `openwifi-hw-img/boards/<board_name>/sdk/`, and `openwifi/kernel_boot/boards/<board_name>/`. Set `export BOARD_NAME=<board_name>` before running any build script. See [Repositories](Repositories.md).

## The board matrix

| `board_name` | Hardware | SoC | Vivado license required? | Notes |
|---|---|---|---|---|
| `zc706_fmcs2` | Xilinx ZC706 + AD-FMCOMMS2/3/4 | Zynq-7045 | **Yes** | High-end dev board, 100/200 MHz baseband clock options |
| `zed_fmcs2` | Avnet/Digilent ZedBoard + AD-FMCOMMS2/3/4 | Zynq-7020 | No | The classic reference board, fully tested |
| `zc702_fmcs2` | Xilinx ZC702 + AD-FMCOMMS2/3/4 | Zynq-7020 | No | |
| `zcu102_fmcs2` | Xilinx ZCU102 + AD-FMCOMMS2/3/4 | **Zynq UltraScale+ (64-bit)** | **Yes** | The main 64-bit board, needs ATF/PMUFW boot stages, 240/100 MHz baseband clock |
| `adrv9364z7020` | ADRV9364-Z7020 SoM + ADRV1CRR-BOB breakout carrier | Zynq-7020 | No | Integrated AD9364 (single RX/TX) |
| `adrv9361z7035` | ADRV9361-Z7035 SoM + ADRV1CRR-BOB/FMC | Zynq-7035 | **Yes** | AD9361 (2×2 capable), **very low TX power at 5 GHz**, 100/200 MHz baseband clock |
| `antsdr` | MicroPhase enhanced ADALM-Pluto | Zynq-7020 | No | See caveat below |
| `e310v2` | MicroPhase "new antsdr" (E310 v2) | Zynq-7020 | No | Adds GPS + external ref + VCXO |
| `antsdr_e200` | MicroPhase enhanced ADALM-Pluto (smaller/cheaper) | Zynq-7020 | No | Ethernet on PL side |
| `sdrpi` | HexSDR, Raspberry-Pi-form-factor SDR | Zynq-7020 | No | GPS + rich I/O |
| `neptunesdr` | Low-cost Zynq-7020 + AD9361 board | Zynq-7020 | No | **Unofficial / community** |
| `rfsoc4x2` | AMD RFSoC4x2 | Zynq UltraScale+ RFSoC | **Yes** | Listed in openwifi-hw README |
| `LibreSDR` | Low-cost Zynq-7020 + AD9361 board | Zynq-7020 | No | **Unofficial**, external repo [openwifi-libresdr](https://github.com/pavelyazev/openwifi-libresdr) |

The **Vivado license** column only matters if you rebuild the FPGA from source. The [prebuilt bitstreams](https://github.com/open-sdr/openwifi-hw-img) run on any board with no license. Boards on the Zynq-7020 qualify for the free Vivado tier.

!!! warning "Small-FPGA (Zynq-7020) boards have reduced buffers"
    Boards built on the Zynq-7020 (ZedBoard, ADRV9364-Z7020, ZC702, `antsdr`, `e310v2`, `antsdr_e200`, `sdrpi`, `neptunesdr`, `LibreSDR`) have less block RAM. The `side_ch` capture engine shrinks its DMA buffer on these (`SIDE_CH_LESS_BRAM`), so **IQ/CSI capture lengths are capped lower**: `iq_len_init` at most 4095 and `pre_trigger_len` at most 4094, instead of the 8187/8190 the larger FPGAs allow. The relevant [Research Features](Research-Features.md) recipes call this out.

## No hardware? Use the testbed

If you have no board at all, the imec **[w-iLab.t testbed](https://doc.ilabt.imec.be/ilabt/wilab/tutorials/openwifi.html)** offers remote access to openwifi-ready boards (and supports JTAG boot instead of SD-card boot). It is the fastest way to try openwifi and to develop against real hardware you don't own.

## The community / MicroPhase / HexSDR boards in detail

### ANTSDR (MicroPhase)

An enhanced ADALM-Pluto: Zynq-7020 + AD936x, usable both as a generic SDR (PlutoSDR/FMCOMMS-class) and as an openwifi platform.

!!! warning "ANTSDR RF-switch frequency limitation"
    The stock ANTSDR RF front-end switch is **hardcoded to the high band and only passes 3–6 GHz**, so frequencies below 3 GHz are blocked. A known TODO is to add RF-switch control to the device tree so the switch tracks the tuned frequency. Until then, plan to test ANTSDR in the 5 GHz band. (`openwifi/kernel_boot/boards/antsdr/notes.md`.)

### ANTSDR-E200 (MicroPhase)

A smaller, cheaper sibling of the ANTSDR-E310. Its distinguishing feature: the **network port is moved to the PL (FPGA fabric) side** rather than the Zynq PS side, for bandwidth reasons. Above a 20 Msps baseband sample rate the Ethernet link carries about 80 MB/s, and the PS-side Zynq GEM controller would saturate the CPU. Both paths exist: the PL-side Ethernet serves the high-rate SDR traffic and lets the E200 support the UHD driver (via MicroPhase's separate `antsdr_uhd` project), while IIO-based SDR drivers are unaffected because they still use the Zynq PS GEM controller.

![ANTSDR-E200 structure](assets/img/e200-struct.svg){ width="800" }

### ANTSDR-E310 v2 (MicroPhase)

An upgraded E310 aimed at LTE/GSM/Wi-Fi experimentation. Over the original E310 it adds **improved RF performance, an onboard GPS module, an external 10 MHz / PPS reference input, and a VCXO**. A DAC steers the VCXO against the external reference, giving a more accurate, stable clock (important for time-sync and TSN work). Like the E200 it puts Ethernet on the PL side, enabling UHD-driver-class throughput.

![ANTSDR-E310 v2 structure](assets/img/e310v2-struct.png)

### SDRPi (HexSDR)

A Zynq-7020 + AD936x SDR in a **Raspberry-Pi form factor**.

| Spec | Value |
|---|---|
| SoC | Zynq XC7Z020-CLG400 |
| Memory | 1 GB PS-side DDR3 |
| Ethernet | Two 1 Gb ports (one PS, one PL) |
| USB | USB OTG, dual USB-UART (PS + PL) |
| Debug | Onboard USB-to-JTAG debugger |
| Boot media | microSD + bootable QSPI flash |
| GPIO | 27 PL-bank 3.3 V pins for connecting other modules |
| RF front end | FMCOMMS3-based, with an added RF amplifier |
| Timing | u-blox M8T GPS module and a 40 MHz VCXO |

## Board bring-up quirks worth knowing up front

- **ADRV9361-Z7035 low 5 GHz TX power.** Keep nodes close (or plan for attenuation) when testing this board at 5 GHz. This is called out in nearly every [Operating Modes](Operating-Modes.md) walkthrough.
- **ZCU102 differs from every other board.** It is the main 64-bit (Zynq UltraScale+) target (the RFSoC4x2 is the only other 64-bit entry in the matrix), so it uses a different boot chain (ARM Trusted Firmware BL31 + PMU firmware, built by `build_zynqmp_boot_bin.sh`), a `system.dts` instead of `devicetree.dts`, and can hit SD-card, RTC, and SODIMM-module issues (see [Troubleshooting](Troubleshooting.md)).
- **neptunesdr** sometimes shows an [`EXT4-fs error` on first boot](Troubleshooting.md#ext4-fs-error-device-mmcblk0p2-on-first-boot). Re-flash with a different imaging tool.
- **CH341-based UART adapters** (antsdr_e200 and others) may need `sudo apt remove brltty` before [the console device appears](Troubleshooting.md#no-uart-console-device-appears).

## The baseband clock per board

The FPGA baseband clock is set by `NUM_CLK_PER_US` at the top of `openwifi-hw/boards/openwifi.tcl` (default **100 MHz**). Available options depend on the board's timing closure:

| Board | Baseband clock options |
|---|---|
| `zcu102_fmcs2` | 240 or 100 MHz |
| `zc706_fmcs2`, `adrv9361z7035` | 100 or 200 MHz |
| all other boards | 100 MHz |

Changing it requires re-running `openwifi.tcl` to regenerate the project (see [FPGA Development → Changing the baseband clock](FPGA-Development.md#changing-the-baseband-clock)). The baseband clock is itself derived from the AD9361 sample clock so RF and baseband never drift. See [Architecture](Architecture.md#rf-and-baseband-the-frequencyclock-design).

## Visual debugging: the GPIO/LED map

openwifi-hw routes several real-time FPGA status signals to board LEDs and PMOD test points, which makes it much easier to scope the TX/RX/CSMA state machine on hardware. Two conventions are used: **flip** (the LED toggles on each event pulse, so it visibly flashes) and **raw** (the line directly mirrors the live 1/0 signal state).

On the **ZCU102**, for example, the LEDs map to:

| LED | Signal (source) | Meaning |
|---|---|---|
| LED0 | `clk_wiz_0 locked` (raw) | RF–baseband clock is locked |
| LED1 | `tx_itrpt_led` (`tx_intf.v`) | Interrupt raised after the FPGA sent a packet |
| LED2 | `tx_end_led` (`tx_intf.v`) | `openofdm_tx` finished generating IQ for a packet |
| LED3 | `fcs_ok_led` (`rx_intf.v`) | `openofdm_rx` reported CRC-OK for a packet |
| LED4 | `demod_is_ongoing_led` (`xpu.v`) | Receiver is actively demodulating |

Plus PMOD test points for `tx_bb_is_ongoing`, `tx_rf_is_ongoing`, and `demod_is_ongoing` (raw), which let you watch TX/RX turnaround timing directly on a scope. The ADRV9361-Z7035 map additionally breaks out `cycle_start`, `sig_valid`, and `phy_tx_started` LEDs plus four `slice_en[0..3]` lines showing which of the four TX queues are gated open. The full per-board table is in [`openwifi-hw/gpio_led.md`](https://github.com/open-sdr/openwifi-hw/blob/master/gpio_led.md).

For how to build with the ILA debug cores that complement these LEDs, see [FPGA Development → Debugging on hardware](FPGA-Development.md#debugging-on-hardware).
