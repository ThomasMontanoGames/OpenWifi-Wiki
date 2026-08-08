# Software

openwifi's software lives in the [openwifi](https://github.com/open-sdr/openwifi) repository: the kernel modules in `driver/` that sit between Linux `mac80211` and the FPGA, and the on-board tools and scripts in `user_space/`. The driver is a Linux **platform driver** built against the [Analog Devices kernel](https://github.com/analogdevicesinc/linux), so ADI's kernel patches are a prerequisite for anything here.

- **[Software Development Workflow](../Software-Development-Workflow.md)** is the **workflow**: rebuilding and deploying the driver, `sdrctl`, and images without rebooting. Start here when you want to *build, change, or deploy* the software.

- **[The Linux Driver](../Driver-Architecture.md)** is the **reference**: the kernel modules, the `mac80211` callback surface, and the transmit and receive paths. Start here when you want to *understand* what `sdr.ko` does between a `mac80211` callback and a register write.

If you are chasing a load-order problem or a packet that is not arriving, go to [The Linux Driver](../Driver-Architecture.md). If you have a working understanding of the driver and want to get a change onto a board, go to [Software Development Workflow](../Software-Development-Workflow.md).

Before either one, set up the shared host toolchain on the [Environment Setup](../Development-Environment-Setup.md) page. For the FPGA half of the stack see [FPGA](../FPGA/index.md), and for the broader picture of how Linux, the driver, and the FPGA fit together see [Architecture](../Architecture.md).
