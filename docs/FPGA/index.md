# FPGA

openwifi's hardware lives in the [openwifi-hw](https://github.com/open-sdr/openwifi-hw) repository and is built **on top of the [Analog Devices HDL reference designs](https://github.com/analogdevicesinc/hdl)**: openwifi adds its own IP cores and modifications to ADI's board projects. For anything that isn't openwifi-specific, the ADI wiki is often the fastest source of answers.

This section splits the FPGA material into two halves, depending on what you are trying to do:

- **[FPGA Development](../FPGA-Development.md)** is the **workflow**: prerequisites and toolchain, building the full bitstream, editing and simulating individual IP cores, conditional compilation, changing the baseband clock, High-Level Synthesis modules, migrating to a new Vivado/ADI release, porting to a new board, and debugging on hardware. Start here when you want to *build or change* the design.

- **[FPGA IP Cores](../FPGA-IP-Cores.md)** is the **reference**: the signal chain that ties the cores together and a per-core breakdown of `xpu`, `openofdm_tx`, `openofdm_rx`, `tx_intf`, `rx_intf`, and `side_ch`, including how each exposes itself to the driver through its register space. Start here when you want to *understand* what a core does or what a register write actually reaches.

If you are reading the [register reference](../sdrctl-and-Runtime-Control.md) and want to know what is on the other end of a register write, go to [FPGA IP Cores](../FPGA-IP-Cores.md). If you have a working understanding of the cores and want to rebuild or port the design, go to [FPGA Development](../FPGA-Development.md). For the broader picture of how Linux, the driver, and the FPGA fit together, see [Architecture](../Architecture.md).
