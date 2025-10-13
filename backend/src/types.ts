// This file defines the shape of the configuration object
// that the backend sends to the IoT agent.

// A single sensor's configuration
export interface SensorConfig {
    id: number; // Unique ID for this sensor in the database
    name: string; // Human-readable name, e.g., "Sıcaklık Sensörü 1"
    is_active: boolean;
    interface: 'i2c' | 'serial' | 'virtual'; // The hardware interface type
    
    // Defines which driver to use on the agent
    parser_config: {
        driver: string; // e.g., "sht3x"
    };

    // Driver-specific settings, like I2C address or serial port path
    config: {
        address?: string; // e.g., "0x44" for I2C
        bus?: number;     // e.g., 1 for I2C bus 1
        port?: string;    // e.g., "/dev/ttyUSB0" for serial
        baudrate?: number;
    };
}

// The complete configuration for a single IoT device (Raspberry Pi)
export interface DeviceConfig {
    sensors: SensorConfig[];
    // Future device-wide settings can be added here,
    // e.g., check_in_interval_seconds: 300
}

// Data structure for a station, sent to the frontend
export interface Station {
  id: string;
  name: string;
  location: string;
  locationCoords: { lat: number; lng: number };
  status: 'active' | 'inactive' | 'maintenance';
  sensorCount: number;
  cameraCount: number;
  activeAlerts: number;
  lastUpdate: string;
  systemHealth?: number;
  avgBattery?: number;
  dataFlow?: number;
  activeSensorCount?: number;
  onlineCameraCount?: number;
}
