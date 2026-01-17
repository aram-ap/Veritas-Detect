// Background service worker
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
  console.log("Veritas extension installed");
});
