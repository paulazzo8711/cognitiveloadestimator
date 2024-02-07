import * as vscode from "vscode";
import axios from "axios";
import FormData from "form-data";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  console.log("Your Cognitive load will be estimated every 3 minutes.");

  let disposable = vscode.commands.registerCommand(
    "cognitiveloadestimator.uploadFile",
    async () => {
      uploadFileAndShowResult();
    }
  );

  context.subscriptions.push(disposable);

  //uploadFileAndShowResult();

  const intervalId = setInterval(() => {
    uploadFileAndShowResult();
  }, 180000);

  context.subscriptions.push(
    new vscode.Disposable(() => clearInterval(intervalId))
  );
}

async function uploadFileAndShowResult() {
  try {
    const filePath = "D://Desktop//UNI//Thesis//Thesis models//ID028_ET_1.xlsx";
    const formData = new FormData();
    formData.append("file", fs.createReadStream(filePath));

    const response = await axios.post(
      "https://fyp-paul-7dfcd301ca89.herokuapp.com/predict",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    vscode.window.showInformationMessage(
      `Mean Predicted Cognitive Load: ${response.data.mean_predicted_cognitive_load}`
    );
  } catch (error) {
    vscode.window.showErrorMessage("Failed to upload file and get response.");
    console.error(error);
  }
}

export function deactivate() {}
