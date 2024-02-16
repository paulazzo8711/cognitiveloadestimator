import * as vscode from "vscode";
// import axios from "axios";
import FormData from "form-data";
import * as fs from "fs";
import net from "net";
const axios = require("axios");
const path = require("path");
let statusBarBtn: vscode.StatusBarItem;
let lastCognitiveLoad: number | null = null;
let isEstimating = false;
let intervalId: NodeJS.Timeout | null = null;
let client: net.Socket;
let dataCollection: any[] = [];
const mode = vscode.workspace
  .getConfiguration("cognitiveloadestimator")
  .get("mode", "API");
const apiUrl = vscode.workspace
  .getConfiguration("cognitiveloadestimator")
  .get("apiUrl", "http://127.0.0.1:4242");
let directoryPath = vscode.workspace
  .getConfiguration("cognitiveloadestimator")
  .get("directoryPath");

export function activate(context: vscode.ExtensionContext) {
  // console.log('Your extension "cognitiveloadestimator" is now active!');

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
        isEstimating = true;
        statusBarBtn.text = "$(sync~spin) Estimating...";
        if (mode === "API") {
          startGazepointClient();
        }
        intervalId = setInterval(async () => {
          if (mode === "API" && dataCollection.length > 0) {
            saveDataToJson(dataCollection);
            uploadJsonAndShowResult(dataCollection);
            dataCollection = [];
          } else {
            if (mode === "API") {
            } else {
              uploadFileAndShowResult();
            }
          }
        }, 10000) as NodeJS.Timeout;
      } else {
        stopEstimation();
      }
    }
  );
  let customTimeToggleOn = vscode.commands.registerCommand(
    "cognitiveloadestimator.customTimeOn",
    async () => {
      console.log("Custom time on");

      startGazepointClient();
    }
  );
  let customTimeToggleOff = vscode.commands.registerCommand(
    "cognitiveloadestimator.customTimeOff",
    async () => {
      console.log("Custom time off");
      if (mode === "API" && dataCollection.length > 0) {
        saveDataToJson(dataCollection);
        uploadJsonAndShowResult(dataCollection);
        dataCollection = [];
      } else {
        if (mode === "API") {
        } else {
          const result = uploadFileAndShowResult2();
          return result;
        }
      }
    }
  );

  context.subscriptions.push(toggleEstimationDisposable);
}
function startGazepointClient() {
  const mode = vscode.workspace
    .getConfiguration("cognitiveloadestimator")
    .get("mode", "API");
  const apiUrl = vscode.workspace
    .getConfiguration("cognitiveloadestimator")
    .get("apiUrl", "http://localhost:4242");

  if (mode === "API") {
    client = new net.Socket();
    client.setEncoding("utf8");

    client.connect(4242, "127.0.0.1", () => {
      console.log("Connected to Gazepoint API server");
      client.write('<SET ID="ENABLE_SEND_CURSOR" STATE="1" />\r\n');
      client.write('<SET ID="ENABLE_SEND_TIME" STATE="1" />\r\n');
      client.write('<SET ID="ENABLE_SEND_POG_FIX" STATE="1" />\r\n');
      client.write('<SET ID="ENABLE_SEND_PUPIL_LEFT" STATE="1" />\r\n');
      client.write('<SET ID="ENABLE_SEND_PUPIL_RIGHT" STATE="1" />\r\n');
      client.write('<SET ID="ENABLE_SEND_EYE_RIGHT" STATE="1" />\r\n');
      client.write('<SET ID="ENABLE_SEND_EYE_LEFT" STATE="1" />\r\n');
      client.write('<SET ID="ENABLE_SEND_DATA" STATE="1" />\r\n');
    });

    client.on("data", (data) => {
      if (data !== null && data !== undefined) {
        const dataString = data.toString("utf8").trim();
        const values =
          dataString
            .match(/"(.*?)"/g)
            ?.map((value) => parseFloat(value.replace(/"/g, ""))) ?? [];

        if (values.length === 30) {
          const rowData = {
            // TIME: values[0],
            FPOGX: values[1],
            FPOGY: values[2],
            FPOGS: values[3],
            FPOGD: values[4],
            FPOGID: values[5],
            FPOGV: values[6],
            LPCX: values[7],
            LPCY: values[8],
            LPD: values[9],
            LPS: values[10],
            LPV: values[11],
            RPCX: values[12],
            RPCY: values[13],
            RPD: values[14],
            RPS: values[15],
            RPV: values[16],
          };

          dataCollection.push(rowData);
        }
      }
    });

    client.on("close", () => {
      console.log("Connection to Gazepoint API server closed");
    });
  }
}
let jsonData: string | null = null;

async function saveDataToJson(dataCollection: any[]) {
  try {
    jsonData = JSON.stringify(dataCollection, null, 2);
    console.log("Data saved as JSON:");
  } catch (error) {
    console.error("Error saving data as JSON:", error);
    throw error;
  }
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
async function uploadFileAndShowResult2() {
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
    console.log(currentCognitiveLoad);

    return currentCognitiveLoad;
    // vscode.window.showInformationMessage(message);
  } catch (error) {
    vscode.window.showErrorMessage(
      "Failed to upload file and get response, Stopping extension."
    );
    stopEstimation();
    console.error(error);
  }
}
async function uploadJsonAndShowResult(jsonData: any) {
  statusBarBtn.text = "$(sync~spin) Estimating...";
  try {
    const response = await axios.post(
      "https://fyp-paul-7dfcd301ca89.herokuapp.com/predict",
      jsonData,
      {
        headers: {
          "Content-Type": "application/json",
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
