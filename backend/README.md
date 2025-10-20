# ORION Gözlem Platformu - Backend

This is the backend API for the ORION Observation Platform, built with Node.js, Express, and TypeScript.

## Features

-   Receives sensor data from remote IoT agents (like a Raspberry Pi).
-   Provides configuration to IoT agents, telling them which sensors to read.
-   Simple token-based authentication for IoT agents.
-   Serves the frontend React application and its data.
-   Manages stations, sensors, users, and alert rules.
-   Sends scheduled reports via email.

## Setup & Running Locally

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Create Environment File:**
    Create a file named `.env` in this directory. Fill in the required values.
    -   `PORT`: The port the server will run on (e.g., 8000).
    -   `DEVICE_AUTH_TOKEN`: A strong, secret token that your IoT agent will use to authenticate.
    -   `OPENWEATHER_API_KEY`: (Optional) Your API key from OpenWeatherMap.
    -   `EMAIL_HOST`: Your SMTP server host (e.g., 'smtp.gmail.com').
    -   `EMAIL_PORT`: Your SMTP port (e.g., 587 for TLS, 465 for SSL).
    -   `EMAIL_USER`: Your email account username.
    -   `EMAIL_PASS`: Your email account password or an app-specific password.

3.  **Run in Development Mode:**
    ```bash
    npm run dev
    ```

## Build & Deployment (Plesk)

This guide provides a robust deployment method that avoids common permission issues on shared hosting environments like Plesk.

1.  **Build Frontend:**
    In the **root directory** of the project (outside the `backend` folder), run the build command. This compiles your React app into optimized HTML, CSS, and JS files.
    ```bash
    npm run build
    ```
    This will create a `dist` folder in the root directory.

2.  **Build Backend:**
    In this `backend` directory, run the build command. This compiles the TypeScript server code.
    ```bash
    npm run build
    ```
    This will create a `dist` folder inside the `backend` directory.

3.  **Prepare Backend for Upload:**
    -   Inside this `backend` folder, create a new folder named `public`.
    -   Go to the `dist` folder created in **Step 1** (the frontend build).
    -   Copy **all files and folders inside** the frontend `dist` folder and paste them into the `backend/public` folder you just created.

4.  **Upload to Plesk:**
    -   Upload the entire `backend` folder (which now contains `node_modules`, `dist` for the server, and `public` with the frontend files) to `/backend-app/` on your server.

5.  **Configure Node.js in Plesk:**
    -   Navigate to the **"Node.js"** icon in your Plesk dashboard for the domain.
    -   **Application Root:** Set this to `/backend-app`.
    -   **Application Startup File:** Set this to `dist/server.js`.
    -   **Application Mode:** Set to "production".
    -   Click **"Enable Node.js"**.

6.  **Install Dependencies & Set Environment:**
    -   If you didn't upload `node_modules`, click the **"NPM install"** button in the Plesk interface.
    -   Go to the "Environment Variables" section and add the variables from your local `.env` file (`PORT`, `DEVICE_AUTH_TOKEN`, etc.).

7.  **Restart the Application:**
    -   Click **"Restart App"**.

Your application should now be live. The backend will serve both the API and the user interface from a single, self-contained directory, preventing any "Not Found" errors.
