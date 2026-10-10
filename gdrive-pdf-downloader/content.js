(function () {
  // Prevent running multiple times
  if (window.__gdrivePdfDownloaderRunning) {
    chrome.runtime.sendMessage({ type: "error", text: "Already running! Please wait." });
    return;
  }
  window.__gdrivePdfDownloaderRunning = true;

  try {
    const { jsPDF } = window.jspdf;

    let pdf = null;
    let imgElements = document.getElementsByTagName("img");
    let validImgs = [];

    chrome.runtime.sendMessage({ type: "status", text: "Scanning for images..." });

    for (let i = 0; i < imgElements.length; i++) {
      let img = imgElements[i];
      let checkURLString = "blob:https://drive.google.com/";
      if (img.src.substring(0, checkURLString.length) !== checkURLString) {
        continue;
      }
      validImgs.push(img);
    }

    if (validImgs.length === 0) {
      chrome.runtime.sendMessage({
        type: "error",
        text: "No downloadable content found. Make sure the document is fully loaded and scrolled through.",
      });
      window.__gdrivePdfDownloaderRunning = false;
      return;
    }

    chrome.runtime.sendMessage({
      type: "status",
      text: `Found ${validImgs.length} pages. Generating PDF...`,
    });

    for (let i = 0; i < validImgs.length; i++) {
      let img = validImgs[i];

      let canvasElement = document.createElement("canvas");
      let con = canvasElement.getContext("2d");
      canvasElement.width = img.naturalWidth;
      canvasElement.height = img.naturalHeight;
      con.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
      let imgData = canvasElement.toDataURL();

      let orientation = img.naturalWidth > img.naturalHeight ? "l" : "p";
      let pageWidth = img.naturalWidth;
      let pageHeight = img.naturalHeight;

      if (i === 0) {
        pdf = new jsPDF({
          orientation: orientation,
          unit: "px",
          format: [pageWidth, pageHeight],
        });
      } else {
        pdf.addPage([pageWidth, pageHeight], orientation);
      }

      pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight, "", "SLOW");

      let percent = Math.floor(((i + 1) / validImgs.length) * 100);
      chrome.runtime.sendMessage({ type: "progress", percent: percent });
    }

    // Get title
    let title =
      document.querySelector('meta[itemprop="name"]')?.content ||
      document.title ||
      "download.pdf";
    if ((title.split(".").pop() || "").toLowerCase() !== "pdf") {
      title = title + ".pdf";
    }

    chrome.runtime.sendMessage({ type: "status", text: "Downloading PDF..." });

    pdf.save(title, { returnPromise: true }).then(() => {
      chrome.runtime.sendMessage({ type: "done" });
      window.__gdrivePdfDownloaderRunning = false;
    });
  } catch (err) {
    chrome.runtime.sendMessage({
      type: "error",
      text: "Error: " + err.message,
    });
    window.__gdrivePdfDownloaderRunning = false;
  }
})();
