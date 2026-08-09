# FAQ and Resources

## Frequently asked questions

### Is openwifi a real Wi-Fi chip?

It's a full-stack Wi-Fi design that runs on FPGA-based SDR hardware, not (yet) a fabricated ASIC. Functionally the FPGA behaves like a Wi-Fi chip: it presents a standard Linux Wi-Fi interface and interoperates with commercial devices. The difference is that every layer is open and modifiable.

### Which 802.11 standards does it support?

802.11a/g and 802.11n (Wi-Fi 4) at 20 MHz in the open-source release. 802.11ax and other advanced features are commercial (see [openwifi.tech](https://openwifi.tech)). A feature-by-feature breakdown, including why there's no Wi-Fi 5, is on [Wi-Fi 4 & Wi-Fi 6 Features](Wi-Fi-4-and-Wi-Fi-6.md).

### Does it do MIMO or 40 MHz?

Not in the open-source release. openwifi's 11n implements 52 subcarriers, 5/6 coding, and 400 ns short guard interval, for a theoretical 72.2 Mbps single-stream. MIMO, 40 MHz bandwidth, and A-MSDU are **not** supported. A-MPDU aggregation is available experimentally (`./wgd.sh 1`). For context, full 11n (4×4 MIMO + 40 MHz) tops out at 600 Mbps, but openwifi targets the single-stream 20 MHz subset.

### Why won't my 2.4 GHz phone connect, but 5 GHz works?

openwifi is OFDM-only and not backward-compatible with 802.11b, which makes 2.4 GHz association fail. Suppress 11b rates on both ends, or use 5 GHz. Full details: [Operating Modes → About 802.11b](Operating-Modes.md#about-80211b).

### Can it work outside normal Wi-Fi frequencies?

Yes. The AD9361 tunes 70 MHz–6 GHz. Bring the system up on the nearest legal channel, lock it, then override the RF frequency. See [sdrctl → arbitrary tuning](sdrctl-and-Runtime-Control.md#frequency-restrict-and-arbitrary-tuning). You can also run narrower bandwidths (2 MHz for sub-GHz 802.11ah-style, 10 MHz for 802.11p vehicular). Mind your local spectrum regulations.

### My receiver stops working after about two hours. Broken?

No. That's the Xilinx Viterbi decoder evaluation license halting. Reload the FPGA or power-cycle. See [Troubleshooting](Troubleshooting.md#reception-dies-after-2-hours).

### Do I need a paid Vivado license?

Only for some boards. Boards with the Zynq-7020 FPGA (ZedBoard, ADRV9364-Z7020, ZC702, `antsdr`, `sdrpi`, and the community 7020 boards) build under the free Vivado tier. ZC706, ZCU102, ADRV9361-Z7035, and RFSoC4x2 need a license to rebuild the FPGA. Either way, the prebuilt images need no license to *run*.

### I don't have any hardware. Can I still try it?

Yes. The imec [w-iLab.t testbed](https://doc.ilabt.imec.be/ilabt/wilab/tutorials/openwifi.html) offers remote access to openwifi boards (and supports JTAG boot instead of SD card).

### Will there be an openwifi ASIC (for example on SkyWater sky130)?

It's frequently requested, and the team is supportive but not actively working on it. The current focus is maturing the FPGA IP to match commercial chips. A Wi-Fi chip is more complex than it looks, and cheap only because of enormous production volume.

Anyone doing a serious ASIC analysis would need to port many vendor IP cores (FFT, Viterbi, FIFO, RAM/ROM, FIR, AXI DMA/lite, dividers, multipliers) plus handle two hard parts: the AD9361 RF interface (the AD9361 is an expensive 70 MHz–6 GHz SDR front end, not a cheap dedicated Wi-Fi radio) and the AXI-bus coupling to the processor (great for latency, but platform-specific). The team welcomes a larger organization leading such an effort. Full reasoning: the [ASIC considerations note](https://github.com/open-sdr/openwifi/blob/master/doc/asic/skywater-130-pdk-and-asic-considerations.md).

### Windows for development?

See the community [Tips for Windows users](https://github.com/open-sdr/openwifi/discussions/341) thread.

## How to cite openwifi

If you use openwifi in research, cite the VTC2020 paper:

```bibtex
@inproceedings{jiao2020openwifi,
  title={openwifi: a free and open-source IEEE802.11 SDR implementation on SoC},
  author={Jiao, Xianjun and Liu, Wei and Mehari, Michael and Aslam, Muhammad and Moerman, Ingrid},
  booktitle={2020 IEEE 91st Vehicular Technology Conference (VTC2020-Spring)},
  pages={1--2},
  year={2020},
  organization={IEEE}
}
```

You can also cite the code base:

```bibtex
@electronic{openwifigithub,
  author = {Jiao, Xianjun and Liu, Wei and Mehari, Michael and Thijs, Havinga and Muhammad, Aslam and Chen, Baiheng},
  title = {open-source IEEE802.11/Wi-Fi baseband chip/FPGA design},
  url = {https://github.com/open-sdr},
  year = {2023}
}
```

## Selected publications

A categorized list of research using openwifi (Feature/System, TSN/Real-Time, CSI Sensing/Security, Wi-Fi & Cellular 5G/6G) is in [`doc/publications.md`](https://github.com/open-sdr/openwifi/blob/master/doc/publications.md). Highlights:

- **The founding paper:** Jiao et al., *openwifi: a free and open-source IEEE802.11 SDR implementation on SoC*, VTC2020-Spring.
- **CSI sensing & privacy:** the CSI fuzzer work (ACM WiSec 2021) and *Privacy Protection in WiFi Sensing via CSI Fuzzing*.
- **Real-time / TDD:** a line of work on self-interference-free operation and critical TDD turnaround (WoWMoM 2022, Computer Communications 2023).
- **Wi-Fi 6 / OFDMA:** experimental OFDMA and cross-technology interference studies (INFOCOM 2024, EuCNC 2025) and a best-paper award at ACM WiNTECH 2025 on coordinated OFDMA with fiber backhaul.
- **HLS transceiver design:** accelerating FPGA Wi-Fi prototyping via High-Level Synthesis (FCCM 2023).
- **LLMs for hardware:** case studies using large language models to help develop FPGA/wireless systems.

## Videos

A curated playlist lives in [`doc/videos.md`](https://github.com/open-sdr/openwifi/blob/master/doc/videos.md). Good starting points:

- First public demo and the FOSDEM 2020/2021/2022 presentations.
- FSF LibrePlanet 2021: *The dawn of the free/libre WiFi chip*.
- Feature demos: CSI, WiFi CSI Radar (joint communication and sensing), and the CSI fuzzer (plus an ACM WiSec interview).
- Conceptual talks: *How a Wi-Fi chip works internally* (CCC GPN22) and *An open-source Wi-Fi chip, What, Why, and How?* (FSiC 2024).

## Community and support

- **Discussions:** <https://github.com/open-sdr/openwifi/discussions>
- **Issues:** <https://github.com/open-sdr/openwifi/issues> and <https://github.com/open-sdr/openwifi-hw/issues>
- **Mailing list:** <https://lists.ugent.be/wws/subscribe/openwifi>
- **Commercial support & advanced features:** <https://openwifi.tech>
- **Contributing:** see `CONTRIBUTING.md` in each repo.

## License

Dual-licensed: **AGPLv3** for open source, with commercial/advanced licensing via [openwifi.tech](https://openwifi.tech). Some files are GPL-2.0-or-later or BSD-3-Clause, so check individual files. Third-party components (Analog Devices HDL, Xilinx IP, openofdm) carry their own licenses, and it's your responsibility to comply for your use case. Analog Devices' [compound-license explanation](https://github.com/analogdevicesinc/hdl/blob/master/LICENSE) is a useful model for the situation.

## Funding and origin

openwifi originated at Ghent University / imec. It received funding from the EU H2020 [ORCA project](https://www.orca-project.eu/) (grant 732174) and from [NLnet](https://nlnet.nl/)/[NGI Zero](https://ngi.eu/) for the 802.11n feature, 802.11a/g/n maturity, and OpenWrt-support work.
