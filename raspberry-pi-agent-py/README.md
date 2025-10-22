# ORION Gözlem Platformu - Python Agent

This is the **Python** based agent designed to run on a Raspberry Pi. It connects to the ORION backend, fetches its configuration, reads data from connected hardware sensors, and executes commands sent from the server.

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

3.  **Install System Dependencies:**
    The agent may require `ffmpeg` for camera operations.
    ```bash
    sudo apt update
    sudo apt install ffmpeg -y
    ```

## Agent Installation and Running

1.  **Install Python:**
    Ensure you have Python 3.9 or later installed. Raspberry Pi OS usually comes with a compatible version.

2.  **Install Dependencies:**
    Navigate to this directory (`raspberry-pi-agent-py`) on your Raspberry Pi and run:
    ```bash
    pip install -r requirements.txt
    ```

3.  **Configure the Agent:**
    -   Edit the `config.json` file in this directory.
        -   `server.base_url`: The full URL of your ORION backend server (e.g., `https://your-domain.com`).
        -   `device.id`: The unique ID for this Raspberry Pi. This **must match** the "Cihaz ID" you set when creating the station in the ORION web interface.
        -   `device.token`: The authentication token. This **must match** the `DEVICE_AUTH_TOKEN` in your backend's `.env` file.
    -   For Gemini AI features (like Snow Depth Analysis), create a `.env` file in this directory:
        ```
        API_KEY=YOUR_GEMINI_API_KEY
        ```

4.  **Run the Agent:**
    ```bash
    python agent.py
    ```

The agent will now connect to the server, fetch its configuration, and start reading sensor data.
