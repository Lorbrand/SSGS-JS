# Sensor Seal Gateway Server
The Sensor Seal Gateway Server (SSGS) Node.js JavaScript Module allows you to create a customized Sensor Seal Gateway Server that can perform customized processing of Sensor Seal measurements.

## Installing
Ensure you have Node.js version 12 or later installed and then follow the steps below:
1. Create a package
   ```
   npm init
   ```

3. Set the package type to "module"
   ```
   npm pkg set type="module"
   ```

5. Install SSGS
   ```
   npm i ssgs
   ```

## Usage Example
1. Create a file named `server.js` for example.
2. In the file, import the SSGS module and use it as follows:
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

## Port Forwarding
If you want gateways to be able to connect to your SSGS server from outside your local network, you need to forward external traffic from UDP port 1818 (or the port the gateway was configured to connect to) to the SSGS server. It is recommended to keep all ports as 1818 unless you require multiple servers with the same public IP address.

## Setting Up Gateways
1. Connect the gateway to the internet via an ethernet cable. Power can be supplied to the gateway via Power over Ethernet (PoE) or the terminals.
2. Navigate to https://gateway.sensorseal.com and sign in to your account.
3. Select the gateway you wish to configure.
4. Choose `SSGS` as the Connectivity Type
5. Enter the hostname of your SSGS server. This could be `ssgs.example.com` or `192.168.1.40` for example.
6. Enter the port of the SSGS server. This should be kept as 1818 unless you specifically changed the server's listening port.
7. Click `Generate Key` to generate a new key for this gateway.
8. Make note of the Gateway UID and key as these will be required in the `config.json` file, described below.
9. Click `Save Changes`.

## Configuring which gateways are allowed to connect
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

## Starting the Server
Start the server with
```
node server.js
```
where `server.js` is the name of your project's entry point.

