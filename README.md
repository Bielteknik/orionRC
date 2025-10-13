# Meteoroloji Gözlem Platformu

This repository contains the source code for the Meteorology Observation Platform.

## Project Structure

-   `/` (root): Contains the React-based user interface (frontend) for visualizing data and managing the system.
-   `/backend`: The Node.js, Express, and TypeScript backend API. This is the central brain of the platform.
-   `/raspberry-pi-agent`: The Node.js agent designed to run on a Raspberry Pi to read sensor data.

## Current Status

The backend service has now been added. Please refer to the `README.md` file inside the `/backend` directory for instructions on how to set up and run the server. The frontend and the IoT agent can now be configured to communicate with this new backend service.
