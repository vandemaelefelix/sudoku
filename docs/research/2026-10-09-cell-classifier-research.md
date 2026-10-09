# Research: the cell classifier, its export and the phone runtime

Date: 2026-10-09. Done before issue #4, in throwaway environments. Nothing here is code that
stays. The decisions that follow from it are in the model contract, ADR-002, ADR-005, ADR-006
and the #4 implementation plan.

Three questions:

1. Does the PyTorch → TFLite export path work, on the Mac and on Linux CI?
2. What does the phone side (React Native libraries, TFLite runtime) support, and how do Python
   and the app keep the preprocessing identical?
3. Which network and training recipe suit the real cells?

## 1. Export path

| Finding | Evidence | Confidence |
| --- | --- | --- |
| torch 2.13.0, litert-torch 0.9.4 and ai-edge-litert 2.2.0 install on Python 3.12 (Mac and Linux x86_64). litert-torch requires torch below 2.14 | `uv sync` on the Mac; `uv sync --locked` in a `linux/amd64` container | High |
| No TensorFlow is installed. litert-torch pulls in jax, jaxlib and a converter. Environment: 1.3 GB (Mac), 1.8 GB (Linux), about 470 MB of downloads on Linux with CPU torch | Package metadata, venv sizes | High |
| The API is `litert_torch.convert(module, (sample,)).export(path)` | The installed package's `_convert/interface.py` | High |
| A 90k-parameter two-head CNN converts to a 369 KB float32 file. BatchNorm is folded, Dropout removed, the NHWC permute absorbed | Conversion of the planned model | High |
| A `forward` that returns `{"digit": d, "kind": k}` gives signature outputs and tensor names that contain `digit` and `kind`. A tuple gives `output_0`, `output_1` | Signature list of both variants | High |
| Ops: DEPTHWISE_CONV_2D v1, CONV_2D v1, MAX_POOL_2D v1, FULLY_CONNECTED v5, SOFTMAX v1, TRANSPOSE v1, RESHAPE v1. No custom ops. Minimum runtime 2.0.0 | Flatbuffer read with the LiteRT schema | High |
| TFLite and PyTorch agree: maximum difference 6 × 10⁻⁸, same top class on every input. float16 weights: 193 KB, difference 6 × 10⁻⁶ | Interpreter against PyTorch on a batch of 81 | High |

## 2. Phone side

| Finding | Evidence | Confidence |
| --- | --- | --- |
| Expo SDK 57 ships React Native 0.86.3, react-native-worklets 0.10.1, Reanimated 4.5.1, Skia 2.6.2 | Expo 57.0.27 package versions | High |
| `react-native-fast-tflite` 3.0.1 is a Nitro module. On iOS it bundles **TensorFlowLiteC 2.17.0**, the last TFLite published on CocoaPods. The model above stays within 2.17's op versions. float16 activations would not | Podspec; op version tables of 2.17 and LiteRT | High |
| fast-tflite's Metal delegate always throws. CPU works, Core ML is opt-in | Library source, issue #199 | High |
| fast-tflite has no signature API and no input resize: the input size is static, outputs come back in tensor order, `outputs[i].name` gives tensor names | Library source, issue #124 | High |
| `react-native-fast-opencv` 1.0.1 links OpenCV 4.9.0 on iOS. It has `cvtColor`, `resize`, `warpPerspective`, `getPerspectiveTransform`, `findContours`, `approxPolyDP`, `adaptiveThreshold`, `morphologyEx`. It has no `cornerSubPix` and no `remap` | Library source | High |
| fast-opencv's iOS build fails on some React Native setups (issue #117). A fix (PR #119) is not merged. Whether Expo 57 hits it is not verified | Issue tracker | Medium |
| VisionCamera 5.2.3 is a Nitro rewrite. Frame processors need `react-native-vision-camera-worklets` and `react-native-worklets`, not worklets-core. `vision-camera-resize-plugin` is dead; `react-native-vision-camera-resizer` replaces it | Library source and releases | High |
| A captured photo reaches OpenCV through `toImageAsync()` and its raw pixels. Orientation handling and row stride are not verified | Library source | Medium |

### Preprocessing parity

Measured with OpenCV 4.9.0 and 5.0.0:

| Comparison | Largest difference |
| --- | --- |
| `cvtColor` on float32 against `0.299 R + 0.587 G + 0.114 B` in float | 3 × 10⁻⁵ gray levels |
| `cvtColor` on uint8 against the float formula | 0.503 gray levels (fixed-point rounding) |
| `INTER_AREA` 52 → 32 on float32 against an exact separable area average | 2 × 10⁻⁷ |

Conclusion: the app implements the preprocessing in plain TypeScript (grayscale in float, crop,
a 32 × 52 weight matrix applied to rows and columns). It is exact, needs no OpenCV, and is easy to
test against `fixtures/preprocess/`. The contract's sizes stay as they are.

