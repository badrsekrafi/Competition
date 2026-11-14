import serial
import requests
import json
import time
import sys

# Default configurations
# On Windows, it could be 'COM3', 'COM4', etc.
# On macOS/Linux, it could be '/dev/ttyACM0' or '/dev/tty.usbmodem...'
SERIAL_PORT = 'COM3' 
BAUD_RATE = 115200
API_URL = 'http://localhost:8787/api/telemetry'

if len(sys.argv) > 1:
    SERIAL_PORT = sys.argv[1]
if len(sys.argv) > 2:
    API_URL = sys.argv[2]

print("==================================================")
print("       Twin-Medic Arduino Mega Serial Bridge      ")
print("==================================================")
print(f"Target Serial Port: {SERIAL_PORT}")
print(f"Target Baud Rate   : {BAUD_RATE}")
print(f"Target API Endpoint: {API_URL}")
print("--------------------------------------------------")
print("Tips: You can specify port and API URL as arguments:")
print("  python serial_bridge.py COM4 http://localhost:8787/api/telemetry")
print("==================================================")

try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
    time.sleep(2)  # Wait for Arduino to reset
    print("[SUCCESS] Serial port connected! Listening for telemetry...")
except Exception as e:
    print(f"[ERROR] Failed to open serial port {SERIAL_PORT}: {e}")
    print("\nPlease verify:")
    print("1. The Arduino Mega is plugged into the USB port.")
    print("2. You have specified the correct COM port (check Device Manager on Windows).")
    print("3. No other application (like Arduino IDE Serial Monitor) has the port open.")
    sys.exit(1)

while True:
    try:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line.startswith('{') and line.endswith('}'):
                print(f"[Serial Rx] {line}")
                try:
                    data = json.loads(line)
                    # Forward to the Twin-Medic API
                    response = requests.post(API_URL, json=data)
                    res_json = response.json()
                    print(f"[API Post] Status: {response.status_code} | Ok: {res_json.get('ok')}")
                    cmd = res_json.get('command')
                    if cmd:
                        print(f"[Bridge] Received command from server: {cmd}")
                        ser.write((cmd + '\n').encode('utf-8'))
                except json.JSONDecodeError:
                    print("[Warning] Invalid JSON received from serial")
                except requests.exceptions.RequestException as re:
                    print(f"[API Error] Failed to connect to telemetry server: {re}")
                    print("Make sure your API server is running with 'npm run dev:api'")
    except KeyboardInterrupt:
        print("\nStopping serial bridge...")
        ser.close()
        break
    except Exception as e:
        print(f"[Unexpected Error] {e}")
        time.sleep(1)
