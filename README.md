# MLK Photography App

Premium iOS-style glassmorphism booking app for MLK Photography.

## What is included

- `index.html` - homepage, package cards, enquiry wizard, WhatsApp redirect.
- `gallery.html` - customer gallery, Google Drive photo viewing, photo selection, review form.
- `admin.html` - simple admin dashboard that reads Google Sheet summary.
- `assets/config.js` - main settings for Google Apps Script URL, WhatsApp number and Sheet URL.
- `assets/data.js` - fallback event types and packages.
- `apps-script/Code.gs` - Google Apps Script backend to save enquiries, photo selections and reviews into Google Sheet.

## Main flow

Customer flow:

1. Customer opens homepage.
2. Customer chooses event type. Multiple choices are allowed.
3. Customer selects package.
4. Customer fills name, date, day, time, location and custom request.
5. Customer accepts the terms note.
6. App saves the enquiry into Google Sheet.
7. App redirects customer to WhatsApp with an auto-filled message.

Gallery flow:

1. Admin uploads images to Google Drive.
2. Admin copies Google Drive file IDs into the `Galleries` sheet tab.
3. Customer opens `gallery.html?bookingId=BK-0001`.
4. Customer selects photos.
5. Photo selection is saved into Google Sheet.
6. Customer is asked to submit a review.
7. Review appears on homepage only when admin approves it in Google Sheet.

## Setup Google Sheet backend

1. Create a Google Sheet named `MLK Photography Bookings`.
2. Open the sheet.
3. Go to `Extensions > Apps Script`.
4. Delete any default code and paste the content from `apps-script/Code.gs`.
5. In `Code.gs`, change:

```js
const ADMIN_TOKEN = 'CHANGE_THIS_ADMIN_TOKEN';
```

Use your own private token, for example:

```js
const ADMIN_TOKEN = 'mlk-admin-2026';
```

6. Click Save.
7. Run this function once:

```js
setupMLKPhotographyApp
```

8. Google may ask for permission. Approve it.
9. Go to `Deploy > New deployment`.
10. Select type: `Web app`.
11. Set:

- Execute as: `Me`
- Who has access: `Anyone`

12. Deploy and copy the Web App URL.

## Connect the website to Google Sheet

Open `assets/config.js` and change:

```js
window.MLK_CONFIG = {
  GOOGLE_SCRIPT_URL: 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE',
  WHATSAPP_NUMBER: '60146289063',
  GOOGLE_SHEET_URL: 'PASTE_YOUR_GOOGLE_SHEET_URL_HERE',
  ADMIN_TOKEN: 'CHANGE_THIS_ADMIN_TOKEN'
};
```

Replace:

- `GOOGLE_SCRIPT_URL` with your Apps Script Web App URL.
- `WHATSAPP_NUMBER` with your main MLK WhatsApp number in international format without plus sign.
- `GOOGLE_SHEET_URL` with your Google Sheet URL.
- `ADMIN_TOKEN` with the same token you set in `Code.gs`.

## Google Sheet tabs

The setup function creates these tabs:

- `Enquiries`
- `Packages`
- `Confirmed Bookings`
- `Galleries`
- `PhotoSelections`
- `Reviews`

## Edit packages

You can edit the `Packages` tab in Google Sheet.

Important package columns:

- `Package Name`
- `Price`
- `Category`
- `Badge`
- `Features`
- `Terms`
- `Active`

Use semicolon `;` to separate features.

Example:

```text
12 x 30 Crystal Album; 12 Pages; 1 Photographer; Unlimited Shots
```

Set `Active` to `No` to hide a package.

## Add a customer gallery

In the `Galleries` sheet tab, add a row:

| Booking ID | Customer Name | Event Type | Google Drive Folder URL | File IDs | Selection Limit | Status | Notes |
|---|---|---|---|---|---|---|---|
| BK-0001 | Ravi & Priya | Wedding, Reception | Google Drive folder link | fileId1,fileId2,fileId3 | 30 | Active |  |

Then send this link to the customer:

```text
gallery.html?bookingId=BK-0001
```

## How to get Google Drive file IDs

A Google Drive file link looks like this:

```text
https://drive.google.com/file/d/FILE_ID_HERE/view
```

Copy only the `FILE_ID_HERE` part and paste it into the `File IDs` column.

Separate multiple file IDs with commas.

Also make sure the Drive files or folder are shared with `Anyone with the link can view`, otherwise customers may not see the images.

## Approve reviews for homepage

When a customer submits a review, it is saved in the `Reviews` tab.

To show a review on the homepage, set:

- `Permission To Display` = `Yes`
- `Homepage Display` = `Approved`
- `Admin Approved` = `Yes`

Only approved reviews appear on the homepage.

## Terms note used in the app

The customer must accept this before submission:

```text
I understand that the package price shown is the final package total and transportation charges are not included.
```

## Files to upload to hosting

Upload these files and folders to your website hosting:

```text
index.html
admin.html
gallery.html
assets/
```

The `apps-script/Code.gs` file is only for Google Apps Script and does not need to be uploaded to your website hosting.

## Testing without Google Sheet

If you open the website before setting `GOOGLE_SCRIPT_URL`, the website works in demo mode:

- Homepage packages show from `assets/data.js`.
- Reviews show demo reviews.
- Gallery shows demo photo blocks.
- Enquiry still opens WhatsApp, but it will not save to Google Sheet until configured.
