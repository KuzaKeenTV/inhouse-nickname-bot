const fs = require("fs");
const { google } = require("googleapis");

const CREDENTIALS_PATH = "credentials.json";

let credentials;
try {
  credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
} catch (err) {
  console.error("Error reading credentials.json:", err.message);
  process.exit(1);
}

const { client_email, private_key } = credentials;

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

async function authorize() {
  const auth = new google.auth.JWT(client_email, null, private_key, SCOPES);
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

module.exports = authorize;
