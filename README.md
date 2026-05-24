# Stevens Workday RMP Extractor

A lightweight Chrome Extension designed to streamline course registration for Stevens Institute of Technology students. This tool seamlessly extracts professor names from the Workday course registration portal and automatically fetches their Rate My Professors (RMP) data, displaying it in a clean, easily searchable interface.

## Features

* **Automated Extraction:** Scrapes unique professor names directly from the active Workday "Find Course Sections" page.
* **Silent Data Fetching:** Uses a background service worker to fetch RMP data (Overall Rating, Difficulty, "Would Take Again" percentage, and total ratings) without opening intrusive ghost tabs.
* **Live Search:** Includes a built-in search bar to instantly filter the list of displayed professors.
* **Visual Rating Indicators:** Color-coded rating badges (Green, Yellow, Red) allow for quick visual assessment of professor quality.
* **Direct Links:** One-click access from the extension card directly to the professor's full Rate My Professors profile.

## Installation (Developer Mode)

Since this extension is not currently on the Chrome Web Store, you will need to load it manually as an unpacked extension.

1. Download or clone this repository to your local machine. Ensure all 4 files (`manifest.json`, `background.js`, `popup.html`, `popup.js`) are in a single folder.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. In the top right corner, toggle **Developer mode** to **ON**.
4. Click the **Load unpacked** button in the top left.
5. Select the folder containing your extension files.
6. The extension will now appear in your list. Click the puzzle icon in the Chrome toolbar and "pin" the extension for easy access.

## How to Use

1. Navigate to the **Stevens Workday** portal and access the **Find Course Sections** or **Faceted Search** page.
2. Ensure the course listings (with the professor names in the subtitles) are loaded on the screen.
3. Click the extension icon in your Chrome toolbar.
4. The extension will scan the page, compile a list of unique professors, and begin populating their Rate My Professor statistics.
5. Use the search bar to filter for specific names.

## Project Structure

* `manifest.json`: The configuration file that dictates permissions, domain access, and extension behavior.
* `popup.html`: The structural UI of the extension popup, styled with modern, clean CSS.
* `popup.js`: The frontend logic. It validates the Workday URL, injects the scraping script into the active tab, builds the UI cards, and handles search filtering.
* `background.js`: The background service worker. It receives the list of scraped professors, queries the Rate My Professors GraphQL/Relay API, parses the embedded JSON data, and returns the formatted statistics back to the popup.

## Permissions Explained

* `activeTab`: Required to read the DOM of the currently active Workday tab to extract professor names.
* `scripting`: Required to inject and execute the extraction script (`scrapeProfessors`) directly into the Workday page context.
* `host_permissions`: 
  * `https://wd5.myworkday.com/*`: Restricts extraction strictly to Stevens Workday pages.
  * `https://www.ratemyprofessors.com/*`: Allows the background script to bypass CORS and silently fetch rating data.