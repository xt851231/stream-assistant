<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/temp/1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Troubleshooting & Logging

This application uses a custom logger to help debug issues while reducing console noise during normal operation.

### How to Enable Debug Logs

The default log level is `info`. To see more detailed logs (e.g., streaming events, media status changes), you can change the log level directly in your browser's Developer Tools Console:

1.  Open Developer Tools (F12 or Ctrl+Shift+I).
2.  Go to the **Console** tab.
3.  Run the following command:
    ```javascript
    localStorage.setItem('log_level', 'debug');
    ```
4.  Refresh the page.

### Available Log Levels

You can set `log_level` to any of the following:

*   `debug`: Detailed debugging information.
*   `info`: Standard operational messages (default).
*   `warn`: Warnings only.
*   `error`: Critical errors only.
*   `none`: Disable all logs.

To revert to the default setting, run:
```javascript
localStorage.removeItem('log_level');
```