## 3. Network and training

Setup: digit task only, 16,206 labelled real cells, the contract preprocessing, a random 80/20
split (3,241 validation cells), MPS on an M4 Pro.

| Run | Parameters | Epochs, time | Validation accuracy | Errors |
| --- | --- | --- | --- | --- |
| First design (3 conv blocks, flatten, dense 64), AdamW, no augmentation | 90k | 10, 7.5 s | 94.9 % | 165 |
| Same, one-cycle schedule, label smoothing 0.05 | 90k | 20, 6.6 s | 96.9 % | 101 |
| Same, with augmentation | 90k | 20, 12 s | 97.5 % | 81 |
| Same, with augmentation, longer | 90k | 40, 23 s | 98.0 % | 64 |
| **Two convs per stage (16/32/64), global average pooling, augmentation** | **73k** | 20, 15 s | **98.7 %** | 43 |
| Same, wider (20/40/80) | 113k | 40, 45 s | 98.9 % | 36 |
| Depthwise-separable, global average pooling | 75k | 20, 32 s | 98.6 % | 47 |

Augmentation, applied to the 64 × 64 cell before the crop: shift ±4 px, rotation ±6°, scale
±10 %, shear, blur on 40 % of cells, gamma, contrast, brightness, noise.

Other measurements:

- Confidence is well calibrated: expected calibration error 0.33 %, fitted temperature 1.05.
- Accuracy of the cells kept when the least certain go to review: 99.07 % at 1 %, 99.34 % at
  2 %, 99.68 % at 5 %.
- About 80 to 120 cells (0.6 %) have a wrong label: 103 cells get under 5 % probability for their
  label. Of the top 60, about 50 are clearly wrong (for example a printed 3 filed under 6, empty
  cells filed as digits).
- 13 % of validation cells have a near-identical cell in training. The random split flatters
  the numbers.

Findings:

- Small plain CNNs are the usual choice for sudoku digits. Global average pooling moves capacity
  from the dense layer into the convolutions and gave the largest gain at the same size.
  Depthwise-separable layers gave no gain at this size. 32 × 32 input and batch normalisation stay.
- A shared trunk with two heads is fine. A kind-loss weight of 0.3 to 0.5 keeps the kind head
  from pulling the digit features. Without handwritten and notes examples, the kind head learns
  "synthetic or real", not the kind of ink.
- Augmentation is the largest lever, then the schedule.
- Choose the review threshold from accuracy at a given review rate, not from calibration error.
- Cross-validated loss ranking finds wrong labels well on the first pass.

Sources:

- Lin, Chen, Yan. *Network In Network* (global average pooling). 2013. <https://arxiv.org/abs/1312.4400>
- Howard et al. *MobileNets*. 2017. <https://arxiv.org/abs/1704.04861>
- Wicht, Hennebert. *Mixed handwritten and printed digit recognition in Sudoku with Convolutional Deep Belief Network*. ICDAR 2015. <https://doi.ieeecomputersociety.org/10.1109/ICDAR.2015.7333884>
- Simard, Steinkraus, Platt. *Best practices for convolutional neural networks applied to visual document analysis*. ICDAR 2003. <https://ieeexplore.ieee.org/document/1227801>
- Smith. *A disciplined approach to neural network hyper-parameters* (one-cycle schedule). 2018. <https://arxiv.org/abs/1803.09820>
- Kendall, Gal, Cipolla. *Multi-Task Learning Using Uncertainty to Weigh Losses*. 2018. <https://arxiv.org/abs/1705.07115>
- Guo et al. *On Calibration of Modern Neural Networks*. 2017. <https://arxiv.org/abs/1706.04599>
- Geifman, El-Yaniv. *Selective Classification for Deep Neural Networks*. 2017. <https://arxiv.org/abs/1705.08500>
- Hendrycks, Gimpel. *A Baseline for Detecting Misclassified and Out-of-Distribution Examples*. 2017. <https://arxiv.org/abs/1610.02136>
- Northcutt, Jiang, Chuang. *Confident Learning*. 2021. <https://arxiv.org/abs/1911.00068>
- react-native-fast-tflite: <https://github.com/mrousavy/react-native-fast-tflite> (issues #124, #199)
- react-native-fast-opencv: <https://github.com/lukaszkurantdev/react-native-fast-opencv> (issue #117, PR #119)
- react-native-vision-camera: <https://github.com/mrousavy/react-native-vision-camera>

## Not verified

- A real build of fast-opencv, fast-tflite and VisionCamera 5 on Expo 57 (issue #2).
- Inference time for 81 cells on the iPhone (issue #5).
- Whether `toImageAsync()` applies EXIF orientation, and row stride (issue #6).
- Accuracy on cleanly labelled printed cells against handwritten cells (the kind is not labelled).
