# Cognitive Load Estimator for VS Code

The **Cognitive Load Estimator** extension for Visual Studio Code offers a unique approach to productivity by leveraging eye gaze data from the Gazepoint GP3 eye tracker. This extension analyzes your cognitive load in real-time and provides live updates, enabling you to take action to reduce cognitive strain and, in turn, enhance your focus and productivity.

## Features

- **Real-Time Cognitive Load Estimation**: Continuously monitors eye gaze data to estimate your current cognitive load.
- **Live Updates**: Presents live updates of your cognitive load directly in the VS Code status bar, giving you instant feedback.
- **Productivity Insights**: Offers suggestions and insights based on your cognitive load to help you manage and reduce cognitive strain.
- **Customizable Data Source**: Allows you to specify the directory path for reading eye gaze data, making it flexible for different working environments.

## Getting Started

### Prerequisites

- A Gazepoint GP3 eye tracker device.
- Eye gaze data recorded in Excel format (.xlsx or .xls).

### Installation

1. Install the extension directly from the Visual Studio Code Marketplace.
2. Connect your Gazepoint GP3 eye tracker and ensure it is recording eye gaze data to the specified directory.

### Configuration

Customize the extension by specifying the directory path where your eye gaze data is stored:

1. Open **User Settings** (`Ctrl` + `,`).
2. Search for `CognitiveLoadEstimator`.
3. Set the `Directory Path` to where your eye gaze data is saved.

## Usage

Upon activation, the extension begins estimating your cognitive load based on the most recent eye gaze data file in the specified directory. The status bar will display your current cognitive load with an icon indicating the trend:

- `$(dash)` - Stable
- `$(arrow-up)` - Increasing
- `$(arrow-down)` - Decreasing

Click on the status bar item to manually refresh the cognitive load estimation.

## Contributing

We welcome contributions and suggestions! Please submit issues and pull requests on our [GitHub repository](https://github.com/paulazzo8711/cognitiveloadestimator).

## License

This extension is distributed under the MIT License. See `LICENSE` for more information.

## Acknowledgments

- Gazepoint for the GP3 eye tracker.
- All contributors who have helped to improve this extension.

---

Enjoy using Cognitive Load Estimator and take the first step towards a more productive coding session!
