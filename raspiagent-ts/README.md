# ORION Gözlem Platformu - TypeScript Agent

This is the **TypeScript/Node.js** based agent designed to run on a Raspberry Pi. It connects to the ORION backend, fetches its configuration, reads data from connected hardware sensors, and executes commands sent from the server.

## Raspberry Pi Setup

Before running the agent, ensure your Raspberry Pi is configured correctly for hardware communication.

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

## Agent Installation and Running

1.  **Install Node.js:**
    It's recommended to use Node.js v18 or later.
    ```bash
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    ```

2.  **Install Dependencies:**
    Navigate to this directory (`raspiagent-ts`) on your Raspberry Pi and run:
    ```bash
    npm install
    ```

3.  **Configure the Agent:**
    Edit the `config.json` file in this directory.
    -   `server.base_url`: The full URL of your ORION backend server (e.g., `https://your-domain.com`).
    -   `device.id`: The unique ID for this Raspberry Pi. This **must match** the "Cihaz ID" you set when creating the station in the ORION web interface.
    -   `device.token`: The authentication token. This **must match** the `DEVICE_AUTH_TOKEN` in your backend's `.env` file.

4.  **Build and Run:**
    -   First, compile the TypeScript code:
        ```bash
        npm run build
        ```
    -   Then, run the compiled agent:
        ```bash
        npm start
        ```

The agent will now connect to the server, fetch its configuration, and start reading sensor data.