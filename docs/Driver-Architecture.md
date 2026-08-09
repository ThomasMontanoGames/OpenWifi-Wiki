# The Linux Driver

This is a reference for the **openwifi Linux driver**, the code in [`openwifi/driver/`](https://github.com/open-sdr/openwifi/tree/master/driver) that sits between Linux `mac80211` and the FPGA: which kernel modules exist, how the driver finds its hardware at boot, how a packet moves through the transmit and receive rings, and where the register definitions live. For rebuilding and deploying the driver, see [Software Development Workflow](Software-Development-Workflow.md).

## One driver, six kernel modules

openwifi is not a single kernel module. `sdr.ko` is the main driver, and it depends on five small per-core modules that each wrap register access to one FPGA core. This is why [`wgd.sh`](Software-Development-Workflow.md) inserts a list of modules rather than just one, and why load order matters.

Each per-core module binds to its own device-tree node through its own `compatible` string and exports an API struct that `sdr.ko` calls into. Apart from `sdr.ko` itself, every module is a thin wrapper around register access to one core, so the last column below lists what those registers control.

The naming is regular enough to be worth stating once instead of tabulating. A module named `X.ko` is built from `driver/X/X.c`, binds to the device-tree node `compatible = "sdr,X"`, and drives the FPGA core in `openwifi-hw/ip/X/src/X.v`. Only the table's Source column departs from that, and only twice: `sdr.c` sits at the top of `driver/` rather than in its own subdirectory, and the OFDM receiver's top module is `dot11.v` inside the [openofdm submodule](FPGA-IP-Cores.md#openofdm_rx-the-ofdm-receiver) rather than `openofdm_rx.v`.

| Module | Source (driver ↔ FPGA) | Registers control |
|---|---|---|
| `sdr.ko` | `sdr.c` | The main driver, not a register wrapper: implements `ieee80211_ops`, owns the four TX rings and the RX cyclic buffer, handles both interrupts, creates the `sdr0` interface |
| `xpu.ko` | `xpu.c` ↔ `xpu.v` | The real-time MAC: CSMA/CA config, TSF load and read, BSSID and address filtering, ACK timing and retransmission limits, LBT threshold, time slicing |
| `tx_intf.ko` | `tx_intf.c` ↔ `tx_intf.v` | The TX interface: baseband gain, antenna select, FIFO thresholds, interrupt source select, CTS-to-self config, CSI fuzzer |
| `rx_intf.ko` | `rx_intf.c` ↔ `rx_intf.v` | The RX interface: IQ source select (including FPGA loopback), baseband gain, antenna select, interrupt delay, tlast timeout |
| `openofdm_tx.ko` | `openofdm_tx.c` ↔ `openofdm_tx.v` | The OFDM transmitter, and very little of it: reset, plus the scrambler pilot and data seeds |
| `openofdm_rx.ko` | `openofdm_rx.c` ↔ `dot11.v` | The OFDM receiver: power threshold, minimum plateau, soft decoding, FFT window shift, phase-offset threshold, state history |

The top-level `driver/Makefile` builds all six in one line:

```makefile
obj-m += sdr.o openofdm_rx/openofdm_rx.o openofdm_tx/openofdm_tx.o tx_intf/tx_intf.o rx_intf/rx_intf.o xpu/xpu.o
```

`side_ch.ko` is **deliberately not in that list**. It has its own `make_driver.sh` and is built and loaded separately, because you load it on demand for research capture rather than always running it. See [FPGA IP Cores](FPGA-IP-Cores.md#side_ch-the-csi-iq-capture-side-channel) and [Research Features](Research-Features.md).

!!! note "`driver/xilinx_dma/` is a historical leftover"
    The driver tree contains an `xilinx_dma` directory. Its own README says openwifi no longer maintains a modified Xilinx DMA driver and that the stock in-kernel one is used instead. Do not treat it as a live component.

## How the driver finds its hardware

openwifi is a Linux **platform driver**, not PCI or USB. There is no bus to enumerate, so everything it knows about the hardware comes from the device tree. This is why [porting a board](FPGA-Development.md#porting-to-a-new-board) is largely a device-tree exercise.

`openwifi_dev_probe()` in `sdr.c` runs at load time and does roughly this:

1. **Match the device-tree node.** The driver binds to `compatible = "sdr,sdr"`. No matching node means no probe, which is the usual cause of "the module loaded but `sdr0` never appeared."
2. **Allocate the mac80211 device** with `ieee80211_alloc_hw()` against `openwifi_ops`.
3. **Detect the board.** The driver reads the **`model` string of the device-tree root** and matches on substrings. `ZCU102` means `ZYNQMP_AD9361`, anything else with a model string means `ZYNQ_AD9361`. Separately, `ZCU102`, `Z7035`, and `ZC706` are classified `LARGE_FPGA` and everything else falls back to `SMALL_FPGA`. If there is no model string at all, the driver looks for an `lmk` node (the TI LMK04828 clock chip) and, if it finds one, treats the board as an `RFSOC4X2`. This detection is what makes capture-buffer length and similar limits adapt per board without configuration. See [Supported Boards](Supported-Boards.md).
4. **Find the AD9361.** On everything except the RFSoC4x2, the driver locates the `ad9361-phy` device on the SPI bus and the `cf-ad9361-dds-core-lpc` platform device, then keeps handles to the ADI PHY and DDS state so it can call into the standard Analog Devices IIO driver later (`ad9361_set_tx_atten`, `ad9361_do_calib_run`, and so on). A missing or unprobed AD9361 driver fails the openwifi probe outright, which is why ADI kernel patches are a prerequisite.
5. **Request the DMA channels** by name: `rx_dma_s2mm` and `tx_dma_mm2s`.
6. **Request the interrupts.** The RX packet interrupt is device-tree interrupt index **1** (`sdr,rx_pkt_intr`) and the TX interrupt is index **3** (`sdr,tx_itrpt`), both registered `IRQF_SHARED`.

The driver also takes two module parameters worth knowing: `test_mode` (bit 0 enables A-MPDU aggregation, which is what `./wgd.sh 1` sets, and bit 1 advertises short guard interval, see [Wi-Fi 4 & Wi-Fi 6 Features](Wi-Fi-4-and-Wi-Fi-6.md#short-guard-interval)) and `init_tx_att` (TX attenuation in millidB, so 3000 means 3 dB).

## The mac80211 callback surface

`mac80211` defines a set of callbacks (`ieee80211_ops`) that every SoftMAC driver implements. `sdr.c` implements the relevant subset in `openwifi_ops`, and each callback turns into FPGA register writes or DMA activity.

| Callback | When Linux calls it |
|---|---|
| `tx` | There is a packet to transmit |
| `start` / `stop` | The NIC is brought up or down (`ifconfig sdr0 up/down`) |
| `add_interface` / `remove_interface` | A virtual interface is created or deleted |
| `config` | Channel or frequency change, for example during a scan |
| `bss_info_changed` | BSS parameters change (BSSID, TX power, beacon interval) |
| `conf_tx` | TX parameters change (AIFS, CW_MIN, CW_MAX, TXOP) |
| `configure_filter` | Frame-filtering rules change |
| `prepare_multicast` | Multicast filter list is rebuilt |
| `set_antenna` / `get_antenna` | Select or read the TX/RX antenna |
| `get_tsf` / `set_tsf` / `reset_tsf` | Read, write, or reset the 64-bit TSF hardware timer |
| `set_rts_threshold` | Change the packet length that triggers RTS/CTS |
| `ampdu_action` | A-MPDU (aggregation) operations |
| `rfkill_poll` | Poll the wireless kill switch |
| `testmode_cmd` | Handles `sdrctl` commands, see below |

Up to `MAX_NUM_VIF` (4) virtual interfaces are supported.

## The transmit path inside the driver

Linux hands `openwifi_tx()` one frame at a time. The driver keeps **four TX rings** (`MAX_NUM_SW_QUEUE`), one per Linux priority, mapping one-to-one onto the four hardware queues in `tx_intf`. Each ring holds `NUM_TX_BD` = **64** buffer descriptors, a size that the comment in `sdr.h` warns must stay aligned with the FIFO size in `tx_bit_intf.v`. Each descriptor buffer is `TX_BD_BUF_SIZE` = 8192 bytes.

The sequence:

1. `openwifi_tx()` reads what it needs from the 802.11 header and the mac80211 metadata: length and MCS, unicast versus broadcast, whether an ACK is required and how many retransmissions the FPGA may attempt, whether RTS/CTS or CTS-to-self protection applies, and whether the driver should insert a sequence number.
2. **Queue selection.** By default `drv_ring_idx = prio`, taken straight from `skb_get_queue_mapping()`. If a slice configuration is active (`priv->slice_idx != 0xFFFFFFFF`), the driver instead matches the frame's destination address against `dest_mac_addr_queue_map[]` and picks the queue that owns that MAC, falling back to the Linux priority if no address matches. This is the driver half of [MAC-address time slicing](sdrctl-and-Runtime-Control.md#time-slicing-network-slicing).
3. The driver advances `ring->bd_wr_idx`, writes the per-packet FPGA configuration so the FPGA generates the right PHY header, and fires a DMA transfer into the chosen hardware queue.
4. The packet does not necessarily go out yet. The `xpu` core releases it when CSMA/CA allows.
5. When the FPGA finishes, it raises the TX interrupt. `openwifi_tx_interrupt()` reads back the result, recovering the priority and queue index from the status register bits, learns whether an ACK came back and how many retransmissions happened, and reports it to Linux with `ieee80211_tx_status_irqsafe()`.

Each ring tracks `bd_wr_idx`, `bd_rd_idx`, and a `stop_flag`, so the running `openwifi_tx()`, the FPGA, and the interrupt handler can cross-check each other. When a ring runs low (`RING_ROOM_THRESHOLD`), the driver stops the Linux queue and the interrupt handler wakes it again once the FPGA drains.

!!! tip "The documented extension point"
    The queue-mapping block in `openwifi_tx()` is marked in the source with:

    ```c
    // ---- DO your idea here! Map Linux/SW "prio" to driver "drv_ring_idx" (then 1on1 to FPGA queue_idx) ---
    ```

    This is the intended hook for scheduling research, and it is where most TSN and real-time work on openwifi starts.

## The receive path inside the driver

Receive does not use a descriptor ring in the same way. The driver allocates a **cyclic DMA buffer** of `NUM_RX_BD` slots, each `RX_BD_BUF_SIZE` = 2048 bytes, and the FPGA writes into it continuously. `NUM_RX_BD` is 64 when `USE_NEW_RX_INTERRUPT` is set and 16 otherwise.

`rx_intf` prepends a **16-byte metadata header** to every received packet, and parsing it is the first thing `openwifi_rx()` does. The exact layout:

| Offset | Size | Field |
|---|---|---|
| 0 | 4 | TSF timestamp, low 32 bits |
| 4 | 4 | TSF timestamp, high 32 bits |
| 8 | 2 | `rssi_half_db` (RSSI in half-dB steps) |
| 10 | 2 | AGC status and packet-exist flag |
| 12 | 2 | Frame length |
| 14 | 2 | Rate index and PHY flags |
| 16 | *len* | The 802.11 frame itself |

The rate field at offset 14 is packed. The low 5 bits are the rate index (valid range 8 to 23), where bit 4 doubles as the HT flag, so an index of 16 or above means 802.11n. Bit 5 is short guard interval, bit 6 is A-MPDU aggregation, bit 7 marks the last subframe of an aggregate, and the high byte carries the measured phase offset.

The FCS-OK bit is **not in the header**. It is the top bit (`0x80`) of the *last byte of the frame payload*, at offset `16 + len - 1`. This is easy to miss when writing a custom parser.

The driver then converts `rssi_half_db` into dBm using the per-band and per-channel `rssi_correction` value, and hands the frame plus its metadata to Linux with `ieee80211_rx_irqsafe()`. The packet-exist flag at offset 10 is how the handler knows whether a slot actually holds a new packet, since the FPGA writes into the buffer asynchronously.

Because the TSF timestamp is attached here from the same 64-bit counter that `side_ch` uses, side-channel captures and packets share one time base. That is the basis of the [CSI-to-packet matching recipe](Architecture.md#the-tsf-timestamp).

## Where the registers are defined

`driver/hw_def.h` is the single source of truth for register addresses. It holds the `compatible` strings, the hardware-type and band enums, and one block of address defines per core, written as simple word offsets:

```c
#define TX_INTF_REG_BB_GAIN_ADDR                   (13*4)
#define TX_INTF_REG_ANT_SEL_ADDR                   (16*4)
```

Each of these corresponds directly to a `slv_regN` in that core's `*_s_axi.v`, so `TX_INTF_REG_BB_GAIN_ADDR` is `slv_reg13` in `tx_intf_s_axi.v`. The [sdrctl register tables](sdrctl-and-Runtime-Control.md) document what the values mean.

## Two channels to user space

**1. `sdrctl`, through nl80211 testmode.** `sdrctl` sends an nl80211 testmode message that travels the standard `nl80211 → cfg80211 → mac80211` path into `openwifi_testmode_cmd()` in `sdrctl_intf.c`. Best for issuing commands and for reading and writing registers.

The register *category* is packed into the **upper 16 bits of the address**:

```c
reg_cat  = ((reg_addr>>16)&0xFFFF);
```

The categories are a plain enum in `sdr.h`, and the numbering is fixed across the whole stack:

| Value | Category | Target |
|---|---|---|
| 1 | `RF` | AD9361, via the ADI driver |
| 2 | `RX_INTF` | `rx_intf` core |
| 3 | `TX_INTF` | `tx_intf` core |
| 4 | `RX` | `openofdm_rx` core |
| 5 | `TX` | `openofdm_tx` core |
| 6 | `XPU` | `xpu` core |
| 7 | `DRV_RX` | Driver-side RX shadow registers |
| 8 | `DRV_TX` | Driver-side TX shadow registers |
| 9 | `DRV_XPU` | Driver-side XPU shadow registers |

Categories 1 and 7 to 9 never reach the FPGA. They are driver and RF software state, such as `DRV_TX_REG_IDX_RATE` (a forced TX rate), `DRV_RX_REG_IDX_DEMOD_TH`, `DRV_XPU_REG_IDX_LBT_TH`, and the `PRINT_CFG` registers that control which packets get logged to `dmesg` (`DMESG_LOG_ERROR`, `DMESG_LOG_UNICAST`, `DMESG_LOG_BROADCAST`).

So `sdrctl dev sdr0 set reg xpu 11 16` becomes an nl80211 testmode message, then `openwifi_testmode_cmd()`, then `xpu_api->reg_write`, then an AXI-Lite write to `slv_reg11` in `xpu_s_axi.v`.

**2. sysfs, through `sysfs_intf.c`.** Driver variables exposed as virtual files, which is better for statistics and for scripting. `sysfs_intf.c` is large (around 1270 lines) and almost all of it is `DEVICE_ATTR` boilerplate exposing counters: per-priority and per-queue TX totals, ACK successes and failures, retransmission counts, real-time MCS histograms for data and management frames, per-frame-type RX totals and failures, and AGC gain values. `stat_enable` gates collection, and `rx_target_sender_mac_addr` narrows statistics to one peer.

On the ZCU102 these files live under `/sys/devices/platform/fpga-axi@0/fpga-axi@0:sdr`. On other boards they are under `/sys/devices/soc0/fpga-axi@0/fpga-axi@0:sdr`. See [Research Features](Research-Features.md#counters-and-statistics).

## Where the source lives

| Component | Location |
|---|---|
| Main driver | `openwifi/driver/sdr.c`, `sdr.h` |
| Per-core driver APIs | `openwifi/driver/{tx_intf,rx_intf,openofdm_tx,openofdm_rx,xpu}/` |
| Register addresses | `openwifi/driver/hw_def.h` |
| sdrctl glue | `openwifi/driver/sdrctl_intf.c` |
| sysfs interface | `openwifi/driver/sysfs_intf.c` |
| Side channel (separate module) | `openwifi/driver/side_ch/` |
| Build script for all modules | `openwifi/driver/make_all.sh` |
