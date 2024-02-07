import * as vscode from "vscode";
import axios from "axios";
import FormData from "form-data";
import * as fs from "fs";

const path = require("path");
let statusBarBtn: vscode.StatusBarItem;
let lastCognitiveLoad: number | null = null;
let isEstimating = false;
let intervalId: NodeJS.Timeout | null = null;

const directoryPath = vscode.workspace
  .getConfiguration("cognitiveloadestimator")
  .get("directoryPath");
export function activate(context: vscode.ExtensionContext) {
  console.log('Your extension "cognitiveloadestimator" is now active!');

  statusBarBtn = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  statusBarBtn.command = "cognitiveloadestimator.toggleEstimation";
  statusBarBtn.text = "$(cloud-upload) Begin Estimating Cognitive Load";
  statusBarBtn.tooltip = "Click to start or stop estimating cognitive load";
  statusBarBtn.show();

  let toggleEstimationDisposable = vscode.commands.registerCommand(
    "cognitiveloadestimator.toggleEstimation",
    async () => {
      if (!isEstimating) {
        if (typeof directoryPath !== "string" || directoryPath === "") {
          vscode.window.showErrorMessage(
            "No directory path defined. Please configure the directory path in settings."
          );
          return;
        }
        isEstimating = true;
        statusBarBtn.text = "$(sync~spin) Estimating...";
        // uploadFileAndShowResult();

        intervalId = setInterval(() => {
          uploadFileAndShowResult();
        }, 10000) as NodeJS.Timeout;
      } else {
        stopEstimation();
      }
    }
  );

  context.subscriptions.push(toggleEstimationDisposable);
}
function stopEstimation() {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
  isEstimating = false;
  statusBarBtn.text = "$(cloud-upload) Begin Estimating Cognitive Load";
  vscode.window.showInformationMessage("Cognitive load estimation stopped.");
}
async function uploadFileAndShowResult() {
  statusBarBtn.text = "$(sync~spin) Estimating...";
  try {
    // const directoryPath = "D://Desktop//UNI//Thesis//Thesis models";

    const files = fs.readdirSync(directoryPath as string);

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
    let message = "";
    const highCognitiveLoadThreshold = 35;

    const formattedCognitiveLoad = currentCognitiveLoad.toFixed(2);
    let statusBarText = `$(graph) Cognitive Load: ${formattedCognitiveLoad} ${trendSymbol}`;
    if (lastCognitiveLoad !== null) {
      statusBarText += `, Previous Reading was: ${lastCognitiveLoad}`;
      if (currentCognitiveLoad > lastCognitiveLoad) {
        trendSymbol = "$(arrow-up)";
        if (currentCognitiveLoad > highCognitiveLoadThreshold) {
          message = `Cognitive load is high (${formattedCognitiveLoad}). Consider taking a short break, simplifying tasks, or removing distractions.`;
        } else {
          message = `Cognitive load has increased to ${formattedCognitiveLoad}.`;
        }
      } else if (currentCognitiveLoad === lastCognitiveLoad) {
        trendSymbol = "$(dash)";
        message = `Cognitive load remains the same (${formattedCognitiveLoad}).`;
      } else {
        trendSymbol = "$(arrow-down)";
        message = `Cognitive load has decreased to ${formattedCognitiveLoad}.`;
      }
    } else {
      trendSymbol = "";
      message = `Cognitive load measured at ${formattedCognitiveLoad}.`;
    }

    statusBarBtn.text = statusBarText;
    lastCognitiveLoad = formattedCognitiveLoad;

    vscode.window.showInformationMessage(message);
  } catch (error) {
    vscode.window.showErrorMessage(
      "Failed to upload file and get response, Stopping extension."
    );
    stopEstimation();
    console.error(error);
  }
}

export function deactivate() {}
