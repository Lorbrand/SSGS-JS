# Sensor Seal Gateway Server
The Sensor Seal Gateway Server (SSGS) Node.js JavaScript Module allows you to create a customized Sensor Seal Gateway Server that can perform customized processing of Sensor Seal measurements.

## Installing
1. Create a package
   `npm init`

2. Set the package type to "module"
   `npm pkg set type="module"`

3. Install SSGS
   `npm i ssgs`

## Configuring Authorized Gateways
1. Create a `config.json` file in the root of the project directory.
2. Edit the file with the correct details, e.g.
```json
{
    "authorized_gateways": [
        {
            "description": "This is an example gateway",
            "uid": "4d ec 5d fa",
            "key": "1a 02 d7 2e 8f f3 78 7f 31 19 e6 4d ec 5d fa 7b b3 42 a3 66 e5 18 28 df 97 ae ef a7 67 4d 62 aa"
        }
    ]
}
```

## Usage
```typescript
import SSGS from 'ssgs'

new SSGS(1818, client => {
    // Called when a new client connects
    console.log('New client connected');

    // Print all messages received from the client
    client.onmessage = message => {
        console.log(`\nReceived Sensor Seal update via gateway ${SSGS.uidToString(message.gatewayUID)}:`);
        console.log(`Sensor Seal UID: ${SSGS.uidToString(message.sensorSealUID)}`);
        console.log(`Temperature: ${message.temperature} deg C`);
        console.log(`Vibration: ${message.vibration} mm/s^2`);
        console.log(`Speed: ${message.rpm} rpm`);
        console.log(`Voltage: ${message.voltage} mV`);
        console.log(`Message ID: ${message.msgID}`);
    };

    // Called when the client reconnects (power to gateway was lost and it restarted)
    client.onreconnect = () => {
        console.log('Client reconnected');
    }
});
```
