# Software

openwifi's software lives in the [openwifi](https://github.com/open-sdr/openwifi) repository: the kernel modules in `driver/` that sit between Linux `mac80211` and the FPGA, and the on-board tools and scripts in `user_space/`. The driver is a Linux **platform driver** built against the [Analog Devices kernel](https://github.com/analogdevicesinc/linux), so ADI's kernel patches are a prerequisite for anything here.

This section splits the software material into two halves, depending on what you are trying to do:

- **[Software Development Workflow](../Software-Development-Workflow.md)** is the **workflow**: the quick reference from code change to running board, the driver iteration loop, rebuilding the driver and `sdrctl`, conditional compilation, reloading the driver and FPGA image without rebooting, and the bulk update helpers. Start here when you want to *build, change, or deploy* the software.

- **[The Linux Driver](../Driver-Architecture.md)** is the **reference**: the six kernel modules and how they map onto the FPGA cores, how the driver finds its hardware at boot, the `mac80211` callback surface, the transmit and receive paths, and the two channels to user space. Start here when you want to *understand* what `sdr.ko` does between a `mac80211` callback and a register write.

If you are chasing a load-order problem or a packet that is not arriving, go to [The Linux Driver](../Driver-Architecture.md). If you have a working understanding of the driver and want to get a change onto a board, go to [Software Development Workflow](../Software-Development-Workflow.md).

Before either one, set up the shared host toolchain on the [Environment Setup](../Development-Environment-Setup.md) page. For the FPGA half of the stack see [FPGA](../FPGA/index.md), and for the broader picture of how Linux, the driver, and the FPGA fit together see [Architecture](../Architecture.md).
