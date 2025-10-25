# ORION Gözlem Platformu

This repository contains the source code for the ORION Observation Platform.

## Project Structure

-   `/` (root): Contains the React-based user interface (frontend) for visualizing data and managing the system.
-   `/backend`: The Node.js, Express, and TypeScript backend API. This is the central brain of the platform.
-   `/raspiagent-ts`: The **TypeScript/Node.js** agent designed to run on a Raspberry Pi to read sensor data.
-   `/raspiagent-py`: The **Python** agent designed to run on a Raspberry Pi, offering an alternative to the TypeScript agent.

## Backend Service

The backend service is the central hub. Please refer to the `README.md` file inside the `/backend` directory for instructions on how to set up and run the server.

## IoT Agent

You can choose to run either the TypeScript or the Python agent on your Raspberry Pi. Both perform the same functions. Refer to the `README.md` file inside the respective agent's directory for detailed setup and running instructions.