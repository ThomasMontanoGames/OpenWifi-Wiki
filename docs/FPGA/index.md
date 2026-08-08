# FPGA

openwifi's hardware lives in the [openwifi-hw](https://github.com/open-sdr/openwifi-hw) repository and is built **on top of the [Analog Devices HDL reference designs](https://github.com/analogdevicesinc/hdl)**: openwifi adds its own IP cores and modifications to ADI's board projects. For anything that isn't openwifi-specific, the ADI wiki is often the fastest source of answers.

- **[FPGA Development](../FPGA-Development.md)** is the **workflow**: building, simulating, and porting the design. Start here when you want to *build or change* the design.

- **[FPGA IP Cores](../FPGA-IP-Cores.md)** is the **reference**: the signal chain and a per-core breakdown, including how each core exposes itself to the driver through its register space. Start here when you want to *understand* what a core does or what a register write actually reaches.

If you are reading the [register reference](../sdrctl-and-Runtime-Control.md) and want to know what is on the other end of a register write, go to [FPGA IP Cores](../FPGA-IP-Cores.md). If you have a working understanding of the cores and want to rebuild or port the design, go to [FPGA Development](../FPGA-Development.md). For the broader picture of how Linux, the driver, and the FPGA fit together, see [Architecture](../Architecture.md).
