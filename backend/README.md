# ORION Gözlem Platformu - Backend

This is the backend API for the ORION Observation Platform, built with Node.js, Express, and TypeScript.

## Features

-   Receives sensor data from remote IoT agents (like a Raspberry Pi).
-   Provides configuration to IoT agents, telling them which sensors to read.
-   Simple token-based authentication for IoT agents.
-   (Future) Serves processed data to the frontend dashboard.
-   (Future) Manages stations, sensors, users, and alert rules.

## Setup & Running Locally

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Create Environment File:**
    Create a file named `.env` in this directory. Copy the contents of `.env.example` into it and fill in the required values.
    -   `PORT`: The port the server will run on (e.g., 8000).
    -   `DEVICE_AUTH_TOKEN`: A strong, secret token that your IoT agent will use to authenticate. **This must match the `token` in your agent's `config.json`**.
    -   `OPENWEATHER_API_KEY`: (Optional) Your API key from OpenWeatherMap. This is required to use the OpenWeather virtual sensor for temperature and humidity data.

3.  **Run in Development Mode:**
    This command uses `nodemon` to automatically restart the server when you make changes to the code.
    ```bash
    npm run dev
    ```

4.  **Build for Production:**
    This command compiles the TypeScript code into JavaScript in the `dist/` directory.
    ```bash
    npm run build
    ```

5.  **Run in Production:**
    This command runs the compiled JavaScript code.
    ```bash
    npm start
    ```

## Deployment on Plesk

Plesk makes deploying a Node.js application straightforward.

1.  **Prepare Your Code:** Push your code to a Git repository (e.g., GitHub, GitLab).

2.  **Setup Subdomain in Plesk:**
    -   Go to your domain in Plesk and create a new subdomain (e.g., `meteoroloji.ejderapi.com.tr`).
    -   Make sure its "Hosting Type" is set to "Website hosting".

3.  **Create Node.js Application:**
    -   Navigate to the dashboard for your new subdomain.
    -   Find and click on the **"Node.js"** icon. (If you don't see it, your hosting provider may need to install the Plesk Node.js extension).
    -   **Application Root:** Set this to the root of your project (e.g., `/httpdocs/backend`).
    -   **Document Root:** Can be the same as the Application Root.
    -   **Application Mode:** Set to "production".
    -   **Application Startup File:** Set this to `dist/server.js` (the compiled output of your TypeScript code).
    -   Click **"Enable Node.js"**.

4.  **Install Dependencies & Build:**
    -   After enabling Node.js, an "NPM install" button should appear. Click it to install the dependencies from your `package.json`.
    -   You may need to run your build script. Plesk might have a section for build commands, or you might need to SSH into your server, navigate to the application directory (`/var/www/vhosts/yourdomain.com/meteoroloji.ejderapi.com.tr/backend`), and run `npm run build` manually the first time.

5.  **Set Environment Variables:**
    -   In the Plesk Node.js interface, there is a section for "Environment Variables".
    -   Add your variables from the `.env` file here (e.g., `PORT`, `DEVICE_AUTH_TOKEN`, `OPENWEATHER_API_KEY`). Plesk will use its own mechanism for the port, but it's good practice to add it. The `DEVICE_AUTH_TOKEN` is crucial.

6.  **Connect Git Repository (Recommended):**
    -   Go to the "Git" icon in your subdomain's dashboard.
    -   Connect it to your repository. This will allow you to automatically deploy changes by pushing to your Git remote.

7.  **Restart the Application:**
    -   Go back to the Node.js section and click **"Restart App"**.

Your backend should now be live at `https://meteoroloji.ejderapi.com.tr`. You can test it by visiting the URL in your browser. You should see the "API is running" message.