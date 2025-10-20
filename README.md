# ORION Gözlem Platformu

This repository contains the source code for the ORION Observation Platform.

## Project Structure

-   `/` (root): Contains the React-based user interface (frontend) for visualizing data and managing the system.
-   `/backend`: The Node.js, Express, and TypeScript backend API. This is the central brain of the platform.
-   `/raspberry-pi-agent`: The Node.js agent designed to run on a Raspberry Pi to read sensor data.

## Raspberry Pi Agent Setup

Before running the agent on a Raspberry Pi, ensure the device is configured correctly for hardware communication.

1.  **Enable Interfaces:**
    Run `sudo raspi-config` in your terminal.
    -   Navigate to `3 Interface Options`.
    -   Enable `I2C`.
    -   Enable `Serial Port`. When asked if you would like a login shell to be accessible over serial, answer **No**. When asked if you would like the serial port hardware to be enabled, answer **Yes**.
    -   Select `Finish` and reboot when prompted.

2.  **User Permissions:**
    To allow the agent to access hardware ports without needing `sudo`, your user must be a member of the correct groups. Replace `<username>` with your actual username (e.g., `pi`).
    ```bash
    sudo usermod -a -G dialout,i2c <username>
    ```
    **Important:** You must **reboot** your Raspberry Pi (or log out and log back in) for these group changes to take effect.

3.  **Check I2C Devices:**
    After connecting your I2C sensors (like the SHT3x), you can verify that the Raspberry Pi detects them by running:
    ```bash
    i2cdetect -y 1
    ```
    You should see a hexadecimal number (e.g., `44`) in the output grid. If not, double-check your wiring.

## Current Status

The backend service has now been added. Please refer to the `README.md` file inside the `/backend` directory for instructions on how to set up and run the server. The frontend and the IoT agent can now be configured to communicate with this new backend service.