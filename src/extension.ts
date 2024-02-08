import * as vscode from "vscode";
import axios from "axios";
import FormData from "form-data";
import * as fs from "fs";
import net from "net";
const path = require("path");
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
let statusBarBtn: vscode.StatusBarItem;
let lastCognitiveLoad: number | null = null;
let isEstimating = false;
let intervalId: NodeJS.Timeout | null = null;
let client: net.Socket ; // Gazepoint client
let dataCollection: any[]=[];
// var client = new net.Socket();
const mode = vscode.workspace.getConfiguration("cognitiveloadestimator").get("mode", "API");
const apiUrl = vscode.workspace.getConfiguration("cognitiveloadestimator").get("apiUrl", "http://127.0.0.1:4242");
const directoryPath = vscode.workspace.getConfiguration("cognitiveloadestimator").get("directoryPath");

export function activate(context: vscode.ExtensionContext) {
  console.log('Your extension "cognitiveloadestimator" is now active!');

  statusBarBtn = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  statusBarBtn.command = "cognitiveloadestimator.toggleEstimation";
  statusBarBtn.text = "$(cloud-upload) Begin Estimating Cognitive Load";
  statusBarBtn.tooltip = "Click to start or stop estimating cognitive load";
  statusBarBtn.show();

  let toggleEstimationDisposable = vscode.commands.registerCommand("cognitiveloadestimator.toggleEstimation", async () => {
    if (!isEstimating) {
        isEstimating = true;
        statusBarBtn.text = "$(sync~spin) Estimating...";
        if(mode ==="API"){
          startGazepointClient();
        }
        intervalId = setInterval(async () => {
            if (mode === "API") {
               
                if (dataCollection.length > 0) {
                  const preparedData = prepareDataForUpload(dataCollection);
                  await uploadDataToApi(preparedData);
                  dataCollection = []; // Clear the collection after uploading
              }
                // fetchDataFromApiAndUpload(); // New: Fetch data from the API
            } else {
                uploadFileAndShowResult(); // Existing: Read from Excel
            }
        }, 10000) as NodeJS.Timeout; // Interval duration as an example
    } else {
        stopEstimation();
    }
});

context.subscriptions.push(toggleEstimationDisposable);
}
function startGazepointClient() {
  const mode = vscode.workspace.getConfiguration("cognitiveloadestimator").get("mode", "API");
  const apiUrl = vscode.workspace.getConfiguration("cognitiveloadestimator").get("apiUrl", "http://localhost:4242");

  if (mode === "API") {
      client = new net.Socket();
      client.setEncoding('utf8');

      client.connect(4242, '127.0.0.1', () => {
          console.log('Connected to Gazepoint API server');
          client.write('<SET ID="ENABLE_SEND_CURSOR" STATE="1" />\r\n')
          client.write('<SET ID="ENABLE_SEND_TIME" STATE="1" />\r\n')
          client.write('<SET ID="ENABLE_SEND_POG_FIX" STATE="1" />\r\n')
          client.write('<SET ID="ENABLE_SEND_PUPIL_LEFT" STATE="1" />\r\n')
          client.write('<SET ID="ENABLE_SEND_PUPIL_RIGHT" STATE="1" />\r\n')
          client.write('<SET ID="ENABLE_SEND_EYE_RIGHT" STATE="1" />\r\n')
          client.write('<SET ID="ENABLE_SEND_EYE_LEFT" STATE="1" />\r\n')
          client.write('<SET ID="ENABLE_SEND_DATA" STATE="1" />\r\n')
      });

      client.on('data', (data) => {
        // console.log(data);
        const dataString = data.toString('utf8');
    
        // Use xml2js to parse the XML string
        parser.parseString(dataString, (err: any, result: any) => {
            if (err) {
                console.error('Error parsing XML:', err);
            } else {
                // console.log(result); // result is now a JavaScript object
                dataCollection.push(result);
            }
        });
    });
    

      client.on('close', () => {
          console.log('Connection to Gazepoint API server closed');
      });
  }
}
function prepareDataForUpload(dataCollection: any[]) {
  console.log(dataCollection);
  
  return JSON.stringify(dataCollection);
}
async function uploadDataToApi(preparedData: string) {
  // console.log(preparedData);
  
  try {
      const apiUrl = "https://fyp-paul-7dfcd301ca89.herokuapp.com/predict"; // Replace with your API URL
      const response = await axios.post(apiUrl, preparedData, {
          headers: {
              'Content-Type': 'application/json',
          },
      });
      console.log("Data uploaded successfully:", response.data);
      // Handle the API's response as needed
  } catch (error) {
      console.error("Failed to upload data:", error);
  }
}
function stopEstimation() {
  if (intervalId !== null) {
    clearInterval(intervalId);
  }
  isEstimating = false;
  client.destroy();
  statusBarBtn.text = "$(cloud-upload) Begin Estimating Cognitive Load";
  vscode.window.showInformationMessage("Cognitive load estimation stopped.");
}
async function fetchDataFromApiAndUpload() {
  try {
      const response = await axios.get(apiUrl); 
      const data = response.data;
      uploadDataAndShowResult(data); 
  } catch (error) {
      vscode.window.showErrorMessage("Failed to fetch data from API.");
      console.error(error);
  }
}
async function uploadDataAndShowResult(data: any){
  statusBarBtn.text = "$(sync~spin) Estimating...";
  try{
console.log(data);

  } catch (error) {
    vscode.window.showErrorMessage(
      "Failed to upload data and get response, Stopping extension."
    );
    stopEstimation();
    console.error(error);
  }
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
