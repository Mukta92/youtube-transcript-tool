require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SUPADATA_API_KEY;

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

function isValidYouTubeUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const allowedHosts = ["youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com"];
    return (url.protocol === "https:" || url.protocol === "http:") &&
      allowedHosts.includes(host) &&
      (host !== "youtu.be" || url.pathname.length > 1);
  } catch {
    return false;
  }
}

async function supadataRequest(endpoint, options = {}) {
  const response = await fetch(`https://api.supadata.ai/v1${endpoint}`, {
    ...options,
    headers: {
      "x-api-key": API_KEY,
      "Accept": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.error || `Transcript service error (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

app.post("/api/transcript", async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({
      error: "The server API key is missing. Add SUPADATA_API_KEY to your .env file."
    });
  }

  const videoUrl = String(req.body?.url || "").trim();

  if (!isValidYouTubeUrl(videoUrl)) {
    return res.status(400).json({ error: "Please enter a valid YouTube video URL." });
  }

  try {
    // "native" retrieves existing YouTube captions and avoids AI-generated
    // transcription charges. Change to "auto" if you want AI fallback.
    const params = new URLSearchParams({
      url: videoUrl,
      text: "true",
      mode: "native"
    });

    let result = await supadataRequest(`/transcript?${params.toString()}`);

    // Large videos may be processed asynchronously.
    if (result.jobId) {
      const jobId = encodeURIComponent(result.jobId);
      let completed = false;

      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        result = await supadataRequest(`/transcript/${jobId}`);

        if (result.status === "completed" || result.content) {
          completed = true;
          break;
        }

        if (result.status === "failed") {
          throw new Error(result.message || "Transcript processing failed.");
        }
      }

      if (!completed) {
        return res.status(202).json({
          error: "This video is taking longer than expected. Please try again in a moment."
        });
      }
    }

    const transcript = typeof result.content === "string"
      ? result.content
      : Array.isArray(result.content)
        ? result.content.map(part => part.text || "").join(" ")
        : "";

    if (!transcript.trim()) {
      return res.status(404).json({
        error: "No transcript was found. This video may not have captions available."
      });
    }

    return res.json({
      transcript,
      language: result.lang || "Unknown",
      availableLanguages: result.availableLangs || []
    });
  } catch (error) {
    console.error("Transcript error:", error.message);
    return res.status(error.status || 500).json({
      error: error.message || "Something went wrong. Please try again."
    });
  }
});

app.listen(PORT, () => {
  console.log(`YouTube Transcript Tool is running at http://localhost:${PORT}`);
});
