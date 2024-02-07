import * as vscode from "vscode";
import axios from "axios";
import FormData from "form-data";
import * as fs from "fs";

const path = require("path");
let statusBarBtn: vscode.StatusBarItem;
let lastCognitiveLoad: number | null = null;
let isEstimating = false;

export function activate(context: vscode.ExtensionContext) {
  console.log('Your extension "cognitiveloadestimator" is now active!');

  statusBarBtn = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  statusBarBtn.command = "cognitiveloadestimator.startEstimation";
  statusBarBtn.text = "$(cloud-upload) Begin Estimating Cognitive Load";
  statusBarBtn.tooltip = "Begin Estimating Cognitive Load";
  statusBarBtn.show();

  let startEstimationDisposable = vscode.commands.registerCommand(
    "cognitiveloadestimator.startEstimation",
    async () => {
      if (!isEstimating) {
        isEstimating = true;
        statusBarBtn.text = "$(sync~spin) Estimating...";
        await uploadFileAndShowResult();

        const intervalId = setInterval(async () => {
          await uploadFileAndShowResult();
        }, 1800000);

        context.subscriptions.push(
          new vscode.Disposable(() => clearInterval(intervalId))
        );
      }
    }
  );

  context.subscriptions.push(startEstimationDisposable);
}
async function uploadFileAndShowResult() {
  try {
    const directoryPath = "D://Desktop//UNI//Thesis//Thesis models";

    const files = fs.readdirSync(directoryPath);

    const excelFiles = files.filter(
      (file) => file.endsWith(".xlsx") || file.endsWith(".xls")
    );
    let mostRecentFile = "";
    let lastModified = 0;

    excelFiles.forEach((file) => {
      const filePath = path.join(directoryPath, file);
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs > lastModified) {
        lastModified = stats.mtimeMs;
        mostRecentFile = filePath;
      }
    });

    if (!mostRecentFile) {
      vscode.window.showErrorMessage("No Excel files found.");
      return;
    }

    const formData = new FormData();
    formData.append("file", fs.createReadStream(mostRecentFile));

    const response = await axios.post(
      "https://fyp-paul-7dfcd301ca89.herokuapp.com/predict",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    const currentCognitiveLoad = response.data.mean_predicted_cognitive_load;
    let trendSymbol =
      lastCognitiveLoad !== null
        ? currentCognitiveLoad === lastCognitiveLoad
          ? "$(dash)"
          : currentCognitiveLoad > lastCognitiveLoad
          ? "$(arrow-up)"
          : "$(arrow-down)"
        : "";
    statusBarBtn.text = `$(graph) Cognitive Load: ${currentCognitiveLoad} ${trendSymbol}`;
    lastCognitiveLoad = currentCognitiveLoad;
    vscode.window.showInformationMessage(
      `Mean Predicted Cognitive Load: ${response.data.mean_predicted_cognitive_load}`
    );
  } catch (error) {
    vscode.window.showErrorMessage("Failed to upload file and get response.");
    console.error(error);
  }
}

export function deactivate() {}
