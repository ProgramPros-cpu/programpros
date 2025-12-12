import express from "express";
import bodyParser from "body-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(bodyParser.json());

const genAI = new GoogleGenerativeAI(process.env.AIzaSyBK0aknGS2FremoV2ujy8k6A3gHBeueJEU);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

app.get("/", (req, res) => {
  res.send("Gemini Flash API is running!");
});

app.post("/chat", async (req, res) => {
  const prompt = req.body.prompt || "";
  const result = await model.generateContent(prompt);
  res.json({ reply: result.response.text() });
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Server started")
);
