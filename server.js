// server.js
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = 5000;

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.post("/api/analyze", upload.single("jobDescription"), async (req, res) => {
  try {
    const resume = JSON.parse(req.body.resume);
    const jobDescription = fs.readFileSync(req.file.path, "utf-8");

    const prompt = `
You are a resume reviewer.

Resume:
Name: ${resume.name}
Email: ${resume.email}
Summary: ${resume.summary}
Experience: ${resume.experience}
Skills: ${resume.skills}
Education: ${resume.education}

Job Description:
${jobDescription}

1. Give 3–5 suggestions to improve the resume.
2. Estimate a job-fit score (0–100).
`;

    const openaiRes = await axios.post(
      "https://api.openai.com/v1/completions",
      {
        model: "text-davinci-003",
        prompt,
        max_tokens: 350,
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const output = openaiRes.data.choices[0].text.trim();
    const scoreMatch = output.match(/score.*?(\\d{1,3})/i);
    const jobFitScore = scoreMatch ? scoreMatch[1] : "N/A";

    const suggestions = output
      .split("\n")
      .filter(line => line.trim().match(/^[-•\\d]/))
      .map(line => line.replace(/^[-•\\d.\\s]*/, "").trim());

    res.status(200).json({ jobFitScore, suggestions });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Resume analysis failed." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
