const form = document.getElementById("transcriptForm");
const urlInput = document.getElementById("youtubeUrl");
const submitButton = document.getElementById("submitButton");
const statusBox = document.getElementById("status");
const resultSection = document.getElementById("resultSection");
const transcriptOutput = document.getElementById("transcriptOutput");
const languageInfo = document.getElementById("languageInfo");
const wordCount = document.getElementById("wordCount");
const copyButton = document.getElementById("copyButton");

function showStatus(message, type = "") {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = urlInput.value.trim();
  if (!url) return;

  submitButton.disabled = true;
  submitButton.textContent = "Extracting...";
  resultSection.hidden = true;
  transcriptOutput.value = "";
  showStatus("Getting the transcript. Please wait...");

  try {
    const response = await fetch("/api/transcript", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not get the transcript.");
    }

    transcriptOutput.value = data.transcript;
    languageInfo.textContent = `Language: ${data.language || "Unknown"}`;
    const words = data.transcript.trim().split(/\s+/).filter(Boolean).length;
    wordCount.textContent = `${words.toLocaleString()} words`;
    resultSection.hidden = false;
    showStatus("Transcript extracted successfully.", "success");
  } catch (error) {
    showStatus(error.message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Get Transcript";
  }
});

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(transcriptOutput.value);
    copyButton.textContent = "Copied!";
    setTimeout(() => { copyButton.textContent = "Copy text"; }, 1800);
  } catch {
    transcriptOutput.select();
    document.execCommand("copy");
    copyButton.textContent = "Copied!";
    setTimeout(() => { copyButton.textContent = "Copy text"; }, 1800);
  }
});
