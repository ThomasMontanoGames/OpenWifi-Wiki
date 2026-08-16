# FPGA Simulation and Testbenches

Simulation is the fastest way to develop and debug openwifi's FPGA logic without a board. You feed a testbench a recorded or generated IQ file, run it in Vivado (or Icarus Verilog), and inspect the receiver's internal signals in the waveform view or in the text files the testbench dumps. Every design change can be checked here before you spend an hour synthesizing a bitstream.

This page is the deep reference for that environment. For the surrounding build, deploy, and port workflow, see [FPGA Development](FPGA-Development.md). For what each core does, see [FPGA IP Cores](FPGA-IP-Cores.md).

## Two kinds of testbench

openwifi's HDL ships two tiers of testbench. Reach for whichever matches the change you are making.

| Tier | Testbench | Where | Drives | Good for |
|---|---|---|---|---|
| **Full receiver** | `dot11_tb` | [`openofdm/verilog/`](https://github.com/open-sdr/openofdm/tree/dot11zynq/verilog) | The whole `dot11` receive chain from an IQ file | Sync, channel estimation, equalization, demod, Viterbi, FCS |
| **Full transmitter** | `dot11_tx_tb` | [`openwifi-hw/ip/openofdm_tx/src/`](https://github.com/open-sdr/openwifi-hw/tree/master/ip/openofdm_tx/src) | `openofdm_tx` from a TX memory image | Encoding, modulation, IFFT, preamble insertion |
| **Block-level unit test** | `adc_intf_tb`, `mv_avg_tb`, `fifo_sample_delay_tb` | `openwifi-hw/ip/<core>/unit_test/<block>/` | One submodule with hand-written or file-based stimulus | A single register, FIFO, or math block in isolation |

The full-chain benches are the ones you spend most time in. The block-level unit tests are small and fast, and they exist only for the handful of blocks that are worth checking on their own (see the [IP Cores table](FPGA-IP-Cores.md#the-signal-chain)).

## The openofdm_rx receiver testbench (`dot11_tb`)

This is the main simulation environment. `dot11_tb` instantiates the `dot11` receiver, streams an IQ file into it one sample at a time, and records what comes out. Because `openofdm_rx` is a git submodule, first pull it in (see [FPGA Development](FPGA-Development.md#building-the-bitstream)):

```bash
./get_ip_openofdm_rx.sh
```

### Running it in Vivado

1. Create the IP's Vivado project:

   ```bash
   cd ip/openofdm_rx
   ../create_vivado_proj.sh $XILINX_DIR openofdm_rx.tcl
   ```

2. In Vivado, open *Sources → Simulation Sources → sim_1 → `dot11_tb`*.
3. Run *SIMULATION → Run Simulation → Run Behavioral Simulation*. The first run is slow because every sub-IP compiles once. Later runs are fast.
4. Press **Run All (F3)** to run to completion.
5. After editing a design file, use **Relaunch Simulation** rather than recreating the project.

!!! tip "Icarus Verilog as a lighter alternative"
    The openofdm repo also builds with [Icarus Verilog](http://iverilog.icarus.com/) and [GtkWave](http://gtkwave.sourceforge.net/) instead of Vivado. A `Makefile` lives in [`openofdm/verilog/`](https://github.com/open-sdr/openofdm/tree/dot11zynq/verilog). This is handy on a machine without a Vivado install, though the Xilinx primitives (the Viterbi decoder) still need the Vivado simulation libraries.

### The IQ input: what you feed

The receiver expects **20 MSPS** baseband IQ, 16 bits each. The testbench reads its samples from a text file named by the `` `SAMPLE_FILE `` macro in [`verilog/openofdm_rx_pre_def.v`](https://github.com/open-sdr/openofdm/tree/dot11zynq/verilog). Change that macro to point at a different capture, then relaunch.

Each line of the file is three integers: I, Q, and a dummy RSSI value.

```text
-152 37 0
-4 -211 0
88 -19 0
```

`dot11_tb` reads one line per 20 MHz tick, packs it into `sample_in[31:16]` (I) and `sample_in[15:0]` (Q), and pulses `sample_in_strobe` for one cycle. The baseband clock is selectable in the testbench (`CLK_SPEED_100M`, `200M`, `240M`, `400M`), but the sample rate stays 20 MSPS regardless: the harness just spaces the strobes further apart at a higher clock.

<figure>
<svg viewBox="0 0 900 330" role="img" aria-label="The dot11_tb simulation data flow. A test vector text file of I, Q, and RSSI values at 20 MSPS feeds the dot11_tb harness, which packs each line into sample_in and pulses sample_in_strobe into the dot11 receiver device under test. The receiver runs sync, equalization, demod, and Viterbi. Its results go two ways: to the waveform view, where you watch state, preamble_detected, pkt_len, fcs_ok, and byte_out, and to dumped text files such as byte_out.txt, equalizer_out.txt, and fcs_out.txt, which a Python reference decoder can then diff against." style="width:100%;height:auto;max-width:1000px;font-family:inherit;font-size:13px">
  <defs>
    <marker id="sim-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="currentColor" fill-opacity="0.6"/>
    </marker>
  </defs>

  <!-- main pipeline row, y center ~150 -->
  <!-- test vector file -->
  <rect x="16" y="118" width="172" height="66" rx="10" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3"/>
  <text x="102" y="144" text-anchor="middle" font-size="12.5" font-weight="700" fill="currentColor">test vector</text>
  <text x="102" y="161" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">I  Q  RSSI per line</text>
  <text x="102" y="175" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">20 MSPS</text>

  <!-- dot11_tb harness -->
  <rect x="238" y="118" width="150" height="66" rx="10" fill="#0d9488" fill-opacity="0.06" stroke="#0d9488" stroke-opacity="0.55" stroke-width="1.4"/>
  <text x="313" y="144" text-anchor="middle" font-size="13" font-weight="700" fill="#0d9488">dot11_tb</text>
  <text x="313" y="161" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">packs sample_in</text>
  <text x="313" y="175" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.75">+ sample_in_strobe</text>

  <!-- dot11 DUT -->
  <rect x="438" y="112" width="196" height="78" rx="10" fill="#4f5bd5" fill-opacity="0.06" stroke="#4f5bd5" stroke-opacity="0.55" stroke-width="1.4"/>
  <text x="536" y="140" text-anchor="middle" font-size="13" font-weight="700" fill="#4f5bd5">dot11 (DUT)</text>
  <text x="536" y="158" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.78">sync · equalize</text>
  <text x="536" y="172" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity="0.78">demod · Viterbi</text>

  <!-- pipeline arrows -->
  <g stroke="currentColor" stroke-opacity="0.6" stroke-width="1.6" fill="none">
    <line x1="188" y1="151" x2="234" y2="151" marker-end="url(#sim-arrow)"/>
    <line x1="388" y1="151" x2="434" y2="151" marker-end="url(#sim-arrow)"/>
  </g>

  <!-- outputs: waveform (top right) and dumped files (bottom right) -->
  <rect x="678" y="36" width="206" height="86" rx="10" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3"/>
  <text x="781" y="60" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">waveform view</text>
  <text x="781" y="78" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.78">state · preamble_detected</text>
  <text x="781" y="92" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.78">pkt_len · demod_is_ongoing</text>
  <text x="781" y="106" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.78">fcs_ok · byte_out</text>

  <rect x="678" y="182" width="206" height="72" rx="10" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-opacity="0.4" stroke-width="1.3"/>
  <text x="781" y="206" text-anchor="middle" font-size="12" font-weight="700" fill="currentColor">dumped .txt files</text>
  <text x="781" y="224" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.78">byte_out.txt · fcs_out.txt</text>
  <text x="781" y="238" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.78">equalizer_out.txt · demod_out.txt</text>

  <!-- branch arrows from DUT -->
  <g stroke="currentColor" stroke-opacity="0.55" stroke-width="1.5" fill="none">
    <path d="M634,132 H656 V79 H674" marker-end="url(#sim-arrow)"/>
    <path d="M634,170 H656 V218 H674" marker-end="url(#sim-arrow)"/>
  </g>

  <!-- python cross-check -->
  <rect x="678" y="278" width="206" height="44" rx="10" fill="#be3d73" fill-opacity="0.06" stroke="#be3d73" stroke-opacity="0.55" stroke-width="1.4"/>
  <text x="781" y="298" text-anchor="middle" font-size="11.5" font-weight="700" fill="#be3d73">Python reference decoder</text>
  <text x="781" y="313" text-anchor="middle" font-size="9.5" fill="currentColor" fill-opacity="0.78">diff against the dumps</text>
  <line x1="781" y1="254" x2="781" y2="274" stroke="currentColor" stroke-opacity="0.55" stroke-width="1.5" marker-end="url(#sim-arrow)" fill="none"/>
</svg>
<figcaption><em>The <code>dot11_tb</code> data flow. A recorded or generated IQ file drives the receiver one sample at a time. Results go two ways at once: the waveform view for interactive debugging, and dumped text files that a Python reference decoder can check against.</em></figcaption>
</figure>

### What to watch on the outputs

`dot11_tb` monitors the receiver's full progress. Drag these signals from *SIMULATION → Scope* into the waveform view (for example `dot11_tb → dot11_inst → ofdm_decoder_inst → viterbi_inst` for the decoder). Together they show exactly how far a packet got and where it failed.

| Signal | What it means |
|---|---|
| `short_preamble_detected`, `long_preamble_detected` | Packet detection and coarse/fine timing found the preamble. If these never fire, the problem is sync or signal level, not decoding. |
| `state` | The receiver FSM position. Watch it step through detection, channel estimation, SIGNAL parsing, and payload demod. A stuck `state` localizes the fault to one stage. |
| `pkt_header_valid`, `pkt_len`, `pkt_rate` | The SIGNAL/HT-SIG field parsed and gave a length and rate. A wrong `pkt_len` here means SIGNAL decoding, not payload decoding, is off. |
| `demod_is_ongoing` | Payload demodulation is running. |
| `byte_out`, `byte_out_strobe` | The decoded MPDU bytes, one at a time. Compare against the known frame. |
| `fcs_ok`, `fcs_out_strobe` | The CRC check passed. This is the end-to-end pass/fail for the whole receive chain. |

Alongside the waveform, the testbench uses `$fopen`/`$fscanf`/`$fwrite` to dump many intermediate results as text, so you can check them numerically rather than by eye. The files land in the simulation working directory (`openofdm_rx/openofdm_rx.sim/sim_1/behav/xsim/`).

| Dumped file | Contents |
|---|---|
| `short_preamble_detected.txt`, `sync_long_out.txt` | Preamble-detection and long-training-field sync results |
| `equalizer_out.txt` | Per-subcarrier equalizer output (the constellation) |
| `demod_out.txt`, `demod_soft_bits.txt` | Demodulated symbols and the soft bits fed to Viterbi |
| `byte_out.txt`, `descramble_out.txt`, `fcs_out.txt` | Decoded bytes, descrambler output, and the final CRC result |
| `status_code.txt`, `phy_len.txt` | Receiver status codes and the parsed PHY length |

### Cross-checking against the Python decoder

openofdm ships a bit-exact Python model of the receiver under [`scripts/`](https://github.com/open-sdr/openofdm/tree/dot11zynq/scripts) (it uses `commpy` for the convolutional code). Running the same IQ file through the Python decoder and diffing its output against the Verilog dumps is how you confirm the hardware matches the reference. When a stage diverges, the first file that disagrees points straight at the module that changed behavior.

### The test vectors

Sample IQ files live in [`openofdm/testing_inputs/`](https://github.com/open-sdr/openofdm/tree/dot11zynq/testing_inputs), grouped by how they were produced. Pick the group that matches what you are testing.

| Directory | Origin | Use it to |
|---|---|---|
| `simulated/` | Generated with an ideal (no-noise) channel: `ag_*.txt` (11a/g), `ht_mcs*_gi*.txt` (11n), `iq_*.txt` | Verify decoding logic against a clean, known-good signal |
| `conducted/` | Captured over a cable (`dot11a_*`, `dot11n_*` at each rate) | Test against a real but low-distortion signal |
| `radiated/` | Captured over the air, with `.pcap` companions | Test sync and equalization against real multipath and noise |

File names encode the format and rate, for example `dot11n_6.5mbps` or `ht_mcs7_gi1`. Start from a `simulated/` file at a low MCS when bringing up a change, then move to `conducted/` and `radiated/` to stress synchronization and the equalizer.

## Automated and batch simulation

For regression-style runs you do not need the GUI. The openofdm repo has three helper Tcl scripts at its root that drive XSim in batch mode:

| Script | What it does |
|---|---|
| [`openofdm_rx_sim_iq_file.tcl`](https://github.com/open-sdr/openofdm/blob/dot11zynq/openofdm_rx_sim_iq_file.tcl) | Runs `dot11_tb` against one IQ file passed as an argument |
| [`openofdm_rx_sim_iq_file_batch.tcl`](https://github.com/open-sdr/openofdm/blob/dot11zynq/openofdm_rx_sim_iq_file_batch.tcl) | Loops the single-file run over many IQ files |
| [`openofdm_rx_side_ch_sim_ultra_scale.tcl`](https://github.com/open-sdr/openofdm/blob/dot11zynq/openofdm_rx_side_ch_sim_ultra_scale.tcl) | Simulates the receiver together with `side_ch` on UltraScale parts |

`openofdm_rx_sim_iq_file.tcl` shows the pattern the others follow. It writes the chosen file into the `` `SAMPLE_FILE `` macro, computes the run length from the file (`lines / 20` microseconds by Tcl integer division, since the input is 20 MSPS), runs the simulation, and copies every dumped `.txt` into a results directory named after the input file. That last step is what makes batch runs comparable: each input keeps its own set of dumps.

## The transmitter testbench (`dot11_tx_tb`)

The transmit side has its own testbench, [`dot11_tx_tb.v`](https://github.com/open-sdr/openwifi-hw/tree/master/ip/openofdm_tx/src), which drives `openofdm_tx` from a memory image instead of an IQ file. The test vectors are `.mem` files under [`ip/openofdm_tx/unit_test/test_vec/`](https://github.com/open-sdr/openwifi-hw/tree/master/ip/openofdm_tx/unit_test/test_vec), named for the frame they encode:

- `tx_intf.mem`: the base TX interface memory image.
- `ht_tx_intf_mem_mcs7_gi1_aggr0_byte100.mem` and `..._byte8176.mem`: 802.11n HT frames at MCS7, short guard interval, for a 100-byte and an 8176-byte payload.

Simulate it the same way as the receiver: create the `openofdm_tx` project, select `dot11_tx_tb` as the simulation top, and run behavioral simulation. Because the transmitter is deterministic, its output IQ can be fed straight into `dot11_tb` as a receiver test vector. This is the [self-loopback test](Research-Features.md#self-loopback-testing) you run on hardware, done entirely in simulation.

## Block-level unit tests

A few submodules have their own tiny testbench so you can verify them without building a full core. Each lives in `ip/<core>/unit_test/<block>/` with a `<block>_tb.v` and a `<block>_tb.tcl`. The Tcl script builds a standalone Vivado project (targeting the ZCU102 part `xczu9eg-ffvb1156-2-e`) that contains only that block and its testbench, with a short preset run time.

| Unit test | Block under test | Stimulus |
|---|---|---|
| [`ip/rx_intf/unit_test/adc_intf`](https://github.com/open-sdr/openwifi-hw/tree/master/ip/rx_intf/unit_test/adc_intf) | `adc_intf.v`, the ADC-side sample unpacker | Generated inside `adc_intf_tb.v` |
| [`ip/xpu/unit_test/mv_avg`](https://github.com/open-sdr/openwifi-hw/tree/master/ip/xpu/unit_test/mv_avg) | `mv_avg.v` / `mv_avg_dual_ch.v`, the RSSI moving-average filter | `test_vec/data_in.txt`, with `test_data_in_out.m` as the MATLAB reference |
| [`ip/xpu/unit_test/fifo_sample_delay`](https://github.com/open-sdr/openwifi-hw/tree/master/ip/xpu/unit_test/fifo_sample_delay) | `fifo_sample_delay.v`, the sample-delay FIFO | Generated inside `fifo_sample_delay_tb.v` |

To run one, source its `.tcl` to create the project, then open it and run behavioral simulation:

```bash
cd ip/xpu/unit_test/mv_avg
vivado -mode batch -source mv_avg_tb.tcl
# then open ./mv_avg_tb in Vivado and Run Behavioral Simulation
```

The `mv_avg` test is the clearest example of the file-vector pattern: `test_data_in_out.m` generates `data_in.txt` and the expected output in MATLAB, the testbench reads `data_in.txt`, and you compare the Verilog result against the MATLAB reference. That is the same read-a-vector, dump-a-result, diff-against-a-golden-model loop the full `dot11_tb` uses, shrunk to one block.

## Conditional compilation in simulation

`create_vivado_proj.sh` passes extra arguments through to `` `define `` macros in `<ip_name>_pre_def.v`, the same mechanism the full build uses. In simulation these macros select the sample file, the clock speed, and debug blocks. See [FPGA Development → conditional compilation](FPGA-Development.md#conditional-compilation-with-verilog-macros) for the argument order, and remember to pass the *same* macros to `create_ip_repo.sh` when you later build the top-level project, so the synthesized core matches what you simulated.

## From simulation to hardware

Simulation and on-board debugging cover different failures. Use the testbench to verify logic and datapath correctness against known vectors, where you have full visibility and a golden reference. Use the Xilinx [ILA](FPGA-Development.md#debugging-on-hardware) on the running board to catch the things simulation cannot show: real RF, real timing against the AD9361, and the interaction between the FPGA and the Linux driver. A common workflow is to reproduce a hardware bug in simulation by capturing the offending IQ with `side_ch` (see [Research Features](Research-Features.md)), saving it in the `dot11_tb` sample-file format, and replaying it through the receiver testbench.
